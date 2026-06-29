/** Mirrors OnPro Swift `Project` + nested types; dates are ISO strings (JSON-safe). */

import type { PackingSlipDocument } from "@/lib/types/packing-slip";

export type ProjectStatus =
  | "Intake"
  | "On Hold"
  | "Development"
  | "Production"
  | "Completed";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export type SampleType =
  | "1ST SAMPLE"
  | "2ND SAMPLE"
  | "3RD SAMPLE"
  | "PP SAMPLE"
  | "2ND PP SAMPLE";

export type SampleStatus =
  | "PENDING"
  | "RECEIVED"
  | "APPROVED"
  | "REJECTED"
  | "IN REVIEW";

export type UserRole = "Client" | "Vendor" | "Team";

export type ISODate = string | null;

export interface Client {
  id: number;
  name: string;
  avatar_url: string | null;
}

export interface Sample {
  id: number;
  type: SampleType;
  requested_date: ISODate;
  due_date: ISODate;
  received_date: ISODate;
  comments_sent_date: ISODate;
  status: SampleStatus;
  comments: string | null;
}

export interface Colorway {
  id: number;
  name: string;
  samples: Sample[];
}

/** Repeatable dye workflow rows (persists on project when set). */
export interface DyeCostingTrack {
  id: string;
  dye_vendor: string | null;
  lab_dip_request_date: ISODate;
  lab_dip_due_date: ISODate;
  lab_dip_received_date: ISODate;
  lab_dip_approval_status: ApprovalStatus | null;
}

/** Repeatable print / embroidery / decoration rows. */
export interface PrintEmbroideryCostingTrack {
  id: string;
  print_embroidery_vendor: string | null;
  strike_off_request_date: ISODate;
  strike_off_due_date: ISODate;
  strike_off_received_date: ISODate;
  strike_off_approval_status: ApprovalStatus | null;
}

/** Flexible extra costing blocks (trims, freight quotes, etc.). */
export interface CostingExtraTrack {
  id: string;
  section_title: string;
  vendor_name: string | null;
  milestone_1_date: ISODate;
  milestone_2_date: ISODate;
  milestone_3_date: ISODate;
  approval_status: ApprovalStatus | null;
}

/** Repeatable trim workflow rows on a job (Development). */
export interface TrimLineTrack {
  id: string;
  vendor: string | null;
  trim_type: string | null;
  trim_ordered_date: ISODate;
  trim_received_date: ISODate;
}

/** Sample approval stage key — defaults are 1st / 2nd / pp; custom rows use generated keys. */
export type SampleApprovalKey = string;

export interface SampleApprovalStage {
  key: SampleApprovalKey;
  label: string;
  requested_date: ISODate;
  due_date: ISODate;
  status: ApprovalStatus | null;
}

/** Repeatable bulk production schedules on one project. */
export interface BulkProductionTrack {
  id: string;
  title: string;
  bulk_fabric_approval_date: ISODate;
  bulk_trim_approval_date: ISODate;
  new_product_request_date: ISODate;
  barcodes_sent_to_vendor_date: ISODate;
  top_due_date: ISODate;
  top_approved_date: ISODate;
  /** Print production — single trimming completed date. */
  trimming_completed_date: ISODate;
  bulk_target_delivery_date: ISODate;
  ex_factory_date: ISODate;
}

export interface DevelopmentUpdate {
  id: number;
  date: ISODate;
  author: string;
  title: string;
  description: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  project_number: string | null;
  /** PO / job number: ClientCode+YYMM+Seq (e.g. GG260601). Mirrors project_number in Live. */
  po_number?: string | null;
  /** Connect Dots WIP: project hand off date. */
  project_hand_off_date: ISODate;
  due_date: ISODate;
  client: Client;
  status: ProjectStatus;
  status_overview: string | null;
  status_update_date: ISODate;
  style_number: string | null;
  style_name: string | null;
  category: string | null;
  type: string | null;
  lead_vendor: string | null;
  colorways: Colorway[];
  in_development: DevelopmentUpdate[];
  lead_team_member: string | null;
  client_meeting_date: ISODate;
  client_assets_received_date: ISODate;
  cs_tech_pack_request_date: ISODate;
  cs_tech_pack_due_date: ISODate;
  cs_tech_pack_assigned_member: string | null;
  cs_tech_pack_complete_date: ISODate;
  artwork_tech_pack_request_date: ISODate;
  artwork_tech_pack_due_date: ISODate;
  artwork_tech_pack_assigned_member: string | null;
  artwork_tech_pack_complete_date: ISODate;
  artwork_design_client_approval_date: ISODate;
  dev_prod_assigned_team_member: string | null;
  tp_sent_date: ISODate;
  references_sent_date: ISODate;
  quote_requested_date: ISODate;
  vendor_costing_received_date: ISODate;
  cost_sheet_prepared_date: ISODate;
  estimate_sent_date: ISODate;
  costing_approved: boolean | null;
  dye_vendor: string | null;
  lab_dip_request_date: ISODate;
  lab_dip_due_date: ISODate;
  lab_dip_received_date: ISODate;
  lab_dip_approval_status: ApprovalStatus | null;
  print_embroidery_vendor: string | null;
  strike_off_request_date: ISODate;
  strike_off_due_date: ISODate;
  strike_off_received_date: ISODate;
  strike_off_approval_status: ApprovalStatus | null;
  bulk_fabric_approval_date: ISODate;
  bulk_trim_approval_date: ISODate;
  new_product_request_date: ISODate;
  barcodes_sent_to_vendor_date: ISODate;
  top_due_date: ISODate;
  top_approved_date: ISODate;
  bulk_target_delivery_date: ISODate;
  ex_factory_date: ISODate;
  shipping_terms: string | null;
  shipping_method: string | null;
  packing_list_received_date: ISODate;
  tracking_bol_number: string | null;
  packing_list_sent_to_client_date: ISODate;
  client_received_date: ISODate;
  /** Packing lists created in OnPro for outbound shipments */
  packaging_slips?: PackingSlipDocument[];

  /** Project-level deliverable scope (local overlay until DB column exists). */
  scope_kind?: "original" | "addon" | null;
  scope_note?: string | null;

  /** When set, overrides legacy single-row dye / lab dip fields for UI + persistence. */
  dye_costing_tracks?: DyeCostingTrack[] | null;
  print_embroidery_costing_tracks?: PrintEmbroideryCostingTrack[] | null;
  costing_extra_tracks?: CostingExtraTrack[] | null;
  bulk_production_tracks?: BulkProductionTrack[] | null;
}
