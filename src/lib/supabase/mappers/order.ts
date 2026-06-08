import type { ProjectOrder } from "@/lib/types/wip";
import type { ProjectOrderRowDb } from "@/lib/supabase/types-db";

export function projectOrderFromRow(row: ProjectOrderRowDb): ProjectOrder {
  const linked = row.linked_order_ids;
  return {
    id: row.id,
    project_id: row.project_id,
    order_number: row.order_number,
    due_date: row.due_date,
    po_number: row.po_number,
    client_po_number: row.client_po_number,
    linked_order_ids: Array.isArray(linked) ? (linked as string[]) : [],
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

export function projectOrderToRow(
  order: ProjectOrder,
  userId: string,
): Omit<ProjectOrderRowDb, "created_at"> & { created_at?: string } {
  return {
    id: order.id,
    user_id: userId,
    project_id: order.project_id,
    order_number: order.order_number,
    due_date: order.due_date,
    po_number: order.po_number ?? null,
    client_po_number: order.client_po_number ?? null,
    linked_order_ids: order.linked_order_ids ?? [],
    updated_at: order.updated_at,
    created_at: order.created_at,
  };
}
