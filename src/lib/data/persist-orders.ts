import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { seedLiveOrdersForProject } from "@/lib/data/live-cache";
import type { ProjectOrder } from "@/lib/types/wip";

/** Sync all orders for a project to Supabase in Live mode. */
export async function syncOrdersToDb(
  projectId: number,
  orders: ProjectOrder[],
): Promise<ProjectOrder[] | null> {
  if (!isClientLiveBackend()) return null;

  const res = await fetch(`/api/projects/${projectId}/orders`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orders }),
  });
  const data = (await res.json()) as { error?: string; orders?: ProjectOrder[] };
  if (!res.ok) {
    console.error("[syncOrdersToDb]", data.error ?? res.statusText);
    throw new Error(data.error ?? "Could not save orders");
  }
  if (!data.orders) return null;
  seedLiveOrdersForProject(projectId, data.orders);
  return data.orders;
}

export async function fetchOrdersFromDb(projectId: number): Promise<ProjectOrder[] | null> {
  if (!isClientLiveBackend()) return null;

  const res = await fetch(`/api/projects/${projectId}/orders`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { orders?: ProjectOrder[] };
  if (!Array.isArray(data.orders)) return null;
  seedLiveOrdersForProject(projectId, data.orders);
  return data.orders;
}
