import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import { buildUpcomingJobTimeline } from "@/lib/wip-project-timeline";

/** Seed for Job Details when adding a job (Projects or message attachments). */
export function createNewJobSeed(project: Project, jobs: ProjectJob[]): ProjectJob {
  const template = jobs[0]?.timeline ?? buildUpcomingJobTimeline();
  return {
    id: `job-${project.id}-${Date.now()}`,
    project_id: project.id,
    name: "",
    subtitle: "",
    type: "",
    lead_vendor: "",
    category: "",
    style_number: "",
    colorway: "",
    po_number: null,
    status: "Upcoming",
    due_date: null,
    updated_at: new Date().toISOString(),
    scope_kind: "original",
    scope_note: "",
    timeline: template.map((s) => ({ ...s })),
  };
}
