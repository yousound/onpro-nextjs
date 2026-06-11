import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import {
  enrichThreadsWithGoogleProfile,
  fetchGoogleUserProfile,
  gmailApiThreadIdFromEmailThreadId,
} from "@/lib/gmail/fetch-threads";
import { refreshCachedGmailThread } from "@/lib/gmail/history-sync";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import {
  getGmailConnectionForUser,
  getValidGmailAccessToken,
} from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Live: one Gmail thread with full bodies and inline images (for lazy load on open). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ threadId: string }> },
) {
  const live = await isLiveBackendEnabled();
  if (!live) {
    return NextResponse.json({ error: "Not available in mock mode" }, { status: 404 });
  }

  const { threadId: encodedId } = await context.params;
  const threadId = decodeURIComponent(encodedId);
  const gmailId = gmailApiThreadIdFromEmailThreadId(threadId);
  if (!gmailId) {
    return NextResponse.json({ error: "Invalid Gmail thread id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json({ error: "Gmail OAuth not configured" }, { status: 503 });
  }

  const connection = await getGmailConnectionForUser(user.id);
  if (!connection) {
    return NextResponse.json({ error: "Gmail not connected" }, { status: 404 });
  }

  try {
    const { accessToken } = await getValidGmailAccessToken(connection);
    const [thread, profile] = await Promise.all([
      refreshCachedGmailThread(user.id, accessToken, threadId),
      fetchGoogleUserProfile(accessToken).catch(() => null),
    ]);
    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    const enriched = profile
      ? enrichThreadsWithGoogleProfile([thread], profile)[0]
      : thread;
    return NextResponse.json({
      thread: enriched,
      source: "live",
      connected: true,
      email: connection.email,
    });
  } catch (e) {
    console.error("[api/mailroom/threads/[threadId]]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load Gmail thread" },
      { status: 502 },
    );
  }
}
