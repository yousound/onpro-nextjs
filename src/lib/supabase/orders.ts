import { supabaseErrorMessage } from "@/lib/id-uuid";
import { projectOrderFromRow, projectOrderToRow } from "@/lib/supabase/mappers/order";
import type { ProjectOrderRowDb } from "@/lib/supabase/types-db";
import type { ProjectOrder } from "@/lib/types/wip";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchOrdersForProjectFromSupabase(
  projectId: number,
): Promise<ProjectOrder[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { fetchAccessibleProjectOperator } = await import("@/lib/server/project-workspace-access");
  const { resolveWipWriteClient } = await import("@/lib/server/wip-write-client");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const access = await fetchAccessibleProjectOperator(supabase, projectId);
  if (!access) return [];

  const readClient = resolveWipWriteClient(supabase);
  const { data, error } = await readClient
    .from("project_orders")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    console.error("[supabase] fetchOrdersForProject", error.message);
    throw error;
  }

  return (data as ProjectOrderRowDb[]).map(projectOrderFromRow);
}

export async function upsertProjectOrderForUser(
  supabase: SupabaseClient,
  order: ProjectOrder,
  userId: string,
): Promise<ProjectOrder> {
  const row = projectOrderToRow(order, userId);
  const { data, error } = await supabase.from("project_orders").upsert(row).select("*").single();
  if (error) throw new Error(supabaseErrorMessage(error));
  return projectOrderFromRow(data as ProjectOrderRowDb);
}

export async function syncProjectOrdersForUser(
  supabase: SupabaseClient,
  projectId: number,
  ownerUserId: string,
  orders: ProjectOrder[],
): Promise<ProjectOrder[]> {
  const saved: ProjectOrder[] = [];
  const keptIds = new Set<string>();

  for (const order of orders) {
    const row = projectOrderToRow(order, ownerUserId);
    const { data, error } = await supabase.from("project_orders").upsert(row).select("*").single();
    if (error) throw new Error(supabaseErrorMessage(error));
    const mapped = projectOrderFromRow(data as ProjectOrderRowDb);
    saved.push(mapped);
    keptIds.add(mapped.id);
  }

  const { data: existing, error: listError } = await supabase
    .from("project_orders")
    .select("id")
    .eq("project_id", projectId);

  if (listError) throw new Error(supabaseErrorMessage(listError));

  const removeIds = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keptIds.has(id));

  if (removeIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("project_orders")
      .delete()
      .in("id", removeIds);
    if (deleteError) throw new Error(supabaseErrorMessage(deleteError));
  }

  return saved;
}

/** @deprecated Use upsertProjectOrderForUser with an explicit client. */
export async function upsertProjectOrderToSupabase(
  order: ProjectOrder,
  userId: string,
): Promise<ProjectOrder> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  return upsertProjectOrderForUser(supabase, order, userId);
}
