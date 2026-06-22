import type { Project } from "@/lib/types/project";
import type { ProjectOrder } from "@/lib/types/wip";
import { generateOrderNumber } from "@/lib/order-number";
import { normalizePo, orderPoNumbers } from "@/lib/po-duplicate";
import { collectAllPoNumbers, generatePoNumber, projectPoNumber } from "@/lib/po-number";
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
  const projectPo = projectPoNumber(project);
  const usedOnProject = new Set<string>();
  for (const order of existingOrders) {
    for (const value of orderPoNumbers(order)) {
      usedOnProject.add(value);
    }
  }

  let po: string;
  let clientPo: string | null = null;
  if (
    existingOrders.length === 0 &&
    projectPo != null &&
    !usedOnProject.has(normalizePo(projectPo))
  ) {
    po = projectPo;
    clientPo = projectPo;
  } else {
    const allUsed = [...existingPos, ...usedOnProject];
    po = generatePoNumber(clientCode, allUsed);
    if (projectPo != null && !usedOnProject.has(normalizePo(projectPo))) {
      clientPo = projectPo;
    }
  }

  return {
    id: `order-${project.id}-${Date.now()}`,
    project_id: project.id,
    order_number: generateOrderNumber(operatorCode, existingOrders),
    due_date: project.due_date ?? null,
    po_number: po,
    client_po_number: clientPo,
    linked_order_ids: [],
    created_at: now,
    updated_at: now,
  };
}
