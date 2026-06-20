import type { Project } from "@/lib/types/project";
import type { ProjectJob, ProjectOrder } from "@/lib/types/wip";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedOrders, seedLiveOrdersForProject } from "@/lib/data/live-cache";
import { readMockLs, writeMockLs, MOCK_LS } from "@/lib/mock-local";
import { createNewOrderSeed } from "@/lib/project-order-create";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";

export function loadProjectOrders(projectId: number, _project?: Project): ProjectOrder[] {
  if (isClientLiveBackend()) {
    const cached = getLiveCachedOrders(projectId);
    if (cached.length > 0) return cached;
    const stored = readStoredProjectOrders(projectId);
    if (stored.length > 0) {
      seedLiveOrdersForProject(projectId, stored);
      return stored;
    }
    return [];
  }
  return readStoredProjectOrders(projectId);
}

function readStoredProjectOrders(projectId: number): ProjectOrder[] {
  const saved = readMockLs<ProjectOrder[]>(MOCK_LS.projectOrders(projectId));
  return Array.isArray(saved) ? saved : [];
}

export function saveProjectOrders(projectId: number, orders: ProjectOrder[]) {
  writeMockLs(MOCK_LS.projectOrders(projectId), orders);
  if (isClientLiveBackend()) {
    seedLiveOrdersForProject(projectId, orders);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("onpro-orders-changed"));
    }
  }
}

/** Backfill jobs missing order_id onto the first project order. */
export function backfillOrphanJobOrderIds(projectId: number, orders: ProjectOrder[]): boolean {
  if (orders.length === 0) return false;
  const jobs = loadProjectJobs(projectId);
  if (!jobs.some((j) => !j.order_id)) return false;
  const defaultOrderId = orders[0]!.id;
  saveProjectJobs(
    projectId,
    jobs.map((j) => (j.order_id ? j : { ...j, order_id: defaultOrderId })),
  );
  return true;
}

/** Create the first order when a job is added or the user clicks + New order. */
export function createFirstProjectOrder(
  projectId: number,
  project: Project,
  existingOrders: ProjectOrder[],
  operatorCode: string,
  allProjects: { po_number?: string | null; project_number?: string | null }[] = [],
  jobPos: string[] = [],
): ProjectOrder {
  const order = createNewOrderSeed(project, existingOrders, operatorCode, allProjects, jobPos);
  const next = [...existingOrders, order];
  saveProjectOrders(projectId, next);
  backfillOrphanJobOrderIds(projectId, next);
  return order;
}

/** @deprecated Prefer explicit createFirstProjectOrder — no longer auto-creates on project load. */
export function ensureDefaultOrders(
  projectId: number,
  project: Project,
  operatorCode = "OP",
): ProjectOrder[] {
  const existing = readStoredProjectOrders(projectId);
  if (existing.length > 0) {
    saveProjectOrders(projectId, existing);
    backfillOrphanJobOrderIds(projectId, existing);
    return existing;
  }
  return [];
}

export function getOrCreateOrderForJob(
  projectId: number,
  project: Project,
  existingOrders: ProjectOrder[],
  operatorCode: string,
  allProjects: { po_number?: string | null; project_number?: string | null }[] = [],
): { orders: ProjectOrder[]; orderId: string } {
  if (existingOrders.length > 0) {
    return { orders: existingOrders, orderId: existingOrders[0]!.id };
  }
  const order = createFirstProjectOrder(projectId, project, existingOrders, operatorCode, allProjects);
  return { orders: [...existingOrders, order], orderId: order.id };
}

export function loadAllOrdersAcrossProjects(
  projectIds: number[],
  projectsById: Map<number, Project>,
  _operatorCode: string,
): ProjectOrder[] {
  const all: ProjectOrder[] = [];
  for (const id of projectIds) {
    all.push(...loadProjectOrders(id, projectsById.get(id)));
  }
  return all;
}

export function ordersForProject(projectId: number, orders: ProjectOrder[]): ProjectOrder[] {
  return orders.filter((o) => o.project_id === projectId);
}

export function jobsForOrder(orderId: string, jobs: ProjectJob[]): ProjectJob[] {
  return jobs.filter((j) => j.order_id === orderId);
}
