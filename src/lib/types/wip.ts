import type {
  ApprovalStatus,
  BulkProductionTrack,
  Colorway,
  CostingExtraTrack,
  DyeCostingTrack,
  ISODate,
  PrintEmbroideryCostingTrack,
} from "@/lib/types/project";

export type JobType =
  | "print_production"
  | "cut_sew"
  | "design"
  | "branding"
  | "custom";

export type JobDetailsSection = "overview" | "estimate" | "costing" | "approvals" | "bulk";

export type JobEstimateFields = {
  quote_requested_date: ISODate;
  vendor_costing_received_date: ISODate;
  references_sent_date: ISODate;
  mock_up_notes: string | null;
};

export type JobCostingFields = {
  cost_sheet_prepared_date: ISODate;
  estimate_sent_date: ISODate;
  costing_approved: boolean | null;
  dye_costing_tracks: DyeCostingTrack[];
  print_embroidery_costing_tracks: PrintEmbroideryCostingTrack[];
  costing_extra_tracks: CostingExtraTrack[];
  /** Absorbed from former Cut & sew tab */
  colorways: Colorway[];
};

export type JobApprovalFields = {
  strike_off_request_date: ISODate;
  strike_off_due_date: ISODate;
  strike_off_received_date: ISODate;
  strike_off_approval_status: ApprovalStatus | null;
  sent_to_contractors_date: ISODate;
};

export type JobTechPackFields = {
  cs_tech_pack_request_date: ISODate;
  cs_tech_pack_due_date: ISODate;
  cs_tech_pack_complete_date: ISODate;
  artwork_tech_pack_request_date: ISODate;
  artwork_tech_pack_due_date: ISODate;
  artwork_tech_pack_complete_date: ISODate;
};

export type JobFulfillmentFields = {
  packing_list_received_date: ISODate;
  packing_list_sent_to_client_date: ISODate;
  client_received_date: ISODate;
};

export type WipStepState = "completed" | "in_progress" | "upcoming" | "na";

export type WipStep = {
  id: string;
  label: string;
  durationShort?: string;
  durationLabel?: string;
  state: WipStepState;
  /** Custom steps: Job Details section to open when the step is tapped. */
  opensIn?: JobDetailsSection;
};

export type JobStatusLabel = "In progress" | "Upcoming" | "Completed";

export type JobScopeKind = "original" | "addon";

export type ProjectJob = {
  id: string;
  project_id: number;
  name: string;
  subtitle: string;
  type: string;
  job_type?: JobType;
  lead_vendor: string;
  category: string;
  style_number: string;
  colorway?: string;
  barcode?: string;
  status: JobStatusLabel;
  due_date: string | null;
  updated_at: string;
  scope_kind?: JobScopeKind;
  scope_note?: string;
  addon_category?: string;
  addon_shirt_sizes?: string[];
  addon_pant_sizes?: string[];
  addon_pant_size_mode?: "alpha" | "numeric";
  addon_custom_note?: string;
  garment_brand?: string;
  garment_style_number?: string;
  garment_color?: string;
  garment_size?: string;
  estimate?: JobEstimateFields;
  costing?: JobCostingFields;
  approvals?: JobApprovalFields;
  tech_pack?: JobTechPackFields;
  fulfillment?: JobFulfillmentFields;
  bulk_production_tracks?: BulkProductionTrack[];
  timeline: WipStep[];
};

export type JobDetailsFocus = {
  section: JobDetailsSection;
  focusStepId?: string;
};

/** Map WIP step id → Job Details accordion section (custom steps may set `opensIn` on the step). */
export function wipStepToSection(stepId: string, opensIn?: JobDetailsSection): JobDetailsSection {
  if (opensIn) return opensIn;
  switch (stepId) {
    case "vendor_inquiries":
    case "mock_up":
      return "estimate";
    case "cost_sheets":
    case "costing_summary":
    case "deposit_payment":
    case "tp_setup":
    case "blanks_lab_dip":
    case "order_trims":
    case "tp_completion":
      return "costing";
    case "sent_to_contractors":
    case "strike_off":
      return "approvals";
    case "trimming":
    case "packing":
    case "arrange_delivery":
    case "completion":
      return "bulk";
    default:
      return "overview";
  }
}

export function jobTimelineEditorLabel(
  job: Pick<ProjectJob, "name" | "style_number" | "colorway" | "subtitle">,
): string {
  const style = job.style_number?.trim();
  const color = job.colorway?.trim();
  if (style && color) return `${style} · ${color}`;
  if (style) return style;
  const name = job.name?.trim();
  if (name) return name;
  const subtitle = job.subtitle?.trim();
  if (subtitle) return subtitle;
  return "Untitled job";
}
