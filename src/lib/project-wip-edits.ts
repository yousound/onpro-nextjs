import type { Project } from "@/lib/types/project";
import type { ProjectJob, WipStep, WipStepState } from "@/lib/types/wip";
import { normalizeJob } from "@/lib/job-defaults";
import { generateJobNumberForProject } from "@/lib/job-number";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedJobs, seedLiveJobsForProject } from "@/lib/data/live-cache";
import { withoutDemoSeedJobs } from "@/lib/mock/demo-seed-jobs";
import { readSessionProjects } from "@/lib/mock/project-session";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { repairJobTimeline } from "@/lib/wip-project-timeline";

function normalizeLoadedJob(seed: ProjectJob, patch: ProjectJob | undefined, project?: Project): ProjectJob {
  const seedTimeline = seed.timeline.map((s) => ({ ...s }));
  const mergedTimeline = repairJobTimeline(patch?.timeline, seedTimeline);
  if (!patch) {
    return normalizeJob({ ...seed, timeline: mergedTimeline }, project);
  }
  return normalizeJob(
    {
      ...seed,
      ...patch,
      timeline: mergedTimeline,
    },
    project,
  );
}

function backfillJobNumbers(jobs: ProjectJob[], project?: Project): ProjectJob[] {
  if (!project) return jobs;
  const assigned: ProjectJob[] = [];
  let needsWrite = false;
  for (const j of jobs) {
    if (j.job_number?.trim()) {
      assigned.push(j);
      continue;
    }
    const next = generateJobNumberForProject(project, assigned);
    assigned.push({ ...j, job_number: next });
    needsWrite = true;
  }
  return needsWrite ? assigned : jobs;
}

function readStoredProjectJobs(projectId: number, project?: Project): ProjectJob[] {
  const saved = readMockLs<ProjectJob[]>(MOCK_LS.projectJobs(projectId));
  if (!Array.isArray(saved) || saved.length === 0) return [];
  const filtered = withoutDemoSeedJobs(saved);
  if (filtered.length !== saved.length) {
    writeMockLs(MOCK_LS.projectJobs(projectId), filtered);
  }
  if (filtered.length === 0) return [];
  const normalized = filtered.map((j) => normalizeLoadedJob(j, undefined, project));
  return backfillJobNumbers(normalized, project);
}

export function loadProjectJobs(projectId: number, project?: Project): ProjectJob[] {
  if (isClientLiveBackend()) {
    const cached = withoutDemoSeedJobs(getLiveCachedJobs(projectId));
    if (cached.length > 0) return cached;
    const stored = readStoredProjectJobs(projectId, project);
    if (stored.length > 0) {
      seedLiveJobsForProject(projectId, stored);
    }
    return stored;
  }
  return readStoredProjectJobs(projectId, project);
}

export function saveProjectJobs(projectId: number, jobs: ProjectJob[]) {
  const cleaned = withoutDemoSeedJobs(jobs);
  writeMockLs(MOCK_LS.projectJobs(projectId), cleaned);
  if (isClientLiveBackend()) {
    seedLiveJobsForProject(projectId, cleaned);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("onpro-jobs-changed"));
  }
}

/** Total jobs across known projects (server list, session, and local storage). */
export function countJobsAcrossProjects(
  projects: Project[],
  initialJobsByProject?: Record<number, ProjectJob[]>,
): number {
  const ids = new Set<number>();
  for (const p of projects) ids.add(p.id);
  if (typeof window !== "undefined") {
    for (const p of readSessionProjects()) ids.add(p.id);
  }

  let total = 0;
  for (const id of ids) {
    const project = projects.find((p) => p.id === id);
    const loaded = loadProjectJobs(id, project);
    if (loaded.length > 0) {
      total += loaded.length;
      continue;
    }
    total += initialJobsByProject?.[id]?.length ?? 0;
  }
  return total;
}

export function loadProjectTimelineSteps(projectId: number, _project?: Project, jobs?: ProjectJob[]): WipStep[] {
  const saved = readMockLs<WipStep[]>(MOCK_LS.projectTimeline(projectId));
  if (saved?.length) return saved.map((s) => ({ ...s }));
  if (jobs?.length) {
    return jobs.flatMap((j) => j.timeline.map((s) => ({ ...s })));
  }
  return [];
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
