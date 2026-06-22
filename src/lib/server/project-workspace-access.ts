import type { SupabaseClient } from "@supabase/supabase-js";
import { assertCanWriteOperatorWorkspace } from "@/lib/server/workspace-write-access";

/** Operator who owns this project (RLS must allow the caller to read the row). */
export async function fetchAccessibleProjectOperator(
  supabase: SupabaseClient,
  projectId: number,
): Promise<{ operatorUserId: string } | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.user_id) return null;
  return { operatorUserId: data.user_id as string };
}

/** Always persist WIP rows under the project owner — not the active workspace cookie alone. */
export async function resolveProjectWriteOperator(
  supabase: SupabaseClient,
  authUserId: string,
  projectId: number,
): Promise<string> {
  const access = await fetchAccessibleProjectOperator(supabase, projectId);
  if (!access) {
    throw new Error("Project not found or you do not have access.");
  }
  await assertCanWriteOperatorWorkspace(supabase, authUserId, access.operatorUserId);
  return access.operatorUserId;
}
