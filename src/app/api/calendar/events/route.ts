import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { deleteGoogleCalendarEvent } from "@/lib/gmail/fetch-calendar";
import {
  GMAIL_REAUTH_USER_MESSAGE,
  gmailReauthPayload,
  isGmailReauthRequiredError,
} from "@/lib/gmail/auth-errors";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import { fetchWorkspaceCalendarEvents } from "@/lib/server/fetch-workspace-calendar-events";
import {
  getGmailConnectionForUser,
  getValidGmailAccessToken,
  type GmailConnectionRow,
} from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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
    if (sync.needsReauth) {
      return NextResponse.json(
        gmailReauthPayload({
          events: [],
          source: "live",
          email: null,
          teamUserCount: sync.teamUserCount,
        }),
        { status: 403 },
      );
    }
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
    if (isGmailReauthRequiredError(e)) {
      return NextResponse.json(
        gmailReauthPayload({
          events: [],
          source: "live",
          email: null,
          teamUserCount: 0,
        }),
        { status: 403 },
      );
    }
    const message = e instanceof Error ? e.message : "Failed to load Google Calendar";
    const needsReauth = message.includes("insufficient") || message.includes("403");
    return NextResponse.json(
      {
        error: message,
        events: [],
        connected: false,
        needsReauth,
        message: needsReauth
          ? GMAIL_REAUTH_USER_MESSAGE
          : "Could not load Google Calendar. Try again in a moment.",
      },
      { status: needsReauth ? 403 : 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const live = await isLiveBackendEnabled();
  if (!live) {
    return NextResponse.json({ error: "Calendar delete requires Live mode" }, { status: 400 });
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json({ error: "Gmail OAuth is not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { external_id?: string; owner_user_id?: string; owner_email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const externalId = body.external_id?.trim();
  if (!externalId) {
    return NextResponse.json({ error: "external_id required" }, { status: 400 });
  }

  const ownerUserId = body.owner_user_id?.trim() || user.id;
  const service = createServiceClient();
  let connection: GmailConnectionRow | null = null;
  if (service) {
    const { data } = await service
      .from("user_gmail_connections")
      .select("user_id, email, refresh_token, access_token, access_token_expires_at")
      .eq("user_id", ownerUserId)
      .maybeSingle();
    connection = (data as GmailConnectionRow | null) ?? null;
  } else {
    connection = await getGmailConnectionForUser(ownerUserId);
  }

  if (!connection) {
    return NextResponse.json(
      { error: "No Gmail connection for this calendar owner. Connect Gmail in Mailroom." },
      { status: 404 },
    );
  }

  try {
    const { accessToken } = await getValidGmailAccessToken(connection, {
      admin: Boolean(service),
    });
    await deleteGoogleCalendarEvent(accessToken, externalId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isGmailReauthRequiredError(e)) {
      return NextResponse.json(gmailReauthPayload(), { status: 403 });
    }
    const msg = e instanceof Error ? e.message : "Delete failed";
    const needsReauth =
      msg.includes("insufficient") || msg.includes("403") || msg.includes("calendar.events");
    return NextResponse.json(
      {
        error: msg,
        needsReauth,
        message: needsReauth ? GMAIL_REAUTH_USER_MESSAGE : "Could not delete this calendar event.",
      },
      { status: needsReauth ? 403 : 502 },
    );
  }
}
