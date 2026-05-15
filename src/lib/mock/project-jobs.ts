import type { Project } from "@/lib/types/project";
import type { ProjectJob, WipStep } from "@/lib/types/wip";
import { getProjectById } from "@/lib/mock/projects";
import { buildEmptyProjectTimeline, buildProjectTimeline } from "@/lib/wip-project-timeline";

function oliveJobTimeline(): WipStep[] {
  return [
    { id: "tp_setup", label: "Tech pack", state: "completed" },
    { id: "blanks", label: "Blanks", state: "completed" },
    { id: "trims", label: "Trims", state: "completed" },
    { id: "tp_done", label: "TP complete", state: "completed" },
    { id: "quote", label: "Quote / costing", state: "completed" },
    { id: "lab_dip", label: "Lab dip", state: "completed" },
    { id: "strike", label: "Strike-off", state: "in_progress" },
    { id: "bulk_fabric", label: "Bulk fabric", state: "upcoming" },
    { id: "top", label: "TOP", state: "upcoming" },
    { id: "ex_factory", label: "Ex-factory", state: "upcoming" },
  ];
}

function upcomingJobTimeline(): WipStep[] {
  return [
    { id: "tp_setup", label: "Tech pack", state: "completed" },
    { id: "blanks", label: "Blanks", state: "completed" },
    { id: "trims", label: "Trims", state: "upcoming" },
    { id: "tp_done", label: "TP complete", state: "upcoming" },
    { id: "quote", label: "Quote / costing", state: "upcoming" },
    { id: "lab_dip", label: "Lab dip", state: "upcoming" },
    { id: "strike", label: "Strike-off", state: "upcoming" },
    { id: "bulk_fabric", label: "Bulk fabric", state: "upcoming" },
    { id: "top", label: "TOP", state: "upcoming" },
    { id: "ex_factory", label: "Ex-factory", state: "upcoming" },
  ];
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
      timeline: upcomingJobTimeline(),
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
      timeline: upcomingJobTimeline(),
      scope_kind: "addon",
      scope_note: "+50 units after initial invoice — keep on same build",
    },
  ],
};

export function getJobsForProject(projectId: number): ProjectJob[] {
  return jobsByProject[projectId] ?? [];
}

/** Full Connect Dots project WIP strip; states derived from `Project` date fields when possible. */
export function getProjectTimeline(projectId: number, project?: Project): WipStep[] {
  const p = project ?? getProjectById(projectId);
  if (!p) return buildEmptyProjectTimeline();
  return buildProjectTimeline(p);
}
