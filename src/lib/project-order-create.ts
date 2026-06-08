import type { Project } from "@/lib/types/project";
import type { ProjectOrder } from "@/lib/types/wip";
import { generateOrderNumber } from "@/lib/order-number";
import { collectAllPoNumbers, generatePoNumber } from "@/lib/po-number";
import { resolveClientCode } from "@/lib/reference/client-codes";

export function createNewOrderSeed(
  project: Project,
  existingOrders: ProjectOrder[],
  operatorCode: string,
  allProjects: { po_number?: string | null; project_number?: string | null }[] = [],
  jobPos: string[] = [],
): ProjectOrder {
  const now = new Date().toISOString();
  const clientCode = resolveClientCode(project.client.name);
  const existingPos = collectAllPoNumbers(allProjects, jobPos);
  const po = generatePoNumber(clientCode, existingPos);

  return {
    id: `order-${project.id}-${Date.now()}`,
    project_id: project.id,
    order_number: generateOrderNumber(operatorCode, existingOrders),
    due_date: project.due_date ?? null,
    po_number: po,
    client_po_number: null,
    linked_order_ids: [],
    created_at: now,
    updated_at: now,
  };
}
