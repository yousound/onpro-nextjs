import type { DecorationVariant, JobType, ProjectJob } from "@/lib/types/wip";

const LEGACY_JOB_TYPE_MAP: Record<string, JobType> = {
  cut_sew: "full_package_cut_sew",
  full_package: "full_package_cut_sew",
  custom: "full_package_cut_sew",
  embroidery: "decoration",
  design: "artwork_design",
  branding: "branding_kit",
};

const VALID_JOB_TYPES = new Set<string>([
  "print_production",
  "full_package_cut_sew",
  "custom_products",
  "artwork_design",
  "branding_kit",
  "decoration",
  "finishing",
]);

/** Map persisted legacy job_type values to the current enum. */
export function migrateJobTypeFields(job: ProjectJob): ProjectJob {
  const raw = job.job_type as string | undefined;
  if (!raw) {
    return { ...job, job_type: "print_production" };
  }

  const mapped = LEGACY_JOB_TYPE_MAP[raw];
  if (mapped) {
    const next: ProjectJob = { ...job, job_type: mapped };
    if (raw === "embroidery" && !next.decoration_variant) {
      next.decoration_variant = "embroidery";
    }
    return next;
  }

  if (VALID_JOB_TYPES.has(raw)) {
    return { ...job, job_type: raw as JobType };
  }

  return { ...job, job_type: "print_production" };
}

export function isBrandingClassJobType(type?: JobType): boolean {
  return type === "branding_kit" || type === "artwork_design";
}

export function isCutSewClassJobType(type?: JobType): boolean {
  return type === "full_package_cut_sew" || type === "custom_products";
}

export function isPrintClassJobType(type?: JobType): boolean {
  return type === "print_production" || type === "decoration" || type === "finishing";
}

export type { DecorationVariant };
