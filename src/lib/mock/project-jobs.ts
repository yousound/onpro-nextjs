import type { Project } from "@/lib/types/project";
import type { ProjectJob, WipStep, WipStepState } from "@/lib/types/wip";
import { getProjectById } from "@/lib/mock/projects";
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
  m["trimming"] = "in_progress";
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

const jobsByProject: Record<number, ProjectJob[]> = {
  1: [
    {
      id: "job-1-olive",
      project_id: 1,
      name: "Olive capsule",
      subtitle: "Print / Decoration on blanks",
      type: "PRINT / DECORATION ON BLANKS",
      lead_vendor: "CA",
      category: "SWEATSHIRT",
      style_number: "GGP15-OLV",
      status: "In progress",
      due_date: "2026-06-20T12:00:00.000Z",
      updated_at: "2026-05-12T12:00:00.000Z",
      timeline: oliveJobTimeline(),
      scope_kind: "original",
    },
    {
      id: "job-1-indigo",
      project_id: 1,
      name: "Washed indigo denim",
      subtitle: "Print / Decoration on blanks",
      type: "PRINT / DECORATION ON BLANKS",
      lead_vendor: "CA",
      category: "SWEATSHIRT",
      style_number: "GGP15-IND",
      status: "Upcoming",
      due_date: "2026-07-01T12:00:00.000Z",
      updated_at: "2026-05-08T12:00:00.000Z",
      timeline: laggingJobTimeline(),
      scope_kind: "original",
    },
    {
      id: "job-1-black",
      project_id: 1,
      name: "Washed black denim — rush add-on",
      subtitle: "Print / Decoration on blanks",
      type: "PRINT / DECORATION ON BLANKS",
      lead_vendor: "CA",
      category: "SWEATSHIRT",
      style_number: "GGP15-BLK",
      status: "Upcoming",
      due_date: "2026-07-08T12:00:00.000Z",
      updated_at: "2026-05-08T12:00:00.000Z",
      timeline: laggingJobTimeline(),
      scope_kind: "addon",
      scope_note: "+50 units after initial invoice — keep on same build",
    },
  ],
};

export function getJobsForProject(projectId: number): ProjectJob[] {
  return jobsByProject[projectId] ?? [];
}

/** Project WIP strip: from all jobs when present, else from `Project` date fields. */
export function getProjectTimeline(projectId: number, project?: Project, jobs?: ProjectJob[]): WipStep[] {
  const p = project ?? getProjectById(projectId);
  if (!p) return buildEmptyProjectTimeline();
  if (jobs?.length) return buildProjectTimelineFromJobs(p, jobs);
  return buildProjectTimeline(p);
}
