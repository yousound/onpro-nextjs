import { isLiveBackendEnabled } from "@/lib/config/backend";
import { loadProjectOrders, saveProjectOrders } from "@/lib/project-order-edits";
import { fetchOrdersForProjectFromSupabase, upsertProjectOrderToSupabase } from "@/lib/supabase/orders";
import type { Project } from "@/lib/types/project";
import type { ProjectOrder } from "@/lib/types/wip";

export async function fetchOrdersForProject(
  projectId: number,
  project?: Project,
): Promise<ProjectOrder[]> {
  if (!(await isLiveBackendEnabled())) {
    return loadProjectOrders(projectId, project);
  }
  return fetchOrdersForProjectFromSupabase(projectId);
}

export function persistOrdersForProject(projectId: number, orders: ProjectOrder[]): void {
  saveProjectOrders(projectId, orders);
}

export async function persistOrderToDb(order: ProjectOrder, userId: string): Promise<ProjectOrder> {
  return upsertProjectOrderToSupabase(order, userId);
}
