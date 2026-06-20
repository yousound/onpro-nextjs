import type { SupabaseClient } from "@supabase/supabase-js";

/** Team/vendor members who switched into an operator workspace (not the owner). */
export async function isOperatorWorkspaceTeamMember(
  supabase: SupabaseClient,
  authUserId: string,
  operatorUserId: string,
): Promise<boolean> {
  if (authUserId === operatorUserId) return false;

  const { data, error } = await supabase
    .from("workspace_memberships")
    .select("contact_id, contacts(role)")
    .eq("operator_user_id", operatorUserId)
    .eq("member_user_id", authUserId)
    .eq("status", "active")
    .limit(5);

  if (error || !data?.length) return false;

  return data.some((row) => {
    const role = (row.contacts as { role?: string } | null)?.role;
    return role === "Team" || role === "Vendor";
  });
}

export async function assertCanWriteOperatorWorkspace(
  supabase: SupabaseClient,
  authUserId: string,
  operatorUserId: string,
): Promise<void> {
  if (authUserId === operatorUserId) return;

  const allowed = await isOperatorWorkspaceTeamMember(supabase, authUserId, operatorUserId);
  if (!allowed) {
    throw new Error("You do not have permission to change data in this workspace.");
  }
}

export async function assertClientBelongsToOperator(
  supabase: SupabaseClient,
  operatorUserId: string,
  clientId: number,
): Promise<void> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", operatorUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Client not found in this workspace — refresh People and try again.");
  }
}
