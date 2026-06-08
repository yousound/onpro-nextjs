import { dedupeCalendarEvents } from "@/lib/calendar-google";
import { fetchGoogleCalendarEvents } from "@/lib/gmail/fetch-calendar";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import {
  getGmailConnectionForUser,
  getValidGmailAccessToken,
  type GmailConnectionRow,
} from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { CalendarEvent } from "@/lib/types/calendar";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceCalendarSync = {
  events: CalendarEvent[];
  connectedAccounts: Array<{ userId: string; email: string; name: string }>;
  teamUserCount: number;
};

async function resolveWorkspaceUserIds(
  supabase: SupabaseClient,
  viewerUserId: string,
): Promise<string[]> {
  const ids = new Set<string>([viewerUserId]);

  const { data: asOperator } = await supabase
    .from("workspace_memberships")
    .select("member_user_id")
    .eq("operator_user_id", viewerUserId)
    .eq("status", "active");

  for (const row of asOperator ?? []) {
    if (row.member_user_id) ids.add(row.member_user_id as string);
  }

  const { data: asMember } = await supabase
    .from("workspace_memberships")
    .select("operator_user_id")
    .eq("member_user_id", viewerUserId)
    .eq("status", "active");

  const operatorId = (asMember?.[0]?.operator_user_id as string | undefined) ?? viewerUserId;
  ids.add(operatorId);

  if (operatorId !== viewerUserId) {
    const { data: siblings } = await supabase
      .from("workspace_memberships")
      .select("member_user_id")
      .eq("operator_user_id", operatorId)
      .eq("status", "active");
    for (const row of siblings ?? []) {
      if (row.member_user_id) ids.add(row.member_user_id as string);
    }
  }

  return [...ids];
}

async function loadOwnerLabels(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, { email: string; name: string }>> {
  const map = new Map<string, { email: string; name: string }>();
  if (userIds.length === 0) return map;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, email")
    .in("id", userIds);

  for (const row of profiles ?? []) {
    const id = row.id as string;
    const email = (row.email as string | null)?.trim() ?? "";
    const name = (row.username as string | null)?.trim() || email.split("@")[0] || "Team member";
    map.set(id, { email, name });
  }

  return map;
}

async function listGmailConnectionsForUsers(
  admin: SupabaseClient,
  userIds: string[],
): Promise<GmailConnectionRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from("user_gmail_connections")
    .select("user_id, email, refresh_token, access_token, access_token_expires_at")
    .in("user_id", userIds);

  if (error) {
    if (error.message?.includes("user_gmail_connections")) return [];
    throw error;
  }
  return (data ?? []) as GmailConnectionRow[];
}

async function fetchEventsForConnection(
  connection: GmailConnectionRow,
  owner: { userId: string; email: string; name: string },
): Promise<CalendarEvent[]> {
  const { accessToken } = await getValidGmailAccessToken(connection, { admin: true });
  return fetchGoogleCalendarEvents(accessToken, owner);
}

/** Workspace team calendars: operator + members with Gmail connected (service role when available). */
export async function fetchWorkspaceCalendarEvents(
  viewerUserId: string,
): Promise<WorkspaceCalendarSync> {
  if (!isGmailOAuthConfigured()) {
    return { events: [], connectedAccounts: [], teamUserCount: 0 };
  }

  const sessionClient = await createClient();
  const teamUserIds = await resolveWorkspaceUserIds(sessionClient, viewerUserId);
  const labels = await loadOwnerLabels(sessionClient, teamUserIds);

  const service = createServiceClient();
  let connections: GmailConnectionRow[];

  if (service) {
    connections = await listGmailConnectionsForUsers(service, teamUserIds);
  } else {
    const own = await getGmailConnectionForUser(viewerUserId);
    connections = own ? [own] : [];
  }

  const connectedAccounts: WorkspaceCalendarSync["connectedAccounts"] = [];
  const merged: CalendarEvent[] = [];

  for (const conn of connections) {
    const label = labels.get(conn.user_id) ?? {
      email: conn.email,
      name: conn.email.split("@")[0] || "Team",
    };
    connectedAccounts.push({
      userId: conn.user_id,
      email: conn.email,
      name: label.name,
    });
    try {
      const events = await fetchEventsForConnection(conn, {
        userId: conn.user_id,
        email: conn.email,
        name: label.name,
      });
      merged.push(...events);
    } catch (e) {
      console.warn(`[calendar] sync failed for ${conn.email}`, e);
    }
  }

  return {
    events: dedupeCalendarEvents(merged),
    connectedAccounts,
    teamUserCount: teamUserIds.length,
  };
}
