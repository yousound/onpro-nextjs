import type { PendingInviteRow, ResolvedInvite } from "@/lib/types/workspace";
import type { PeopleSegment } from "@/lib/types/contact";
import type { ProjectPermissionFlags } from "@/lib/project-permissions";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const INVITE_TTL_DAYS = 14;

function inviteToken(): string {
  return randomBytes(24).toString("base64url");
}

function rowFromDb(row: Record<string, unknown>): PendingInviteRow {
  return {
    id: row.id as string,
    token: row.token as string,
    operatorUserId: row.operator_user_id as string,
    contactId: row.contact_id as number,
    email: row.email as string,
    segment: row.segment as PeopleSegment,
    invitedLabel: (row.invited_label as string | null) ?? null,
    permissions: (row.permissions as ProjectPermissionFlags | null) ?? null,
    redirectAfter: (row.redirect_after as string | null) ?? null,
    expiresAt: row.expires_at as string,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** Login URL for a pending invite — client vs team/vendor (member) onboarding paths. */
export function buildInviteLoginUrl(
  origin: string,
  token: string,
  segment: PeopleSegment,
  redirectAfter?: string,
): string {
  const url = new URL("/login", origin);
  const defaultNext = "/";
  const next = redirectAfter?.trim() || defaultNext;
  url.searchParams.set("kind", segment === "client" ? "client" : "member");
  url.searchParams.set("signup", "1");
  url.searchParams.set("token", token);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function createPendingInvite(
  supabase: SupabaseClient,
  params: {
    operatorUserId: string;
    contactId: number;
    email: string;
    segment: PeopleSegment;
    invitedLabel?: string;
    permissions?: ProjectPermissionFlags;
    redirectAfter?: string;
  },
): Promise<{ invite: PendingInviteRow; loginUrl: string }> {
  const token = inviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

  const { data, error } = await supabase
    .from("pending_invites")
    .insert({
      token,
      operator_user_id: params.operatorUserId,
      contact_id: params.contactId,
      email: params.email.trim(),
      segment: params.segment,
      invited_label: params.invitedLabel ?? null,
      permissions: params.permissions ?? null,
      redirect_after: params.redirectAfter ?? null,
      expires_at: expiresAt.toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;

  await supabase
    .from("contacts")
    .update({ invite_status: "invited", updated_at: new Date().toISOString() })
    .eq("id", params.contactId)
    .eq("user_id", params.operatorUserId);

  const invite = rowFromDb(data as Record<string, unknown>);
  return { invite, loginUrl: "" };
}

export async function fetchPendingInvitesForOperator(
  supabase: SupabaseClient,
  operatorUserId: string,
): Promise<PendingInviteRow[]> {
  const { data, error } = await supabase
    .from("pending_invites")
    .select("*")
    .eq("operator_user_id", operatorUserId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("pending_invites")) return [];
    throw error;
  }

  return (data ?? []).map((row) => rowFromDb(row as Record<string, unknown>));
}

export async function resolveInviteToken(
  supabase: SupabaseClient,
  token: string,
): Promise<ResolvedInvite> {
  const { data, error } = await supabase.rpc("resolve_invite_token", {
    p_token: token.trim(),
  });

  if (error) {
    if (error.message.includes("resolve_invite_token") || error.message.includes("pending_invites")) {
      return { valid: false };
    }
    throw error;
  }

  const rows = (data as Record<string, unknown>[] | null) ?? [];
  if (rows.length === 0) return { valid: false };

  const row = rows[0];
  if (Boolean(row.expired)) return { valid: false, expired: true };
  if (Boolean(row.accepted)) return { valid: false, accepted: true };

  return {
    valid: true,
    email: row.email as string,
    segment: row.segment as PeopleSegment,
    redirectAfter: (row.redirect_after as string | null) ?? null,
    workspaceName: row.workspace_name as string,
    contactDisplayName: row.contact_display_name as string,
    operatorUserId: row.operator_user_id as string,
    contactId: row.contact_id as number,
  };
}

export async function acceptPendingInvite(
  supabase: SupabaseClient,
  token: string,
  memberUserId: string,
  memberEmail: string,
  memberName?: string,
): Promise<void> {
  const resolved = await resolveInviteToken(supabase, token);
  if (!resolved.valid || !resolved.operatorUserId || !resolved.contactId) {
    throw new Error("Invite invalid or expired");
  }

  const { joinWorkspace } = await import("@/lib/supabase/workspace-memberships");
  await joinWorkspace(supabase, {
    operatorUserId: resolved.operatorUserId,
    contactId: resolved.contactId,
    memberUserId,
    source: "invite",
    memberEmail,
    memberName,
  });

  await supabase
    .from("pending_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("token", token.trim());
}

export async function deletePendingInvite(
  supabase: SupabaseClient,
  operatorUserId: string,
  inviteId: string,
): Promise<void> {
  const { error } = await supabase
    .from("pending_invites")
    .delete()
    .eq("id", inviteId)
    .eq("operator_user_id", operatorUserId);
  if (error) throw error;
}

export async function loginUrlForPendingInvite(
  supabase: SupabaseClient,
  operatorUserId: string,
  inviteId: string,
  origin: string,
  options?: { refreshExpiry?: boolean },
): Promise<string> {
  const { data, error } = await supabase
    .from("pending_invites")
    .select("token, segment, redirect_after, expires_at, accepted_at")
    .eq("id", inviteId)
    .eq("operator_user_id", operatorUserId)
    .maybeSingle();

  if (error || !data) throw new Error("Invite not found");

  if (data.accepted_at) throw new Error("Invite already accepted");

  const expiresAt = new Date(data.expires_at as string);
  if (expiresAt < new Date()) {
    if (!options?.refreshExpiry) {
      throw new Error("Invite expired — use Resend to extend and get a new link");
    }
    const renewed = new Date();
    renewed.setDate(renewed.getDate() + INVITE_TTL_DAYS);
    const { error: renewError } = await supabase
      .from("pending_invites")
      .update({ expires_at: renewed.toISOString() })
      .eq("id", inviteId)
      .eq("operator_user_id", operatorUserId);
    if (renewError) throw renewError;
  } else if (options?.refreshExpiry) {
    const renewed = new Date();
    renewed.setDate(renewed.getDate() + INVITE_TTL_DAYS);
    await supabase
      .from("pending_invites")
      .update({ expires_at: renewed.toISOString() })
      .eq("id", inviteId)
      .eq("operator_user_id", operatorUserId);
  }

  return buildInviteLoginUrl(
    origin,
    data.token as string,
    data.segment as PeopleSegment,
    (data.redirect_after as string | null) ?? undefined,
  );
}

export function pendingInviteToUiRow(invite: PendingInviteRow): {
  id: string;
  email: string;
  segment: PeopleSegment;
  invited_label: string;
  sent_at: string;
} {
  return {
    id: invite.id,
    email: invite.email,
    segment: invite.segment,
    invited_label: invite.invitedLabel ?? `${invite.segment} invite`,
    sent_at: invite.createdAt.slice(0, 10),
  };
}
