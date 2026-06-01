import type {
  ApprovalStatus,
  BulkProductionTrack,
  Colorway,
  CostingExtraTrack,
  DyeCostingTrack,
  ISODate,
  PrintEmbroideryCostingTrack,
} from "@/lib/types/project";
import type { FileRef } from "@/lib/types/contact";

export type JobType =
  | "print_production"
  | "cut_sew"
  | "full_package"
  | "design"
  | "branding"
  | "custom";

export type JobDetailsSection =
  | "overview"
  | "estimate"
  | "development"
  | "costing"
  | "approvals"
  | "bulk";

export type JobLabelLine = {
  id: string;
  size: string;
  style_color_code: string;
  description: string;
  scan_value: string;
  /** Optional category label (e.g. "FITTED TEE") used to compose the bottom sticker line. */
  category_label?: string;
  /** Optional colorway name (e.g. "Baby Pink") used to compose the bold top sticker line. */
  colorway_name?: string;
  /** Optional 3-letter color code (e.g. "BPK") used to compose both sticker lines. */
  color_code?: string;
  /** Optional bare style number (e.g. "FT28127") used to compose both sticker lines. */
  style_number?: string;
};

/** Connect Dots–style mobile station carton label (size qty grid + header fields). */
export type LabelStationSheet = {
  brand: string;
  style: string;
  color: string;
  po_number: string;
  box_number: string;
  weight: string;
  size_qty: Record<string, string>;
  /** Manual override; when empty, sum of size quantities is used. */
  total_units: string;
  box_total: string;
};

export type JobEstimateFields = {
  quote_requested_date: ISODate;
  vendor_costing_received_date: ISODate;
  references_sent_date: ISODate;
  mock_up_notes: string | null;
};

/** Inbound pricing line from a vendor for this job (the vendor's "estimate" to us). */
export type VendorQuote = {
  id: string;
  vendor: string;
  item_description: string;
  unit_cost: number;
  qty: number;
  notes?: string;
  received_at: ISODate;
  source?: { kind: "email"; email_id: string } | { kind: "manual" };
};

/** A single row on the internal Costing Sheet (becomes a line on the client Estimate). */
export type CostingLine = {
  id: string;
  description: string;
  vendor: string | null;
  vendor_quote_id?: string;
  cost: number;
  margin_mode: "percent" | "amount";
  margin_value: number;
  price: number;
  qty: number;
  note?: string;
};

export type CostingMadeIn = "USA" | "China" | "Other" | null;
export type CostingType = "print_production" | "full_package";

export type CostingSheet = {
  costing_type: CostingType;
  made_in: CostingMadeIn;
  lines: CostingLine[];
  aggregate_margin_mode: "percent" | "amount" | null;
  aggregate_margin_value: number;
  estimated_qty: number;
  notes?: string;
};

export type EstimateStatus = "draft" | "sent" | "accepted" | "rejected";

export type Estimate = {
  id: string;
  job_id: string;
  document_number: string;
  /** Snapshot of the costing sheet at the moment the estimate was generated. */
  costing_sheet_snapshot: CostingSheet;
  sent_at?: ISODate;
  status: EstimateStatus;
  created_at: ISODate;
};

export type JobCostingFields = {
  cost_sheet_prepared_date: ISODate;
  estimate_sent_date: ISODate;
  costing_approved: boolean | null;
  /** @deprecated read/write via JobDevelopmentFields; kept here for back-compat. */
  blanks_purchased_date: ISODate;
  /** @deprecated read/write via JobDevelopmentFields. */
  pg_requested_date: ISODate;
  /** @deprecated read/write via JobDevelopmentFields. */
  dye_costing_tracks: DyeCostingTrack[];
  print_embroidery_costing_tracks: PrintEmbroideryCostingTrack[];
  costing_extra_tracks: CostingExtraTrack[];
  /** Absorbed from former Cut & sew tab */
  colorways: Colorway[];
};

/**
 * Logical "Development" surface — a view over the underlying costing/bulk fields.
 * Edits go through `patchDevelopment` (see lib/job-development.ts) so all existing
 * consumers (production board, project module panels) continue to see the data.
 */
export type JobDevelopmentFields = {
  blanks_purchased_date: ISODate;
  pg_requested_date: ISODate;
  dye_costing_tracks: DyeCostingTrack[];
  /** From bulk_production_tracks[0] — surfaced under Development per the email feedback. */
  new_product_request_date: ISODate;
  barcodes_sent_to_vendor_date: ISODate;
  bulk_trim_approval_date: ISODate;
};

export type JobApprovalFields = {
  strike_off_request_date: ISODate;
  strike_off_due_date: ISODate;
  strike_off_received_date: ISODate;
  strike_off_approval_status: ApprovalStatus | null;
  sent_to_contractors_date: ISODate;
};

export type TechPackFile = {
  id: string;
  name: string;
  size_bytes: number;
  /** base64 data URL stored in localStorage; optional for large files. */
  data_url?: string;
  uploaded_at: ISODate;
};

export type TechPackDropboxLink = {
  id: string;
  label: string;
  url: string;
};

export type JobTechPackFields = {
  cs_tech_pack_request_date: ISODate;
  cs_tech_pack_due_date: ISODate;
  cs_tech_pack_complete_date: ISODate;
  artwork_tech_pack_request_date: ISODate;
  artwork_tech_pack_due_date: ISODate;
  artwork_tech_pack_complete_date: ISODate;
  /** Uploaded artwork / tech-pack files (mock: base64 in localStorage). */
  artwork_files?: TechPackFile[];
  /** Dropbox (or any URL) links to artwork sources. */
  dropbox_links?: TechPackDropboxLink[];
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
  /** Human-readable job identifier per project, e.g. "GG-26-001". Auto-assigned. */
  job_number?: string;
  name: string;
  subtitle: string;
  type: string;
  job_type?: JobType;
  lead_vendor: string;
  category: string;
  style_number: string;
  colorway?: string;
  /** Optional 3-letter color suffix override (e.g. BLK). Otherwise derived from colorway name. */
  color_code?: string;
  barcode?: string;
  /** Effective PO used downstream — equals client_po_number if set, else our generated PO. */
  po_number?: string | null;
  /** PO supplied by the client; when present this becomes the effective PO. */
  client_po_number?: string | null;
  label_files?: FileRef[];
  label_lines?: JobLabelLine[];
  label_station?: LabelStationSheet;
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
  /** Inbound vendor quotes per job — feed into the costing sheet. */
  vendor_quotes?: VendorQuote[];
  /** Internal costing worksheet (mirrors the cost-sheet xlsx layout). */
  costing_sheet?: CostingSheet;
  /** Generated client-facing estimates (one or more snapshots of the sheet). */
  estimates?: Estimate[];
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
    case "tp_completion":
      return "costing";
    case "tp_setup":
    case "blanks_lab_dip":
    case "order_trims":
      return "development";
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
