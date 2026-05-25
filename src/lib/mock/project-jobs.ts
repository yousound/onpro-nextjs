import type { Project } from "@/lib/types/project";
import type { ProjectJob, WipStep, WipStepState } from "@/lib/types/wip";
import { getProjectById } from "@/lib/mock/projects";
import { buildDemoJobs } from "@/lib/mock/generated/demo-jobs";
import { CONNECT_DOTS_PROJECT_WIP_STEPS, buildEmptyProjectTimeline, buildProjectTimeline, buildProjectTimelineFromJobs } from "@/lib/wip-project-timeline";

function jobTimelineFromStates(stepStatesById: Partial<Record<string, WipStepState>>): WipStep[] {
  return CONNECT_DOTS_PROJECT_WIP_STEPS.map((def) => ({
    id: def.id,
    label: def.label,
    durationShort: def.durationShort,
    durationLabel: def.durationLabel,
    state: stepStatesById[def.id] ?? "upcoming",
  }));
}

/** Lead style — far along; used with lagging jobs to demo roll-up. */
function oliveJobTimeline(): WipStep[] {
  const doneThrough = new Set([
    "vendor_inquiries",
    "mock_up",
    "cost_sheets",
    "costing_summary",
    "deposit_payment",
    "tp_setup",
    "blanks_lab_dip",
    "order_trims",
    "tp_completion",
    "sent_to_contractors",
    "strike_off",
  ]);
  const m: Partial<Record<string, WipStepState>> = {};
  doneThrough.forEach((id) => {
    m[id] = "completed";
  });
  m.trimming = "in_progress";
  return jobTimelineFromStates(m);
}

/** Slower lines — still before blanks / lab dip so project frontier sits earlier. */
function laggingJobTimeline(): WipStep[] {
  return jobTimelineFromStates({
    vendor_inquiries: "completed",
    mock_up: "completed",
    cost_sheets: "completed",
    costing_summary: "completed",
    deposit_payment: "completed",
    tp_setup: "completed",
  });
}

const demoJobs = buildDemoJobs(oliveJobTimeline, laggingJobTimeline);

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
