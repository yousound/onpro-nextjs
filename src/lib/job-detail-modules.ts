import { colorwayRowTotal } from "@/lib/job-colorways";
import { accordionSectionsFor } from "@/lib/job-timeline-templates";
import type { JobDetailsSection, JobType, ProjectJob } from "@/lib/types/wip";

export type JobDetailModuleKind =
  | "color_sizing"
  | "development"
  | "print_embroidery"
  | "cut_sew_samples";

export type JobDetailModule = {
  id: string;
  kind: JobDetailModuleKind;
};

export const JOB_DETAIL_MODULE_KINDS: JobDetailModuleKind[] = [
  "color_sizing",
  "development",
  "print_embroidery",
  "cut_sew_samples",
];

export const JOB_DETAIL_MODULE_LABELS: Record<JobDetailModuleKind, string> = {
  color_sizing: "Color & sizing",
  development: "Production specs",
  print_embroidery: "Print / embroidery",
  cut_sew_samples: "Colorways & samples",
};

export function isJobDetailModuleKind(value: string): value is JobDetailModuleKind {
  return (JOB_DETAIL_MODULE_KINDS as readonly string[]).includes(value);
}

export function detailModulesForJobType(jobType?: JobType): JobDetailModuleKind[] {
  const allowed = new Set(accordionSectionsFor(jobType));
  return JOB_DETAIL_MODULE_KINDS.filter((kind) => allowed.has(kind));
}

function newModuleId(kind: JobDetailModuleKind): string {
  return `mod-${kind}-${Date.now().toString(36)}`;
}

export function createDetailModule(kind: JobDetailModuleKind): JobDetailModule {
  return { id: newModuleId(kind), kind };
}

export function hasColorSizingData(job: ProjectJob): boolean {
  if (job.colorway?.trim()) return true;
  const rows = job.colorway_rows ?? [];
  return rows.some(
    (row) =>
      row.name?.trim() ||
      row.color_code?.trim() ||
      colorwayRowTotal(row) > 0,
  );
}

function hasDevelopmentData(job: ProjectJob): boolean {
  const est = job.estimate;
  const tp = job.tech_pack;
  const costing = job.costing;
  const hasSampleData = costing?.sample_approval_stages?.some(
    (s) => s.requested_date || s.due_date || s.status,
  );
  return Boolean(
    est?.references_sent_date ||
      est?.mock_up_notes?.trim() ||
      tp?.tech_pack_due_date ||
      tp?.tech_pack_complete_date ||
      (tp?.artwork_files?.length ?? 0) > 0 ||
      (tp?.dropbox_links?.length ?? 0) > 0 ||
      (costing?.trim_line_tracks?.length ?? 0) > 0 ||
      hasSampleData ||
      costing?.blanks_purchased_date ||
      costing?.pg_requested_date ||
      costing?.blanks_received_date,
  );
}

export function inferDetailModules(job: ProjectJob): JobDetailModule[] {
  if (job.detail_modules?.length) return job.detail_modules;

  const allowed = new Set(detailModulesForJobType(job.job_type));
  const modules: JobDetailModule[] = [];

  if (allowed.has("color_sizing") && hasColorSizingData(job)) {
    modules.push({ id: "mod-color_sizing", kind: "color_sizing" });
  }
  if (allowed.has("development") && hasDevelopmentData(job)) {
    modules.push({ id: "mod-development", kind: "development" });
  }
  if (
    allowed.has("print_embroidery") &&
    (job.costing?.print_embroidery_costing_tracks?.length ?? 0) > 0
  ) {
    modules.push({ id: "mod-print_embroidery", kind: "print_embroidery" });
  }
  if (allowed.has("cut_sew_samples") && (job.costing?.colorways?.length ?? 0) > 0) {
    modules.push({ id: "mod-cut_sew_samples", kind: "cut_sew_samples" });
  }

  return modules;
}

export function ensureDetailModule(
  modules: JobDetailModule[],
  kind: JobDetailModuleKind,
): JobDetailModule[] {
  if (modules.some((m) => m.kind === kind)) return modules;
  return [...modules, createDetailModule(kind)];
}

export function nestedDetailSection(section: JobDetailsSection): section is JobDetailModuleKind {
  return isJobDetailModuleKind(section);
}
