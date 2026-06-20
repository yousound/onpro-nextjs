import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { gmailReauthPayload, isGmailReauthRequiredError } from "@/lib/gmail/auth-errors";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import { loadMailroomInboxPage } from "@/lib/mailroom/fetch-inbox-page";
import {
  getGmailConnectionForUser,
  getValidGmailAccessToken,
  isMissingGmailTableError,
} from "@/lib/supabase/gmail-connection";
import { startGmailWatch } from "@/lib/gmail/watch";
import { createClient } from "@/lib/supabase/server";
import { MAILROOM_FIRST_INBOX_PAGE_SIZE } from "@/lib/data/mailroom-api";

export const maxDuration = 60;

/** One round trip: Gmail status + first inbox page (metadata, cached when fresh). */
export async function GET(request: Request) {
  const live = await isLiveBackendEnabled();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!live) {
    return NextResponse.json({
      connected: false,
      email: null,
      mode: "mock",
      oauthConfigured: isGmailOAuthConfigured(),
      threads: [],
      source: "mock",
    });
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json({
      connected: false,
      email: null,
      mode: "oauth_not_configured",
      oauthConfigured: false,
      threads: [],
      message:
        process.env.NODE_ENV === "production"
          ? "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to Vercel Environment Variables (Production), then redeploy."
          : "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, then restart the dev server.",
    });
  }

  try {
    const connection = await getGmailConnectionForUser(user.id);
    if (!connection) {
      return NextResponse.json({
        connected: false,
        email: null,
        mode: "gmail",
        oauthConfigured: true,
        threads: [],
      });
    }

    const url = new URL(request.url);
    const skipCache = url.searchParams.get("fresh") === "1";
    const maxResultsRaw = Number(
      url.searchParams.get("maxResults") ?? MAILROOM_FIRST_INBOX_PAGE_SIZE,
    );
    const maxResults = Number.isFinite(maxResultsRaw)
      ? Math.max(1, maxResultsRaw)
      : MAILROOM_FIRST_INBOX_PAGE_SIZE;

    const page = await loadMailroomInboxPage(user.id, connection, {
      maxResults,
      skipCache,
    });

    const res = NextResponse.json({
      connected: true,
      email: connection.email,
      mode: "gmail",
      oauthConfigured: true,
      threads: page.threads,
      nextPageToken: page.nextPageToken,
      hasMore: Boolean(page.nextPageToken),
      resultSizeEstimate: page.resultSizeEstimate,
      pageSize: page.pageSize,
      profilePicture: page.profilePicture,
      inboxSource: page.source,
      source: "live",
    });

    if (page.source === "cache") {
      res.headers.set("Cache-Control", "private, s-maxage=60, stale-while-revalidate=120");
    }

    return res;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (isGmailReauthRequiredError(e)) {
      return NextResponse.json(
        gmailReauthPayload({
          email: null,
          mode: "gmail",
          oauthConfigured: true,
          threads: [],
        }),
        { status: 403 },
      );
    }
    if (isMissingGmailTableError(err) || err.message?.includes("user_gmail_connections")) {
      return NextResponse.json({
        connected: false,
        email: null,
        mode: "db_migration_required",
        oauthConfigured: true,
        threads: [],
        message:
          "Run supabase/migrations/003_user_gmail.sql in your Supabase project (SQL editor), then reload Mailroom.",
      });
    }
    console.error("[api/mailroom/bootstrap]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bootstrap failed" },
      { status: 502 },
    );
  }
}

/** After OAuth connect — start Gmail watch (Pub/Sub) when configured. */
export async function POST() {
  const live = await isLiveBackendEnabled();
  if (!live) return NextResponse.json({ ok: false, reason: "mock" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connection = await getGmailConnectionForUser(user.id);
  if (!connection) return NextResponse.json({ ok: false, reason: "not_connected" });

  try {
    const { accessToken } = await getValidGmailAccessToken(connection);
    const watch = await startGmailWatch(accessToken, user.id);
    return NextResponse.json({ ok: true, watch: watch != null });
  } catch (e) {
    console.warn("[api/mailroom/bootstrap] watch start", e);
    return NextResponse.json({ ok: false, reason: "watch_failed" });
  }
}
