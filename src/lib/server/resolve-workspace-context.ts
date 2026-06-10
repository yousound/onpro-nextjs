import { cookies } from "next/headers";
import {
  ACTIVE_WORKSPACE_COOKIE,
  parseActiveWorkspaceCookie,
  type WorkspaceView,
} from "@/lib/workspace-context";
import { fetchJoinedTeamsForMember } from "@/lib/supabase/workspace-memberships";
import { fetchProfile } from "@/lib/supabase/profile";
import { workspaceDisplayName } from "@/lib/workspace-display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Operator `user_id` whose workspace data should load (self or joined team). */
export async function resolveWorkspaceOwnerId(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<string> {
  const jar = await cookies();
  const requested = parseActiveWorkspaceCookie(jar.get(ACTIVE_WORKSPACE_COOKIE)?.value);
  if (!requested || requested === authUserId) return authUserId;

  const { data, error } = await supabase
    .from("workspace_memberships")
    .select("id")
    .eq("operator_user_id", requested)
    .eq("member_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return authUserId;
  return requested;
}

export async function resolveWorkspaceView(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<WorkspaceView> {
  const ownerId = await resolveWorkspaceOwnerId(supabase, authUserId);

  if (ownerId === authUserId) {
    const profile = await fetchProfile(supabase, authUserId);
    const workspaceName = workspaceDisplayName({
      workspaceName: profile?.workspace_name,
      companyName: profile?.company_name,
      fullName: profile?.full_name,
      fallback: "My workspace",
    });
    return { mode: "self", operatorUserId: authUserId, workspaceName };
  }

  const teams = await fetchJoinedTeamsForMember(supabase, authUserId);
  const active = teams.find((t) => t.operatorUserId === ownerId);
  if (active) {
    return {
      mode: "team",
      operatorUserId: ownerId,
      workspaceName: active.workspaceName,
      contactId: active.contactId,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_name, company_name, full_name")
    .eq("id", ownerId)
    .maybeSingle();

  return {
    mode: "team",
    operatorUserId: ownerId,
    workspaceName: workspaceDisplayName({
      workspaceName: profile?.workspace_name as string | null,
      companyName: profile?.company_name as string | null,
      fullName: profile?.full_name as string | null,
      fallback: "Team workspace",
    }),
  };
}
