import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { GMAIL_INBOX_PAGE_SIZE } from "@/lib/gmail/fetch-threads";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import { loadMailroomInboxPage } from "@/lib/mailroom/fetch-inbox-page";
import { getGmailConnectionForUser } from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Live: Gmail inbox threads (metadata list, Supabase + edge cache on first page). */
export async function GET(request: Request) {
  const live = await isLiveBackendEnabled();
  if (!live) {
    return NextResponse.json({ threads: [], source: "mock" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json({
      threads: [],
      source: "live",
      connected: false,
      message: "Gmail OAuth is not configured on the server.",
    });
  }

  const connection = await getGmailConnectionForUser(user.id);
  if (!connection) {
    return NextResponse.json({
      threads: [],
      source: "live",
      connected: false,
      email: null,
    });
  }

  const url = new URL(request.url);
  const pageToken = url.searchParams.get("pageToken")?.trim() || undefined;
  const maxResultsRaw = Number(url.searchParams.get("maxResults") ?? GMAIL_INBOX_PAGE_SIZE);
  const maxResults = Number.isFinite(maxResultsRaw)
    ? Math.min(GMAIL_INBOX_PAGE_SIZE, Math.max(1, maxResultsRaw))
    : GMAIL_INBOX_PAGE_SIZE;
  const q = url.searchParams.get("q")?.trim() || undefined;
  const skipCache = url.searchParams.get("fresh") === "1";

  try {
    const page = await loadMailroomInboxPage(user.id, connection, {
      pageToken,
      maxResults,
      q,
      skipCache,
    });

    const res = NextResponse.json({
      threads: page.threads,
      nextPageToken: page.nextPageToken,
      hasMore: Boolean(page.nextPageToken),
      resultSizeEstimate: page.resultSizeEstimate,
      pageSize: page.pageSize,
      searchQuery: q ?? null,
      source: "live",
      inboxSource: page.source,
      connected: true,
      email: connection.email,
      profilePicture: page.profilePicture,
    });

    if (page.source === "cache" && !pageToken && !q) {
      res.headers.set("Cache-Control", "private, s-maxage=60, stale-while-revalidate=120");
    }

    return res;
  } catch (e) {
    console.error("[api/mailroom/threads]", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to load Gmail inbox",
        threads: [],
        connected: true,
        email: connection.email,
      },
      { status: 502 },
    );
  }
}
