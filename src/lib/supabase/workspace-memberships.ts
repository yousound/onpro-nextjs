import type { PeopleSegment } from "@/lib/types/contact";
import type { WorkspaceMatch, WorkspaceMemberEvent, WorkspaceMembership } from "@/lib/types/workspace";
import { workspaceDisplayName } from "@/lib/workspace-display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

function segmentFromContactRole(role: string | null | undefined): PeopleSegment {
  const r = (role ?? "").trim().toLowerCase();
  if (r === "vendor") return "vendor";
  if (r === "team") return "team";
  return "client";
}

type MatchRow = {
  operator_user_id: string;
  contact_id: number;
  workspace_name: string;
  contact_display_name: string;
  project_count: number;
  already_joined: boolean;
  segment?: string | null;
};

export async function findWorkspacesForEmail(
  supabase: SupabaseClient,
  email: string,
  memberUserId: string,
): Promise<WorkspaceMatch[]> {
  const { data, error } = await supabase.rpc("find_workspaces_for_email", {
    p_email: email.trim(),
    p_member_user_id: memberUserId,
  });

  if (error) throw error;

  return ((data as MatchRow[] | null) ?? []).map((row) => ({
    operatorUserId: row.operator_user_id,
    contactId: row.contact_id,
    workspaceName: row.workspace_name,
    contactDisplayName: row.contact_display_name,
    projectCount: Number(row.project_count),
    alreadyJoined: Boolean(row.already_joined),
    segment: segmentFromContactRole(row.segment ?? undefined),
  }));
}

function matchKey(m: Pick<WorkspaceMatch, "operatorUserId" | "contactId">): string {
  return `${m.operatorUserId}:${m.contactId}`;
}

function mergeWorkspaceMatches(
  emailMatches: WorkspaceMatch[],
  joinedMatches: WorkspaceMatch[],
): WorkspaceMatch[] {
  const byKey = new Map<string, WorkspaceMatch>();
  for (const m of emailMatches) {
    byKey.set(matchKey(m), m);
  }
  for (const j of joinedMatches) {
    const key = matchKey(j);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...existing,
        alreadyJoined: true,
        projectCount: Math.max(existing.projectCount, j.projectCount),
        segment: existing.segment ?? j.segment,
        workspaceName: existing.workspaceName || j.workspaceName,
        contactDisplayName: existing.contactDisplayName || j.contactDisplayName,
      });
    } else {
      byKey.set(key, j);
    }
  }
  return [...byKey.values()].sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));
}

export async function joinWorkspace(
  supabase: SupabaseClient,
  params: {
    operatorUserId: string;
    contactId: number;
    memberUserId: string;
    source?: "invite" | "email_claim" | "owner_added";
    memberEmail?: string;
    memberName?: string;
  },
): Promise<WorkspaceMembership> {
  const { data, error } = await supabase.rpc("join_workspace", {
    p_operator_user_id: params.operatorUserId,
    p_contact_id: params.contactId,
    p_member_user_id: params.memberUserId,
    p_source: params.source ?? "email_claim",
    p_member_email: params.memberEmail ?? null,
    p_member_name: params.memberName ?? null,
  });

  if (error) throw error;

  const row = data as {
    id: number;
    operator_user_id: string;
    member_user_id: string;
    contact_id: number;
    status: WorkspaceMembership["status"];
    source: WorkspaceMembership["source"];
    created_at: string;
    updated_at: string;
  };

  return {
    id: row.id,
    operatorUserId: row.operator_user_id,
    memberUserId: row.member_user_id,
    contactId: row.contact_id,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function revokeWorkspaceMembership(
  supabase: SupabaseClient,
  membershipId: number,
  operatorUserId: string,
): Promise<void> {
  const { error } = await supabase.rpc("revoke_workspace_membership", {
    p_membership_id: membershipId,
    p_operator_user_id: operatorUserId,
  });
  if (error) throw error;
}

export async function fetchMembershipForContact(
  supabase: SupabaseClient,
  operatorUserId: string,
  contactId: number,
): Promise<WorkspaceMembership | null> {
  const { data, error } = await supabase
    .from("workspace_memberships")
    .select("*")
    .eq("operator_user_id", operatorUserId)
    .eq("contact_id", contactId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as number,
    operatorUserId: data.operator_user_id as string,
    memberUserId: data.member_user_id as string,
    contactId: data.contact_id as number,
    status: data.status as WorkspaceMembership["status"],
    source: data.source as WorkspaceMembership["source"],
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export type MemberInboxEvent = WorkspaceMemberEvent & {
  workspaceName: string;
};

export async function fetchUnreadMemberInboxEvents(
  supabase: SupabaseClient,
  memberUserId: string,
): Promise<MemberInboxEvent[]> {
  const { data, error } = await supabase
    .from("workspace_member_events")
    .select("*")
    .eq("member_user_id", memberUserId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (error.message.includes("workspace_member_events")) return [];
    throw error;
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const operatorIds = [...new Set(rows.map((r) => r.operator_user_id as string))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, workspace_name, company_name, full_name")
    .in("id", operatorIds);

  const nameByOperator = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      workspaceDisplayName({
        workspaceName: p.workspace_name as string | null,
        companyName: p.company_name as string | null,
        fullName: p.full_name as string | null,
        fallback: "Team workspace",
      }),
    ]),
  );

  return rows.map((row) => ({
    id: row.id as number,
    operatorUserId: row.operator_user_id as string,
    memberUserId: (row.member_user_id as string | null) ?? null,
    contactId: (row.contact_id as number | null) ?? null,
    eventType: row.event_type as WorkspaceMemberEvent["eventType"],
    memberEmail: (row.member_email as string | null) ?? null,
    memberName: (row.member_name as string | null) ?? null,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
    workspaceName: nameByOperator.get(row.operator_user_id as string) ?? "Team workspace",
  }));
}

export async function markMemberInboxEventsRead(
  supabase: SupabaseClient,
  memberUserId: string,
  eventIds: number[],
): Promise<void> {
  if (eventIds.length === 0) return;
  const { error } = await supabase
    .from("workspace_member_events")
    .update({ read_at: new Date().toISOString() })
    .eq("member_user_id", memberUserId)
    .in("id", eventIds);
  if (error) throw error;
}

export async function fetchUnreadMemberEvents(
  supabase: SupabaseClient,
  operatorUserId: string,
): Promise<WorkspaceMemberEvent[]> {
  const { data, error } = await supabase
    .from("workspace_member_events")
    .select("*")
    .eq("operator_user_id", operatorUserId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (error.message.includes("workspace_member_events")) return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as number,
    operatorUserId: row.operator_user_id as string,
    memberUserId: (row.member_user_id as string | null) ?? null,
    contactId: (row.contact_id as number | null) ?? null,
    eventType: row.event_type as WorkspaceMemberEvent["eventType"],
    memberEmail: (row.member_email as string | null) ?? null,
    memberName: (row.member_name as string | null) ?? null,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

/** Joined + pending workspace matches for the signed-in user (email-based RPC). */
export async function fetchMemberWorkspaceTeams(
  supabase: SupabaseClient,
  memberUserId: string,
  email: string,
): Promise<WorkspaceMatch[]> {
  let emailMatches: WorkspaceMatch[] = [];
  try {
    emailMatches = await findWorkspacesForEmail(supabase, email, memberUserId);
  } catch {
    /* RPC missing or blocked — still return active memberships below */
  }
  const joinedMatches = await fetchJoinedTeamsForMember(supabase, memberUserId);
  return mergeWorkspaceMatches(emailMatches, joinedMatches);
}

/** Active workspace memberships for the signed-in member (direct DB lookup). */
export async function fetchJoinedTeamsForMember(
  supabase: SupabaseClient,
  memberUserId: string,
): Promise<WorkspaceMatch[]> {
  const { data: memberships, error } = await supabase
    .from("workspace_memberships")
    .select("operator_user_id, contact_id")
    .eq("member_user_id", memberUserId)
    .eq("status", "active");

  if (error) {
    if (error.message.includes("workspace_memberships")) return [];
    throw error;
  }

  const rows = memberships ?? [];
  if (rows.length === 0) return [];

  const results: WorkspaceMatch[] = [];

  for (const row of rows) {
    const operatorUserId = row.operator_user_id as string;
    const contactId = row.contact_id as number;

    const [{ data: profile }, { data: contact }, projectQuery] = await Promise.all([
      supabase
        .from("profiles")
        .select("workspace_name, company_name, full_name")
        .eq("id", operatorUserId)
        .maybeSingle(),
      supabase
        .from("contacts")
        .select("name, company_name, role")
        .eq("id", contactId)
        .eq("user_id", operatorUserId)
        .maybeSingle(),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", operatorUserId),
    ]);

    const role = (contact?.role as string | undefined) ?? "Team";
    const segment = segmentFromContactRole(role);
    const workspaceName = workspaceDisplayName({
      workspaceName: profile?.workspace_name as string | null,
      companyName: profile?.company_name as string | null,
      fullName: profile?.full_name as string | null,
      contactCompanyName: contact?.company_name as string | null,
      contactName: contact?.name as string | null,
      fallback: "Team workspace",
    });
    const contactDisplayName =
      (contact?.company_name as string | null)?.trim() ||
      (contact?.name as string | null)?.trim() ||
      workspaceName;

    results.push({
      operatorUserId,
      contactId,
      workspaceName,
      contactDisplayName,
      projectCount: projectQuery.count ?? 0,
      alreadyJoined: true,
      segment,
    });
  }

  return results.sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));
}

export async function markMemberEventsRead(
  supabase: SupabaseClient,
  operatorUserId: string,
  eventIds: number[],
): Promise<void> {
  if (eventIds.length === 0) return;
  const { error } = await supabase
    .from("workspace_member_events")
    .update({ read_at: new Date().toISOString() })
    .eq("operator_user_id", operatorUserId)
    .in("id", eventIds);
  if (error) throw error;
}
