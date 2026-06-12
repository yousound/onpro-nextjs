import type { SampleApprovalStage, TrimLineTrack } from "@/lib/types/project";
import type { BulkProductionTrack, DyeCostingTrack } from "@/lib/types/project";
import type { JobDevelopmentFields, JobTechPackFields, ProjectJob } from "@/lib/types/wip";

const DEFAULT_SAMPLE_STAGES: Omit<SampleApprovalStage, "requested_date" | "due_date" | "status">[] = [
  { key: "1st", label: "1st sample" },
  { key: "2nd", label: "2nd sample" },
  { key: "pp", label: "PP sample" },
];

export function defaultSampleApprovalStages(): SampleApprovalStage[] {
  return DEFAULT_SAMPLE_STAGES.map((s) => ({
    ...s,
    requested_date: null,
    due_date: null,
    status: null,
  }));
}

export function resolveSampleApprovalStages(stages?: SampleApprovalStage[]): SampleApprovalStage[] {
  const defaults = defaultSampleApprovalStages();
  if (!stages?.length) return defaults;
  return defaults.map((def) => {
    const hit = stages.find((s) => s.key === def.key);
    return hit ? { ...def, ...hit, key: def.key, label: def.label } : def;
  });
}

/** UI labels for Development sample approval fields (team spec). */
export function sampleApprovalFieldLabels(key: SampleApprovalStage["key"]): {
  requested: string;
  due: string;
  status: string;
} {
  const name = key === "1st" ? "1st sample" : key === "2nd" ? "2nd sample" : "PP sample";
  return {
    requested: `${name} requested`,
    due: `${name} due`,
    status: `${name} status`,
  };
}

/** Pick the canonical Development view off a job. */
export function developmentFromJob(job: ProjectJob): JobDevelopmentFields {
  const c = job.costing;
  return {
    blanks_purchased_date: c?.blanks_purchased_date ?? null,
    pg_requested_date: c?.pg_requested_date ?? null,
    blanks_received_date: c?.blanks_received_date ?? null,
    dye_costing_tracks: c?.dye_costing_tracks ?? [],
    trim_line_tracks: c?.trim_line_tracks ?? [],
    sample_approval_stages: resolveSampleApprovalStages(c?.sample_approval_stages),
  };
}

export function techPackDueDate(tp: JobTechPackFields | undefined): string | null {
  if (!tp) return null;
  return tp.tech_pack_due_date ?? tp.cs_tech_pack_due_date ?? tp.artwork_tech_pack_due_date ?? null;
}

export function techPackCompleteDate(tp: JobTechPackFields | undefined): string | null {
  if (!tp) return null;
  return (
    tp.tech_pack_complete_date ??
    tp.cs_tech_pack_complete_date ??
    tp.artwork_tech_pack_complete_date ??
    null
  );
}

/**
 * Apply a partial Development patch back to a job, routing each field to its underlying location.
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
  if ("blanks_received_date" in partial)
    costingPatch.blanks_received_date = partial.blanks_received_date ?? null;
  if ("dye_costing_tracks" in partial && partial.dye_costing_tracks)
    costingPatch.dye_costing_tracks = partial.dye_costing_tracks as DyeCostingTrack[];
  if ("trim_line_tracks" in partial && partial.trim_line_tracks)
    costingPatch.trim_line_tracks = partial.trim_line_tracks as TrimLineTrack[];
  if ("sample_approval_stages" in partial && partial.sample_approval_stages)
    costingPatch.sample_approval_stages = partial.sample_approval_stages;

  if (Object.keys(costingPatch).length > 0 && next.costing) {
    next.costing = { ...next.costing, ...costingPatch };
  }

  return next;
}

export function applyTechPackPatch(
  job: ProjectJob,
  partial: Partial<JobTechPackFields>,
): ProjectJob {
  const merged = { ...(job.tech_pack ?? {}), ...partial } as JobTechPackFields;
  const tp = { ...merged };
  if ("tech_pack_due_date" in partial) {
    tp.cs_tech_pack_due_date = partial.tech_pack_due_date ?? null;
    tp.artwork_tech_pack_due_date = partial.tech_pack_due_date ?? null;
  }
  if ("tech_pack_complete_date" in partial) {
    tp.cs_tech_pack_complete_date = partial.tech_pack_complete_date ?? null;
    tp.artwork_tech_pack_complete_date = partial.tech_pack_complete_date ?? null;
  }
  return { ...job, tech_pack: tp };
}

export function barcodesSentDate(job: ProjectJob): string | null {
  return job.bulk_production_tracks?.[0]?.barcodes_sent_to_vendor_date ?? null;
}

export function patchBarcodesSentDate(job: ProjectJob, date: string | null): ProjectJob {
  const tracks = [...(job.bulk_production_tracks ?? [])];
  if (tracks.length === 0) {
    tracks.push({
      id: `bulk-${Date.now()}`,
      title: "Primary production run",
      bulk_fabric_approval_date: null,
      bulk_trim_approval_date: null,
      new_product_request_date: null,
      barcodes_sent_to_vendor_date: date,
      top_due_date: null,
      top_approved_date: null,
      trimming_completed_date: null,
      bulk_target_delivery_date: null,
      ex_factory_date: null,
    });
  } else {
    tracks[0] = { ...tracks[0]!, barcodes_sent_to_vendor_date: date };
  }
  return { ...job, bulk_production_tracks: tracks };
}

export function updateTrimLineTrack(
  tracks: TrimLineTrack[],
  id: string,
  patch: Partial<TrimLineTrack>,
): TrimLineTrack[] {
  return tracks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t));
}

export function updateSampleStage(
  stages: SampleApprovalStage[],
  key: SampleApprovalStage["key"],
  patch: Partial<SampleApprovalStage>,
): SampleApprovalStage[] {
  return stages.map((s) => (s.key === key ? { ...s, ...patch, key: s.key, label: s.label } : s));
}

export function updateBulkTrack(
  tracks: BulkProductionTrack[],
  id: string,
  patch: Partial<BulkProductionTrack>,
): BulkProductionTrack[] {
  return tracks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t));
}
