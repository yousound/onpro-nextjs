import type { BulkProductionTrack, DyeCostingTrack } from "@/lib/types/project";
import type { JobDevelopmentFields, ProjectJob } from "@/lib/types/wip";

/** Pick the canonical Development view off a job. */
export function developmentFromJob(job: ProjectJob): JobDevelopmentFields {
  const c = job.costing;
  const b = job.bulk_production_tracks?.[0];
  return {
    blanks_purchased_date: c?.blanks_purchased_date ?? null,
    pg_requested_date: c?.pg_requested_date ?? null,
    dye_costing_tracks: c?.dye_costing_tracks ?? [],
    new_product_request_date: b?.new_product_request_date ?? null,
    barcodes_sent_to_vendor_date: b?.barcodes_sent_to_vendor_date ?? null,
    bulk_trim_approval_date: b?.bulk_trim_approval_date ?? null,
  };
}

/**
 * Apply a partial Development patch back to a job, routing each field to its underlying location:
 * - blanks_purchased_date, pg_requested_date, dye_costing_tracks  -> job.costing
 * - new_product_request_date, barcodes_sent_to_vendor_date, bulk_trim_approval_date -> bulk_production_tracks[0]
 */
export function applyDevelopmentPatch(
  job: ProjectJob,
  partial: Partial<JobDevelopmentFields>,
): ProjectJob {
  const next: ProjectJob = { ...job };
  const costingPatch: Partial<NonNullable<ProjectJob["costing"]>> = {};
  if ("blanks_purchased_date" in partial)
    costingPatch.blanks_purchased_date = partial.blanks_purchased_date ?? null;
  if ("pg_requested_date" in partial)
    costingPatch.pg_requested_date = partial.pg_requested_date ?? null;
  if ("dye_costing_tracks" in partial && partial.dye_costing_tracks)
    costingPatch.dye_costing_tracks = partial.dye_costing_tracks as DyeCostingTrack[];

  if (Object.keys(costingPatch).length > 0 && next.costing) {
    next.costing = { ...next.costing, ...costingPatch };
  }

  const bulkKeys: (keyof JobDevelopmentFields)[] = [
    "new_product_request_date",
    "barcodes_sent_to_vendor_date",
    "bulk_trim_approval_date",
  ];
  const touchesBulk = bulkKeys.some((k) => k in partial);
  if (touchesBulk && next.bulk_production_tracks?.[0]) {
    const head = next.bulk_production_tracks[0];
    const headPatch: Partial<BulkProductionTrack> = {};
    if ("new_product_request_date" in partial)
      headPatch.new_product_request_date = partial.new_product_request_date ?? null;
    if ("barcodes_sent_to_vendor_date" in partial)
      headPatch.barcodes_sent_to_vendor_date = partial.barcodes_sent_to_vendor_date ?? null;
    if ("bulk_trim_approval_date" in partial)
      headPatch.bulk_trim_approval_date = partial.bulk_trim_approval_date ?? null;
    next.bulk_production_tracks = [
      { ...head, ...headPatch },
      ...next.bulk_production_tracks.slice(1),
    ];
  }

  return next;
}
