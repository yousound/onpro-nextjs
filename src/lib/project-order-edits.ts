import type { Project } from "@/lib/types/project";
import type { ProjectJob, ProjectOrder } from "@/lib/types/wip";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedOrders, getLiveCachedProjects, seedLiveOrdersForProject } from "@/lib/data/live-cache";
import { readMockLs, writeMockLs, MOCK_LS } from "@/lib/mock-local";
import { readSessionProjects } from "@/lib/mock/project-session";
import { createNewOrderSeed } from "@/lib/project-order-create";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";

export function loadProjectOrders(projectId: number): ProjectOrder[] {
  if (isClientLiveBackend()) {
    return getLiveCachedOrders(projectId);
  }
  return readStoredProjectOrders(projectId);
}

function readStoredProjectOrders(projectId: number): ProjectOrder[] {
  const saved = readMockLs<ProjectOrder[]>(MOCK_LS.projectOrders(projectId));
  return Array.isArray(saved) ? saved : [];
}

/** Browser-only orders from before Supabase sync — used once to migrate live workspaces. */
export function readLegacyStoredProjectOrders(projectId: number): ProjectOrder[] {
  return readStoredProjectOrders(projectId);
}

export function saveProjectOrders(projectId: number, orders: ProjectOrder[]) {
  if (isClientLiveBackend()) {
    seedLiveOrdersForProject(projectId, orders);
    void import("@/lib/data/persist-orders")
      .then(({ syncOrdersToDb }) => syncOrdersToDb(projectId, orders))
      .then((saved) => {
        if (saved) seedLiveOrdersForProject(projectId, saved);
      })
      .catch((err) => {
        console.error("[saveProjectOrders] sync failed", err);
      });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("onpro-orders-changed"));
    }
    return;
  }
  writeMockLs(MOCK_LS.projectOrders(projectId), orders);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("onpro-orders-changed"));
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

/** All orders in the active workspace — used for operator-wide order number allocation. */
export function loadWorkspaceOrders(): ProjectOrder[] {
  if (isClientLiveBackend()) {
    const projects = getLiveCachedProjects();
    if (projects.length === 0) return [];
    return loadAllOrdersAcrossProjects(projects.map((p) => p.id));
  }
  const ids = new Set<number>();
  for (const p of readSessionProjects()) ids.add(p.id);
  if (typeof window !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith("onpro.mock.v1.projectOrders.")) continue;
        const id = Number(key.replace("onpro.mock.v1.projectOrders.", ""));
        if (Number.isFinite(id) && id > 0) ids.add(id);
      }
    } catch {
      /* ignore */
    }
  }
  return loadAllOrdersAcrossProjects([...ids]);
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
  const workspaceOrders = loadWorkspaceOrders();
  const order = createNewOrderSeed(
    project,
    existingOrders,
    operatorCode,
    allProjects,
    jobPos,
    workspaceOrders,
  );
  const next = [...existingOrders, order];
  saveProjectOrders(projectId, next);
  backfillOrphanJobOrderIds(projectId, next);
  return order;
}

/** @deprecated Prefer explicit createFirstProjectOrder — no longer auto-creates on project load. */
export function ensureDefaultOrders(projectId: number): ProjectOrder[] {
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

export function loadAllOrdersAcrossProjects(projectIds: number[]): ProjectOrder[] {
  const all: ProjectOrder[] = [];
  for (const id of projectIds) {
    all.push(...loadProjectOrders(id));
  }
  return all;
}

export function ordersForProject(projectId: number, orders: ProjectOrder[]): ProjectOrder[] {
  return orders.filter((o) => o.project_id === projectId);
}

export function jobsForOrder(orderId: string, jobs: ProjectJob[]): ProjectJob[] {
  return jobs.filter((j) => j.order_id === orderId);
}
