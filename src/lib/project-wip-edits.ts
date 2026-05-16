import type { Project } from "@/lib/types/project";
import type { ProjectJob, WipStep, WipStepState } from "@/lib/types/wip";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { getJobsForProject, getProjectTimeline } from "@/lib/mock/project-jobs";

export function loadProjectJobs(projectId: number): ProjectJob[] {
  const seed = getJobsForProject(projectId);
  const saved = readMockLs<ProjectJob[]>(MOCK_LS.projectJobs(projectId));
  if (!saved?.length) return seed.map((j) => ({ ...j, timeline: j.timeline.map((s) => ({ ...s })) }));
  const byId = new Map(saved.map((j) => [j.id, j]));
  return seed.map((j) => {
    const patch = byId.get(j.id);
    if (!patch) return { ...j, timeline: j.timeline.map((s) => ({ ...s })) };
    return {
      ...j,
      ...patch,
      timeline: (patch.timeline ?? j.timeline).map((s) => ({ ...s })),
    };
  });
}

export function saveProjectJobs(projectId: number, jobs: ProjectJob[]) {
  writeMockLs(MOCK_LS.projectJobs(projectId), jobs);
}

export function loadProjectTimelineSteps(projectId: number, project?: Project, jobs?: ProjectJob[]): WipStep[] {
  const seed = getProjectTimeline(projectId, project, jobs);
  const saved = readMockLs<WipStep[]>(MOCK_LS.projectTimeline(projectId));
  if (!saved?.length) return seed.map((s) => ({ ...s }));
  const byId = new Map(saved.map((s) => [s.id, s]));
  return seed.map((s) => {
    const patch = byId.get(s.id);
    if (!patch) return { ...s };
    return {
      ...s,
      state: s.state,
      durationShort: patch.durationShort ?? s.durationShort,
      durationLabel: patch.durationLabel ?? s.durationLabel,
    };
  });
}

export function saveProjectTimelineSteps(projectId: number, steps: WipStep[]) {
  writeMockLs(MOCK_LS.projectTimeline(projectId), steps);
}

export function patchJob(jobs: ProjectJob[], jobId: string, patch: Partial<ProjectJob>): ProjectJob[] {
  return jobs.map((j) => (j.id === jobId ? { ...j, ...patch, updated_at: new Date().toISOString() } : j));
}

export function patchJobStep(
  jobs: ProjectJob[],
  jobId: string,
  stepId: string,
  patch: Partial<WipStep>,
): ProjectJob[] {
  return jobs.map((j) =>
    j.id !== jobId
      ? j
      : {
          ...j,
          timeline: j.timeline.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
          updated_at: new Date().toISOString(),
        },
  );
}

export function patchProjectStep(steps: WipStep[], stepId: string, patch: Partial<WipStep>): WipStep[] {
  return steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s));
}

export const WIP_STEP_STATES: WipStepState[] = ["completed", "in_progress", "upcoming", "na"];

export const JOB_STATUS_OPTIONS: ProjectJob["status"][] = ["In progress", "Upcoming", "Completed"];

export type ProjectHeaderDraft = {
  name: string;
  status: Project["status"];
  status_overview: string;
  project_number: string;
  hand_off_ymd: string;
  due_date_ymd: string;
  status_update_ymd: string;
};
