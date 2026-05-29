import type { AttachmentComposerDraft } from "@/lib/attachment-composer-draft";
import { JOB_TYPE_OPTIONS } from "@/lib/reference/category-codes";
import type { ProjectJob } from "@/lib/types/wip";
import { jobTimelineEditorLabel } from "@/lib/types/wip";

export function jobTypeDisplayLabel(job: Pick<ProjectJob, "type" | "job_type">): string {
  const rowType = job.type?.trim();
  if (rowType) return rowType;
  if (job.job_type) {
    const hit = JOB_TYPE_OPTIONS.find((o) => o.value === job.job_type);
    if (hit) return hit.label;
  }
  return "";
}

/** Dropdown label — matches project jobs table emphasis. */
export function jobAttachmentOptionLabel(job: ProjectJob): string {
  const style = job.style_number?.trim();
  const name = job.name?.trim() || "Untitled job";
  if (style) return `${style} — ${name}`;
  return name;
}

export function jobAttachmentTitle(job: Pick<ProjectJob, "name" | "style_number">): string {
  return job.name?.trim() || job.style_number?.trim() || "Untitled job";
}

export function jobAttachmentSubtitle(job: ProjectJob): string {
  const styleColor = jobTimelineEditorLabel(job);
  const parts = [
    job.subtitle?.trim(),
    styleColor && styleColor !== job.name?.trim() ? styleColor : null,
    jobTypeDisplayLabel(job),
    job.lead_vendor?.trim(),
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Empty job row for “create new” in message attachments (before save). */
export function blankJobComposerFields(): Pick<
  AttachmentComposerDraft,
  | "jobId"
  | "jobName"
  | "jobSubtitle"
  | "jobType"
  | "jobLeadVendor"
  | "jobCategory"
  | "jobStyleNumber"
  | "jobColorway"
  | "jobPoNumber"
  | "jobStatus"
  | "jobDue"
> {
  return {
    jobId: "",
    jobName: "",
    jobSubtitle: "",
    jobType: "",
    jobLeadVendor: "",
    jobCategory: "",
    jobStyleNumber: "",
    jobColorway: "",
    jobPoNumber: "",
    jobStatus: "",
    jobDue: "",
  };
}

export function draftFieldsFromProjectJob(job: ProjectJob): Pick<
  AttachmentComposerDraft,
  | "jobId"
  | "jobName"
  | "jobSubtitle"
  | "jobType"
  | "jobLeadVendor"
  | "jobCategory"
  | "jobStyleNumber"
  | "jobColorway"
  | "jobPoNumber"
  | "jobStatus"
  | "jobDue"
> {
  return {
    jobId: job.id,
    jobName: job.name,
    jobSubtitle: job.subtitle,
    jobType: jobTypeDisplayLabel(job),
    jobLeadVendor: job.lead_vendor,
    jobCategory: job.category,
    jobStyleNumber: job.style_number,
    jobColorway: job.colorway?.trim() ?? "",
    jobPoNumber: job.po_number?.trim() ?? "",
    jobStatus: job.status,
    jobDue: job.due_date?.slice(0, 10) ?? "",
  };
}

export function findProjectJobForDraft(
  jobs: ProjectJob[],
  draft: Pick<AttachmentComposerDraft, "jobId" | "jobName" | "jobStyleNumber">,
): ProjectJob | undefined {
  if (draft.jobId) {
    const byId = jobs.find((j) => j.id === draft.jobId);
    if (byId) return byId;
  }
  const style = draft.jobStyleNumber?.trim();
  if (style) {
    const byStyle = jobs.find((j) => j.style_number?.trim() === style);
    if (byStyle) return byStyle;
  }
  const name = draft.jobName?.trim();
  if (name) {
    return jobs.find((j) => j.name?.trim() === name);
  }
  return undefined;
}

export function jobAttachmentSelectValue(
  jobs: ProjectJob[],
  jobId: string,
  jobName: string,
): { selectValue: string; inList: boolean; current: string } {
  const current = jobName.trim();
  if (jobId && jobs.some((j) => j.id === jobId)) {
    return { selectValue: jobId, inList: true, current };
  }
  const byName = jobs.find((j) => j.name.trim() === current);
  if (byName) return { selectValue: byName.id, inList: true, current };
  if (current) return { selectValue: `__saved:${current}`, inList: false, current };
  return { selectValue: "", inList: true, current: "" };
}
