import type {
  BulkProductionTrack,
  CostingExtraTrack,
  DyeCostingTrack,
  PrintEmbroideryCostingTrack,
  Project,
} from "@/lib/types/project";

export function newTrackId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${suffix}`;
}

export function defaultDyeCostingTrack(): DyeCostingTrack {
  return {
    id: newTrackId("dye"),
    dye_vendor: null,
    lab_dip_request_date: null,
    lab_dip_due_date: null,
    lab_dip_received_date: null,
    lab_dip_approval_status: null,
  };
}

export function defaultPrintEmbroideryTrack(): PrintEmbroideryCostingTrack {
  return {
    id: newTrackId("print"),
    print_embroidery_vendor: null,
    strike_off_request_date: null,
    strike_off_due_date: null,
    strike_off_received_date: null,
    strike_off_approval_status: null,
  };
}

export function defaultCostingExtraTrack(): CostingExtraTrack {
  return {
    id: newTrackId("cost-extra"),
    section_title: "Additional costing",
    vendor_name: null,
    milestone_1_date: null,
    milestone_2_date: null,
    milestone_3_date: null,
    approval_status: null,
  };
}

export function defaultBulkProductionTrack(title: string): BulkProductionTrack {
  return {
    id: newTrackId("bulk"),
    title,
    bulk_fabric_approval_date: null,
    bulk_trim_approval_date: null,
    new_product_request_date: null,
    barcodes_sent_to_vendor_date: null,
    top_due_date: null,
    top_approved_date: null,
    bulk_target_delivery_date: null,
    ex_factory_date: null,
  };
}

/** Uses persisted tracks when present; otherwise one synthetic row from legacy single-project fields. */
export function resolveDyeCostingTracks(project: Project): DyeCostingTrack[] {
  if (project.dye_costing_tracks && project.dye_costing_tracks.length > 0) {
    return project.dye_costing_tracks;
  }
  return [
    {
      id: "dye-primary",
      dye_vendor: project.dye_vendor,
      lab_dip_request_date: project.lab_dip_request_date,
      lab_dip_due_date: project.lab_dip_due_date,
      lab_dip_received_date: project.lab_dip_received_date,
      lab_dip_approval_status: project.lab_dip_approval_status,
    },
  ];
}

export function resolvePrintEmbroideryTracks(project: Project): PrintEmbroideryCostingTrack[] {
  if (project.print_embroidery_costing_tracks && project.print_embroidery_costing_tracks.length > 0) {
    return project.print_embroidery_costing_tracks;
  }
  return [
    {
      id: "print-primary",
      print_embroidery_vendor: project.print_embroidery_vendor,
      strike_off_request_date: project.strike_off_request_date,
      strike_off_due_date: project.strike_off_due_date,
      strike_off_received_date: project.strike_off_received_date,
      strike_off_approval_status: project.strike_off_approval_status,
    },
  ];
}

export function resolveCostingExtraTracks(project: Project): CostingExtraTrack[] {
  return project.costing_extra_tracks?.length ? project.costing_extra_tracks : [];
}

export function resolveBulkProductionTracks(project: Project): BulkProductionTrack[] {
  if (project.bulk_production_tracks && project.bulk_production_tracks.length > 0) {
    return project.bulk_production_tracks;
  }
  return [
    {
      id: "bulk-primary",
      title: "Primary production run",
      bulk_fabric_approval_date: project.bulk_fabric_approval_date,
      bulk_trim_approval_date: project.bulk_trim_approval_date,
      new_product_request_date: project.new_product_request_date,
      barcodes_sent_to_vendor_date: project.barcodes_sent_to_vendor_date,
      top_due_date: project.top_due_date,
      top_approved_date: project.top_approved_date,
      bulk_target_delivery_date: project.bulk_target_delivery_date,
      ex_factory_date: project.ex_factory_date,
    },
  ];
}

export function updateDyeTrack(tracks: DyeCostingTrack[], id: string, patch: Partial<DyeCostingTrack>): DyeCostingTrack[] {
  return tracks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t));
}

export function updatePrintEmbTrack(
  tracks: PrintEmbroideryCostingTrack[],
  id: string,
  patch: Partial<PrintEmbroideryCostingTrack>,
): PrintEmbroideryCostingTrack[] {
  return tracks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t));
}

export function updateCostingExtraTrack(
  tracks: CostingExtraTrack[],
  id: string,
  patch: Partial<CostingExtraTrack>,
): CostingExtraTrack[] {
  return tracks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t));
}

export function updateBulkTrack(tracks: BulkProductionTrack[], id: string, patch: Partial<BulkProductionTrack>): BulkProductionTrack[] {
  return tracks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t));
}
