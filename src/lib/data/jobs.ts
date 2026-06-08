import { isLiveBackendEnabled } from "@/lib/config/backend";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";
import { fetchJobsForProjectFromSupabase } from "@/lib/supabase/jobs";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

/** Jobs for a project: Supabase in Live mode, localStorage mocks in Mock mode only. */
export async function fetchJobsForProject(
  projectId: number,
  project?: Project,
): Promise<ProjectJob[]> {
  if (!(await isLiveBackendEnabled())) {
    return loadProjectJobs(projectId, project);
  }
  return fetchJobsForProjectFromSupabase(projectId);
}

export function persistJobsForProject(projectId: number, jobs: ProjectJob[]): void {
  saveProjectJobs(projectId, jobs);
}
