import type { ApprovalStatus, Client, Colorway, DevelopmentUpdate, Project, ProjectStatus } from "@/lib/types/project";
import type { ProjectRowDb } from "@/lib/supabase/types-db";

function iso(v: string | null | undefined): string | null {
  return v ?? null;
}

function approval(v: string | null | undefined): ApprovalStatus | null {
  if (!v) return null;
  const u = v.toUpperCase();
  if (u === "PENDING" || u === "APPROVED" || u === "REJECTED") return u;
  return null;
}

function status(v: string): ProjectStatus {
  const allowed: ProjectStatus[] = [
    "IN DEVELOPMENT",
    "PENDING",
    "IN-PROGRESS",
    "COMPLETED",
    "DELIVERED",
  ];
  if (allowed.includes(v as ProjectStatus)) return v as ProjectStatus;
  return "PENDING";
}

function parseJsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) return value as T[];
  return fallback;
}

export function projectFromRow(row: ProjectRowDb): Project {
  const client: Client = {
    id: row.client?.id ?? 0,
    name: row.client?.name ?? "Unknown client",
    avatar_url: row.client?.avatar_url ?? null,
  };

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    project_number: row.project_number,
    po_number: null,
    project_hand_off_date: null,
    due_date: iso(row.due_date),
    client,
    status: status(row.status),
    status_overview: row.status_overview,
    status_update_date: iso(row.status_update_date),
    style_number: row.style_number,
    style_name: row.style_name,
    category: row.category,
    type: row.type,
    lead_vendor: row.lead_vendor,
    colorways: parseJsonArray<Colorway>(row.colorways, []),
    in_development: parseJsonArray<DevelopmentUpdate>(row.in_development, []),
    lead_team_member: row.lead_team_member,
    client_meeting_date: iso(row.client_meeting_date),
    client_assets_received_date: iso(row.client_assets_received_date),
    cs_tech_pack_request_date: iso(row.cs_tech_pack_request_date),
    cs_tech_pack_due_date: iso(row.cs_tech_pack_due_date),
    cs_tech_pack_assigned_member: row.cs_tech_pack_assigned_member,
    cs_tech_pack_complete_date: iso(row.cs_tech_pack_complete_date),
    artwork_tech_pack_request_date: iso(row.artwork_tech_pack_request_date),
    artwork_tech_pack_due_date: iso(row.artwork_tech_pack_due_date),
    artwork_tech_pack_assigned_member: row.artwork_tech_pack_assigned_member,
    artwork_tech_pack_complete_date: iso(row.artwork_tech_pack_complete_date),
    artwork_design_client_approval_date: iso(row.artwork_design_client_approval_date),
    dev_prod_assigned_team_member: row.dev_prod_assigned_team_member,
    tp_sent_date: iso(row.tp_sent_date),
    references_sent_date: iso(row.references_sent_date),
    quote_requested_date: iso(row.quote_requested_date),
    vendor_costing_received_date: iso(row.vendor_costing_received_date),
    cost_sheet_prepared_date: iso(row.cost_sheet_prepared_date),
    estimate_sent_date: iso(row.estimate_sent_date),
    costing_approved: row.costing_approved,
    dye_vendor: row.dye_vendor,
    lab_dip_request_date: iso(row.lab_dip_request_date),
    lab_dip_due_date: iso(row.lab_dip_due_date),
    lab_dip_received_date: iso(row.lab_dip_received_date),
    lab_dip_approval_status: approval(row.lab_dip_approval_status),
    print_embroidery_vendor: row.print_embroidery_vendor,
    strike_off_request_date: iso(row.strike_off_request_date),
    strike_off_due_date: iso(row.strike_off_due_date),
    strike_off_received_date: iso(row.strike_off_received_date),
    strike_off_approval_status: approval(row.strike_off_approval_status),
    bulk_fabric_approval_date: iso(row.bulk_fabric_approval_date),
    bulk_trim_approval_date: iso(row.bulk_trim_approval_date),
    new_product_request_date: iso(row.new_product_request_date),
    barcodes_sent_to_vendor_date: iso(row.barcodes_sent_to_vendor_date),
    top_due_date: iso(row.top_due_date),
    top_approved_date: iso(row.top_approved_date),
    bulk_target_delivery_date: iso(row.bulk_target_delivery_date),
    ex_factory_date: iso(row.ex_factory_date),
    shipping_terms: row.shipping_terms,
    shipping_method: row.shipping_method,
    packing_list_received_date: iso(row.packing_list_received_date),
    tracking_bol_number: row.tracking_bol_number,
    packing_list_sent_to_client_date: iso(row.packing_list_sent_to_client_date),
    client_received_date: iso(row.client_received_date),
    packaging_slips: [],
    dye_costing_tracks: null,
    print_embroidery_costing_tracks: null,
    costing_extra_tracks: null,
    bulk_production_tracks: null,
  };
}

/** Fields stored in localStorage only (not in Supabase `projects` yet). */
const LOCAL_ONLY_PROJECT_KEYS = new Set([
  "project_hand_off_date",
  "po_number",
  "packaging_slips",
  "dye_costing_tracks",
  "print_embroidery_costing_tracks",
  "costing_extra_tracks",
  "bulk_production_tracks",
]);

const SKIP_PROJECT_PATCH_KEYS = new Set(["id", "client", ...LOCAL_ONLY_PROJECT_KEYS]);

export function splitProjectPatch(patch: Partial<Project>): {
  db: Partial<Project>;
  local: Partial<Project>;
} {
  const db: Partial<Project> = {};
  const local: Partial<Project> = {};
  for (const [key, value] of Object.entries(patch) as [keyof Project, unknown][]) {
    if (LOCAL_ONLY_PROJECT_KEYS.has(key)) {
      (local as Record<string, unknown>)[key] = value;
    } else if (!SKIP_PROJECT_PATCH_KEYS.has(key)) {
      (db as Record<string, unknown>)[key] = value;
    }
  }
  return { db, local };
}

export function projectPatchToDbRow(patch: Partial<Project>): Record<string, unknown> {
  const { db } = splitProjectPatch(patch);
  return db as Record<string, unknown>;
}

export function readLocalProjectOverlay(saved: Partial<Project> | null | undefined): Partial<Project> {
  if (!saved || typeof saved !== "object") return {};
  const local: Partial<Project> = {};
  for (const key of LOCAL_ONLY_PROJECT_KEYS) {
    if (key in saved) {
      (local as Record<string, unknown>)[key] = saved[key as keyof Project];
    }
  }
  return local;
}
