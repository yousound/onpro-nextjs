import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { seedLiveOrdersForProject } from "@/lib/data/live-cache";
import { syncJobsToDb } from "@/lib/data/persist-jobs";
import { syncOrdersToDb } from "@/lib/data/persist-orders";
import { clearMockLs, MOCK_LS, readMockLs } from "@/lib/mock-local";
import { withoutDemoSeedJobs } from "@/lib/mock/demo-seed-jobs";
import { readLegacyStoredProjectJobs } from "@/lib/project-wip-edits";
import { readLegacyStoredProjectOrders } from "@/lib/project-order-edits";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

const JOBS_KEY_PREFIX = "onpro.mock.v1.projectJobs.";

/** Project ids with unsynced WIP rows in this browser's localStorage. */
export function legacyWipProjectIds(): number[] {
  if (typeof window === "undefined") return [];
  const ids = new Set<number>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(JOBS_KEY_PREFIX)) continue;
      const id = Number(key.slice(JOBS_KEY_PREFIX.length));
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("onpro.mock.v1.projectOrders.")) continue;
      const id = Number(key.replace("onpro.mock.v1.projectOrders.", ""));
      if (Number.isFinite(id) && id > 0) ids.add(id);
    }
  } catch {
    /* ignore */
  }
  return [...ids].sort((a, b) => a - b);
}

function hasLegacyWip(projectId: number): boolean {
  const jobs = readMockLs<ProjectJob[]>(MOCK_LS.projectJobs(projectId));
  const cleaned = withoutDemoSeedJobs(Array.isArray(jobs) ? jobs : []);
  if (cleaned.length > 0) return true;
  const orders = readLegacyStoredProjectOrders(projectId);
  return orders.length > 0;
}

function clearLegacyWipStorage(projectId: number): void {
  clearMockLs(MOCK_LS.projectJobs(projectId));
  clearMockLs(MOCK_LS.projectOrders(projectId));
}

/**
 * Push browser-only jobs/orders to Supabase for projects in the active workspace.
 * Stale mock keys for other project ids are cleared so we do not hammer the API.
 */
export async function migrateAllLegacyWipFromBrowser(projects: Project[]): Promise<number> {
  if (!isClientLiveBackend()) return 0;
  if (projects.length === 0) return 0;

  const accessibleIds = new Set(projects.map((p) => p.id));
  for (const orphanId of legacyWipProjectIds()) {
    if (!accessibleIds.has(orphanId)) {
      clearLegacyWipStorage(orphanId);
    }
  }

  let migrated = 0;

  for (const project of projects) {
    const projectId = project.id;
    if (!hasLegacyWip(projectId)) continue;
    const legacyOrders = readLegacyStoredProjectOrders(projectId);
    const legacyJobs = readLegacyStoredProjectJobs(projectId, project);
    if (legacyOrders.length === 0 && legacyJobs.length === 0) continue;

    try {
      if (legacyOrders.length > 0) {
        const savedOrders = await syncOrdersToDb(projectId, legacyOrders);
        if (savedOrders) seedLiveOrdersForProject(projectId, savedOrders);
      }
      if (legacyJobs.length > 0) {
        await syncJobsToDb(projectId, legacyJobs);
      }
      clearLegacyWipStorage(projectId);
      migrated += 1;
    } catch (err) {
      console.error("[migrateAllLegacyWip] project", projectId, err);
    }
  }

  return migrated;
}
