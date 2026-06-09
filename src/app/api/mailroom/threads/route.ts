import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import {
  enrichThreadsWithGoogleProfile,
  fetchGmailInboxThreadPage,
  fetchGoogleUserProfile,
  GMAIL_INBOX_PAGE_SIZE,
} from "@/lib/gmail/fetch-threads";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import {
  getGmailConnectionForUser,
  getValidGmailAccessToken,
} from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Live: Gmail inbox threads only. Mock mode returns empty (client uses demo threads). */
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

  try {
    const { accessToken } = await getValidGmailAccessToken(connection);
    const [page, profile] = await Promise.all([
      fetchGmailInboxThreadPage(accessToken, { pageToken, maxResults, q }),
      fetchGoogleUserProfile(accessToken).catch(() => null),
    ]);
    const enriched = profile
      ? enrichThreadsWithGoogleProfile(page.threads, profile)
      : page.threads;
    return NextResponse.json({
      threads: enriched,
      nextPageToken: page.nextPageToken,
      hasMore: Boolean(page.nextPageToken),
      resultSizeEstimate: page.resultSizeEstimate,
      pageSize: maxResults,
      searchQuery: q ?? null,
      source: "live",
      connected: true,
      email: connection.email,
      profilePicture: profile?.picture ?? null,
    });
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
