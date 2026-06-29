import type {
  ApprovalStatus,
  BulkProductionTrack,
  Colorway,
  CostingExtraTrack,
  DyeCostingTrack,
  ISODate,
  PrintEmbroideryCostingTrack,
  SampleApprovalStage,
  TrimLineTrack,
} from "@/lib/types/project";
import type { FileRef } from "@/lib/types/contact";
import type { JobFinishingTask, SuppliedBy } from "@/lib/types/brand-products";

export type JobType =
  | "print_production"
  | "full_package_cut_sew"
  | "custom_products"
  | "artwork_design"
  | "branding_kit"
  | "decoration"
  | "finishing";

export type DecorationVariant =
  | "embroidery"
  | "screen_printing"
  | "heat_transfers"
  | "applique"
  | "patches"
  | "specialty";

export type JobDetailsSection =
  | "overview"
  | "product_details"
  | "brand"
  | "color_sizing"
  | "development"
  | "print_embroidery"
  | "cut_sew_samples"
  | "costing"
  | "approvals"
  | "bulk"
  | "vendor_quotes"
  | "outputs";

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
export type VendorQuoteStatus = "draft" | "sent" | "received";

export type VendorQuote = {
  id: string;
  vendor: string;
  item_description: string;
  unit_cost: number;
  qty: number;
  notes?: string;
  received_at: ISODate;
  source?: { kind: "email"; email_id: string } | { kind: "manual" };
  /** Vendor-facing PO assigned when the quote request is sent (e.g. DW260607-02-01). */
  po_number?: string | null;
  status?: VendorQuoteStatus;
  sent_at?: ISODate;
  /** Job sequence suffix within the project (02 → DW260607-02-01). */
  job_seq?: number;
  line_item_ids?: string[];
  sent_to_email?: string | null;
  cc_emails?: string[];
  mailroom_thread_id?: string | null;
  outbound_message_id?: string | null;
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
  /** When set, overrides computed estimated buy total. */
  estimated_buy_override?: number | null;
  /** When set, overrides computed CD profit total. */
  cd_profit_override?: number | null;
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
  sent_to_email?: string | null;
  cc_emails?: string[];
  mailroom_thread_id?: string | null;
  outbound_message_id?: string | null;
};

export type JobCostingFields = {
  cost_sheet_prepared_date: ISODate;
  estimate_sent_date: ISODate;
  costing_approved: boolean | null;
  /** Set when deposit/payment checkbox is checked. */
  costing_approved_at: ISODate;
  /** @deprecated read/write via JobDevelopmentFields; kept here for back-compat. */
  blanks_purchased_date: ISODate;
  /** @deprecated read/write via JobDevelopmentFields. */
  pg_requested_date: ISODate;
  /** @deprecated read/write via JobDevelopmentFields. */
  dye_costing_tracks: DyeCostingTrack[];
  /** Development — blanks received. */
  blanks_received_date: ISODate;
  trim_line_tracks: TrimLineTrack[];
  sample_approval_stages: SampleApprovalStage[];
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
  blanks_received_date: ISODate;
  dye_costing_tracks: DyeCostingTrack[];
  trim_line_tracks: TrimLineTrack[];
  sample_approval_stages: SampleApprovalStage[];
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
  /** Unified tech pack due (Development). */
  tech_pack_due_date: ISODate;
  /** Unified tech pack complete (Development). */
  tech_pack_complete_date: ISODate;
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

/** Production order — operator-prefixed number (e.g. MAT260602), holds PO and due date. */
export type ProjectOrder = {
  id: string;
  project_id: number;
  /** Operator company code + YY + MM + seq, e.g. MAT260602 */
  order_number: string;
  due_date: string | null;
  po_number?: string | null;
  client_po_number?: string | null;
  /** Other order ids linked from this order (cross-order / invoice refs). */
  linked_order_ids?: string[];
  created_at: string;
  updated_at: string;
};

export type JobCustomField = {
  id?: string;
  key: string;
  value: string;
};

/** Per-color size grid on a job overview. */
export type JobColorwayRow = {
  id: string;
  name: string;
  color_code: string;
  size_run: string[];
  size_qty: Record<string, number>;
};

export type ProjectJob = {
  id: string;
  project_id: number;
  /** Parent production order. */
  order_id?: string;
  /** Human-readable job identifier — compact ClientCode+YYMM+Seq (e.g. GG260601, YOU2606100). */
  job_number?: string;
  /** Style name (UI label; stored in `name`). */
  name: string;
  subtitle: string;
  /** Short description for overview line items. */
  description?: string;
  /** Size breakdown summary for order cards / overview. */
  size_breakdown?: string;
  /** Unit or line price summary. */
  price?: string | null;
  /** Optional client-quote line extras (show when include_* is true). */
  quote_discount?: string | null;
  quote_sales_tax?: string | null;
  quote_days_or_hours?: string | null;
  quote_include_discount?: boolean;
  quote_include_sales_tax?: boolean;
  quote_include_days_or_hours?: boolean;
  /** When true, overview price is manual even if costing exists. */
  price_manual_override?: boolean;
  /** Human-readable style name (defaults from job name for non-apparel). */
  style_name?: string;
  /** Multiple colorways with per-size quantities. */
  colorway_rows?: JobColorwayRow[];
  /** Company + category + style identifier — unique per workspace. */
  sku?: string | null;
  /** Optional industry-specific fields. */
  custom_fields?: JobCustomField[];
  type: string;
  job_type?: JobType;
  /** Decoration method when job_type is decoration. */
  decoration_variant?: DecorationVariant | null;
  lead_vendor: string;
  /** Vendors assigned to this job (from People). Filters costing / quote pickers when set. */
  job_vendors?: string[];
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
  /** Product thumbnail for overview and header. */
  product_image?: FileRef | null;
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
  /** Link to manufacturer blank in catalog. */
  catalog_product_id?: string | null;
  /** Link to saved workspace product (blank or decorated). */
  workspace_product_id?: string | null;
  /** Who supplies the garment blank for this job. */
  blank_supplied_by?: SuppliedBy | null;
  /** Structured finishing tasks (folding, bagging, custom sections, etc.). */
  finishing_tasks?: JobFinishingTask[];
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
  /** Optional line-item modules inside Job details (color & sizing, production specs, etc.). */
  detail_modules?: import("@/lib/job-detail-modules").JobDetailModule[];
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
      return "vendor_quotes";
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
      return "bulk";
    case "strike_off":
      return "approvals";
    case "sample_1st":
    case "sample_2nd":
    case "sample_pp":
      return "cut_sew_samples";
    case "development_sample_received":
    case "pp_approved":
    case "branding_assets_approved":
      return "development";
    case "branded_labels_ordered":
    case "top_approved":
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
