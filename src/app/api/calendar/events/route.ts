import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import { fetchWorkspaceCalendarEvents } from "@/lib/server/fetch-workspace-calendar-events";
import { createClient } from "@/lib/supabase/server";

/** Live: Google Calendar for workspace team (each connected Gmail account). */
export async function GET() {
  const live = await isLiveBackendEnabled();
  if (!live) {
    return NextResponse.json({ events: [], source: "mock" });
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
      events: [],
      source: "live",
      connected: false,
      message: "Gmail OAuth is not configured on the server.",
    });
  }

  try {
    const sync = await fetchWorkspaceCalendarEvents(user.id);
    const connected = sync.connectedAccounts.length > 0;
    if (!connected) {
      return NextResponse.json({
        events: [],
        source: "live",
        connected: false,
        email: null,
        teamUserCount: sync.teamUserCount,
        message: "Connect Gmail in Mailroom to sync Google Calendar for your team.",
      });
    }

    return NextResponse.json({
      events: sync.events,
      source: "live",
      connected: true,
      connectedAccounts: sync.connectedAccounts,
      teamUserCount: sync.teamUserCount,
      email: sync.connectedAccounts.find((a) => a.userId === user.id)?.email ?? sync.connectedAccounts[0]?.email,
    });
  } catch (e) {
    console.error("[api/calendar/events]", e);
    const message = e instanceof Error ? e.message : "Failed to load Google Calendar";
    const needsReauth = message.includes("insufficient") || message.includes("403");
    return NextResponse.json(
      {
        error: message,
        events: [],
        connected: false,
        needsReauth,
        message: needsReauth
          ? "Reconnect Gmail in Mailroom to grant Calendar access."
          : message,
      },
      { status: needsReauth ? 403 : 502 },
    );
  }
}
