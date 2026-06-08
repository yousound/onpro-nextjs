import { createClient } from "@/lib/supabase/server";
import { projectOrderFromRow, projectOrderToRow } from "@/lib/supabase/mappers/order";
import type { ProjectOrderRowDb } from "@/lib/supabase/types-db";
import type { ProjectOrder } from "@/lib/types/wip";

export async function fetchOrdersForProjectFromSupabase(
  projectId: number,
): Promise<ProjectOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
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

export async function upsertProjectOrderToSupabase(
  order: ProjectOrder,
  userId: string,
): Promise<ProjectOrder> {
  const supabase = await createClient();
  const row = projectOrderToRow(order, userId);
  const { data, error } = await supabase.from("project_orders").upsert(row).select("*").single();
  if (error) throw error;
  return projectOrderFromRow(data as ProjectOrderRowDb);
}
