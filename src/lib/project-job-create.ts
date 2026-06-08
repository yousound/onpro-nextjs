import type { Project } from "@/lib/types/project";
import type { JobType, ProjectJob } from "@/lib/types/wip";
import { generateJobNumberForProject } from "@/lib/job-number";

/** Seed for Job Details when adding a job (Projects or message attachments). */
export function createNewJobSeed(
  project: Project,
  jobs: ProjectJob[],
  jobType?: JobType,
  orderId?: string,
): ProjectJob {
  return {
    id: `job-${project.id}-${Date.now()}`,
    project_id: project.id,
    order_id: orderId,
    job_number: generateJobNumberForProject(project, jobs),
    name: "",
    subtitle: "",
    type: "",
    job_type: jobType,
    lead_vendor: "",
    category: "",
    style_number: "",
    colorway: "",
    po_number: null,
    client_po_number: null,
    status: "Upcoming",
    due_date: null,
    updated_at: new Date().toISOString(),
    scope_kind: "original",
    scope_note: "",
    timeline: [],
  };
}
