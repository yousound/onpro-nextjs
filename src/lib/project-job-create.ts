import type { Project } from "@/lib/types/project";
import type { JobType, ProjectJob } from "@/lib/types/wip";
import { generateJobNumberForProject } from "@/lib/job-number";
import {
  defaultCostingSheet,
  defaultJobApprovals,
  defaultJobBulkTracks,
  defaultJobCosting,
  defaultJobEstimate,
  defaultJobFulfillment,
  defaultJobTechPack,
  normalizeJob,
} from "@/lib/job-defaults";
import { buildUpcomingJobTimelineForType } from "@/lib/job-timeline-templates";

/** Seed for Job Details when adding a job (Projects or message attachments). */
export function createNewJobSeed(
  project: Project,
  jobs: ProjectJob[],
  jobType?: JobType,
  orderId?: string,
): ProjectJob {
  const resolvedType = jobType ?? "print_production";
  const shell: ProjectJob = {
    id: `job-${project.id}-${Date.now()}`,
    project_id: project.id,
    order_id: orderId,
    job_number: generateJobNumberForProject(project, jobs),
    name: "",
    subtitle: "",
    type: "",
    job_type: resolvedType,
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
    timeline: buildUpcomingJobTimelineForType(resolvedType),
    estimate: defaultJobEstimate(project),
    costing: defaultJobCosting(project),
    approvals: defaultJobApprovals(project),
    tech_pack: defaultJobTechPack(project),
    fulfillment: defaultJobFulfillment(project),
    bulk_production_tracks: defaultJobBulkTracks(project),
    vendor_quotes: [],
    costing_sheet: defaultCostingSheet({ job_type: resolvedType } as ProjectJob),
    estimates: [],
  };
  return normalizeJob(shell, project);
}

export type DuplicateJobOptions = {
  name?: string;
  colorway?: string;
  style_number?: string;
  color_code?: string;
};

/** Clone an existing job with a new id, job number, and reset timeline / PO. */
export function duplicateJobSeed(
  source: ProjectJob,
  project: Project,
  jobs: ProjectJob[],
  opts: DuplicateJobOptions = {},
): ProjectJob {
  const jobType = source.job_type ?? "print_production";
  const clone = structuredClone(source) as ProjectJob;
  const normalized = normalizeJob(clone, project);
  const baseName = source.name?.trim() ?? "";
  return normalizeJob(
    {
      ...normalized,
      id: `job-${project.id}-${Date.now()}`,
      job_number: generateJobNumberForProject(project, jobs),
      name: opts.name?.trim() ?? (baseName ? `${baseName} (Copy)` : ""),
      colorway: opts.colorway?.trim() ?? source.colorway ?? "",
      style_number: opts.style_number?.trim() ?? source.style_number ?? "",
      color_code: opts.color_code?.trim() ?? source.color_code ?? "",
      po_number: null,
      client_po_number: null,
      status: "Upcoming",
      due_date: null,
      updated_at: new Date().toISOString(),
      timeline: buildUpcomingJobTimelineForType(jobType),
    },
    project,
  );
}
