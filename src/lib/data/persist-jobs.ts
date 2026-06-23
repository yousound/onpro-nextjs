import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedOrders, seedLiveJobsForProject } from "@/lib/data/live-cache";
import type { ProjectJob } from "@/lib/types/wip";

/** Sync all jobs for a project to Supabase in Live mode (orders first when cached). */
export async function syncJobsToDb(
  projectId: number,
  jobs: ProjectJob[],
): Promise<ProjectJob[] | null> {
  if (!isClientLiveBackend()) return null;

  const orders = getLiveCachedOrders(projectId);

  const res = await fetch(`/api/projects/${projectId}/jobs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobs, orders }),
  });
  const data = (await res.json()) as { error?: string; jobs?: ProjectJob[] };
  if (!res.ok) {
    console.error("[syncJobsToDb]", data.error ?? res.statusText);
    throw new Error(data.error ?? "Could not save jobs");
  }
  if (!data.jobs) return null;
  seedLiveJobsForProject(projectId, data.jobs, { allowEmpty: true });
  return data.jobs;
}

export async function fetchJobsFromDb(projectId: number): Promise<ProjectJob[] | null> {
  if (!isClientLiveBackend()) return null;

  const res = await fetch(`/api/projects/${projectId}/jobs`, { cache: "no-store" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    console.error("[fetchJobsFromDb]", data.error ?? res.statusText);
    return null;
  }
  const data = (await res.json()) as { jobs?: ProjectJob[] };
  if (!Array.isArray(data.jobs)) return null;
  seedLiveJobsForProject(projectId, data.jobs);
  return data.jobs;
}
