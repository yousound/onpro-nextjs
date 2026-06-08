import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import {
  enrichThreadsWithGoogleProfile,
  fetchGmailInboxThreads,
  fetchGoogleUserProfile,
} from "@/lib/gmail/fetch-threads";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import {
  getGmailConnectionForUser,
  getValidGmailAccessToken,
} from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";

/** Live: Gmail inbox threads only. Mock mode returns empty (client uses demo threads). */
export async function GET() {
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

  try {
    const { accessToken } = await getValidGmailAccessToken(connection);
    const [threads, profile] = await Promise.all([
      fetchGmailInboxThreads(accessToken),
      fetchGoogleUserProfile(accessToken).catch(() => null),
    ]);
    const enriched = profile ? enrichThreadsWithGoogleProfile(threads, profile) : threads;
    return NextResponse.json({
      threads: enriched,
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
