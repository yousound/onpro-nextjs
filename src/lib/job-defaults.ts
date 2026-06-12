import type { BulkProductionTrack, Project, Sample } from "@/lib/types/project";
import type { CostingSheet, ProjectJob } from "@/lib/types/wip";
import { emptyCostingSheet } from "@/lib/costing-sheet";
import {
  defaultBulkProductionTrack,
  defaultCostingExtraTrack,
  defaultDyeCostingTrack,
  defaultPrintEmbroideryTrack,
} from "@/lib/project-repeatable-tracks";
import { defaultSampleApprovalStages, resolveSampleApprovalStages } from "@/lib/job-development";
import { repairJobTimelineWithTemplate } from "@/lib/job-timeline-templates";

export function defaultJobEstimate(project?: Project): NonNullable<ProjectJob["estimate"]> {
  return {
    quote_requested_date: project?.quote_requested_date ?? null,
    vendor_costing_received_date: project?.vendor_costing_received_date ?? null,
    references_sent_date: project?.references_sent_date ?? null,
    mock_up_notes: null,
  };
}

export function defaultJobCosting(project?: Project): NonNullable<ProjectJob["costing"]> {
  return {
    cost_sheet_prepared_date: project?.cost_sheet_prepared_date ?? null,
    estimate_sent_date: project?.estimate_sent_date ?? null,
    costing_approved: project?.costing_approved ?? null,
    costing_approved_at: null,
    blanks_purchased_date: null,
    pg_requested_date: null,
    blanks_received_date: null,
    dye_costing_tracks: [defaultDyeCostingTrack()],
    trim_line_tracks: [],
    sample_approval_stages: defaultSampleApprovalStages(),
    print_embroidery_costing_tracks: [defaultPrintEmbroideryTrack()],
    costing_extra_tracks: [defaultCostingExtraTrack()],
    colorways: project?.colorways?.length
      ? project.colorways.map((c) => ({ ...c, samples: [...c.samples] }))
      : [{ id: 1, name: "Colorway 1", samples: [] }],
  };
}

export function defaultJobApprovals(project?: Project): NonNullable<ProjectJob["approvals"]> {
  return {
    strike_off_request_date: project?.strike_off_request_date ?? null,
    strike_off_due_date: project?.strike_off_due_date ?? null,
    strike_off_received_date: project?.strike_off_received_date ?? null,
    strike_off_approval_status: project?.strike_off_approval_status ?? null,
    sent_to_contractors_date: project?.tp_sent_date ?? null,
  };
}

export function defaultJobTechPack(project?: Project): NonNullable<ProjectJob["tech_pack"]> {
  const due = project?.cs_tech_pack_due_date ?? project?.artwork_tech_pack_due_date ?? null;
  const complete =
    project?.cs_tech_pack_complete_date ?? project?.artwork_tech_pack_complete_date ?? null;
  return {
    tech_pack_due_date: due,
    tech_pack_complete_date: complete,
    cs_tech_pack_request_date: project?.cs_tech_pack_request_date ?? null,
    cs_tech_pack_due_date: due,
    cs_tech_pack_complete_date: complete,
    artwork_tech_pack_request_date: project?.artwork_tech_pack_request_date ?? null,
    artwork_tech_pack_due_date: due,
    artwork_tech_pack_complete_date: complete,
    artwork_files: [],
    dropbox_links: [],
  };
}

export function defaultJobFulfillment(project?: Project): NonNullable<ProjectJob["fulfillment"]> {
  return {
    packing_list_received_date: project?.packing_list_received_date ?? null,
    packing_list_sent_to_client_date: project?.packing_list_sent_to_client_date ?? null,
    client_received_date: project?.client_received_date ?? null,
  };
}

export function defaultJobBulkTracks(project?: Project): BulkProductionTrack[] {
  if (project?.bulk_production_tracks?.length) {
    return project.bulk_production_tracks.map((t) => ({ ...t }));
  }
  return [defaultBulkProductionTrack("Production schedule 1")];
}

export function defaultCostingSheet(job?: ProjectJob): CostingSheet {
  return emptyCostingSheet(
    job?.job_type === "cut_sew" ? "print_production" : "print_production",
    "USA",
  );
}

function backfillSample(s: Sample): Sample {
  return {
    ...s,
    requested_date: s.requested_date ?? null,
    due_date: s.due_date ?? null,
  };
}

function isDemoLabelArtifact(line: { id?: string }): boolean {
  return String(line.id ?? "").startsWith("demo-");
}

function isDemoLabelFile(file: { id?: string; url?: string }): boolean {
  const id = String(file.id ?? "");
  const url = String(file.url ?? "").trim();
  return id.startsWith("demo-") || url === "#";
}

/** Merge persisted job with defaults for new fields (backward compat). */
export function normalizeJob(job: ProjectJob, project?: Project): ProjectJob {
  const labelLines = (job.label_lines ?? []).filter((l) => !isDemoLabelArtifact(l)).map((l) => ({ ...l }));
  const labelFiles = (job.label_files ?? []).filter((f) => !isDemoLabelFile(f)).map((f) => ({ ...f }));

  return {
    ...job,
    scope_kind: job.scope_kind ?? "original",
    job_type: job.job_type ?? (project !== undefined ? "print_production" : job.job_type),
    colorway: job.colorway ?? "",
    color_code: job.color_code ?? "",
    barcode: job.barcode ?? "",
    po_number: job.po_number ?? null,
    label_files: labelFiles,
    label_lines: labelLines,
    estimate: { ...defaultJobEstimate(project), ...job.estimate },
    costing: {
      ...defaultJobCosting(project),
      ...job.costing,
      colorways: (job.costing?.colorways ?? defaultJobCosting(project).colorways).map((cw) => ({
        ...cw,
        samples: cw.samples.map(backfillSample),
      })),
      dye_costing_tracks:
        job.costing?.dye_costing_tracks?.length
          ? job.costing.dye_costing_tracks
          : defaultJobCosting(project).dye_costing_tracks,
      trim_line_tracks: job.costing?.trim_line_tracks ?? defaultJobCosting(project).trim_line_tracks,
      sample_approval_stages: resolveSampleApprovalStages(job.costing?.sample_approval_stages),
      print_embroidery_costing_tracks:
        job.costing?.print_embroidery_costing_tracks?.length
          ? job.costing.print_embroidery_costing_tracks
          : defaultJobCosting(project).print_embroidery_costing_tracks,
      costing_extra_tracks:
        job.costing?.costing_extra_tracks?.length
          ? job.costing.costing_extra_tracks
          : defaultJobCosting(project).costing_extra_tracks,
    },
    approvals: { ...defaultJobApprovals(project), ...job.approvals },
    tech_pack: { ...defaultJobTechPack(project), ...job.tech_pack },
    fulfillment: { ...defaultJobFulfillment(project), ...job.fulfillment },
    bulk_production_tracks:
      job.bulk_production_tracks?.length
        ? job.bulk_production_tracks
        : defaultJobBulkTracks(project),
    vendor_quotes: job.vendor_quotes ?? [],
    costing_sheet: job.costing_sheet ?? defaultCostingSheet(job),
    estimates: job.estimates ?? [],
    timeline: repairJobTimelineWithTemplate(job.timeline, job.job_type ?? "print_production"),
  };
}
