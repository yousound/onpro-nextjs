import type { Project } from "@/lib/types/project";
import type { ProjectJob, WipStep } from "@/lib/types/wip";
import { getProjectById } from "@/lib/mock/projects";
import { buildDemoJobs } from "@/lib/mock/generated/demo-jobs";
import { buildEmptyProjectTimeline, buildProjectTimeline, buildProjectTimelineFromJobs } from "@/lib/wip-project-timeline";

/** Demo jobs ship without pre-filled timeline progress — use “Apply template” in the job modal. */
function emptyDemoJobTimeline(): WipStep[] {
  return [];
}

const demoJobs = buildDemoJobs(emptyDemoJobTimeline, emptyDemoJobTimeline);

export function getJobsForProject(projectId: number): ProjectJob[] {
  return demoJobs.filter((j) => j.project_id === projectId);
}

/** Project WIP strip: from all jobs when present, else from `Project` date fields. */
export function getProjectTimeline(projectId: number, project?: Project, jobs?: ProjectJob[]): WipStep[] {
  const p = project ?? getProjectById(projectId);
  if (!p) return buildEmptyProjectTimeline();
  const jobList = jobs ?? getJobsForProject(projectId);
  if (jobList.length) return buildProjectTimelineFromJobs(p, jobList);
  return buildProjectTimeline(p);
}
