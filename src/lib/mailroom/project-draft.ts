/** Strip AI / ops prefixes from project draft titles for display. */
export function normalizeProjectDraftTitle(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  t = t.replace(/^create\s+project:?\s*/i, "");
  t = t.replace(/^create\s+/i, "");
  t = t.replace(/\s+project\s*$/i, "");
  return t.trim() || raw.trim();
}

export const PROJECT_DRAFT_FIELD_KEYS = [
  "client",
  "client_po_number",
  "due_date",
  "lead_vendor",
  "lead_team_member",
] as const;

export type ProjectDraftFieldKey = (typeof PROJECT_DRAFT_FIELD_KEYS)[number];

export const PROJECT_DRAFT_FIELD_LABELS: Record<ProjectDraftFieldKey, string> = {
  client: "Client",
  client_po_number: "PO Number",
  due_date: "Due Date",
  lead_vendor: "Vendor",
  lead_team_member: "Project Lead",
};

/** Build a project draft payload with only the five structured fields. */
export function projectDraftPayloadFrom(
  source: Record<string, unknown>,
): Record<string, unknown> {
  const client = String(source.client ?? source.client_name ?? "").trim();
  const po = String(source.client_po_number ?? source.po_number ?? "").trim();
  const due = String(source.due_date ?? source.dueDate ?? "").trim();
  const vendor = String(
    source.lead_vendor ?? source.vendor ?? source.vendor_name ?? "",
  ).trim();
  const lead = String(
    source.lead_team_member ?? source.team_contact_name ?? "",
  ).trim();
  const out: Record<string, unknown> = {};
  if (client) out.client = client;
  if (po) out.client_po_number = po;
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) out.due_date = due;
  if (vendor) {
    out.lead_vendor = vendor;
    out.vendor = vendor;
  }
  if (lead) out.lead_team_member = lead;
  const name = String(source.name ?? source.project_name ?? "").trim();
  if (name) {
    out.name = name;
    out.project_name = name;
  }
  return out;
}

export function mergeProjectDraftFields(
  draft: Record<string, unknown>,
  fields: Partial<Record<ProjectDraftFieldKey, string>>,
): Record<string, unknown> {
  const next = { ...draft };
  if (fields.client !== undefined) {
    next.client = fields.client;
    next.client_name = fields.client;
  }
  if (fields.client_po_number !== undefined) {
    next.client_po_number = fields.client_po_number;
  }
  if (fields.due_date !== undefined) {
    next.due_date = fields.due_date || undefined;
  }
  if (fields.lead_vendor !== undefined) {
    next.lead_vendor = fields.lead_vendor;
    next.vendor = fields.lead_vendor;
    next.vendor_name = fields.lead_vendor;
  }
  if (fields.lead_team_member !== undefined) {
    next.lead_team_member = fields.lead_team_member;
    next.team_contact_name = fields.lead_team_member;
  }
  return next;
}

export function projectDraftFieldValue(
  draft: Record<string, unknown>,
  key: ProjectDraftFieldKey,
): string {
  switch (key) {
    case "client":
      return String(draft.client ?? draft.client_name ?? "");
    case "client_po_number":
      return String(draft.client_po_number ?? draft.po_number ?? "");
    case "due_date":
      return String(draft.due_date ?? draft.dueDate ?? "");
    case "lead_vendor":
      return String(draft.lead_vendor ?? draft.vendor ?? draft.vendor_name ?? "");
    case "lead_team_member":
      return String(draft.lead_team_member ?? draft.team_contact_name ?? "");
    default:
      return "";
  }
}

/** Preview payload limited to the five operator-facing fields. */
export function projectDraftPreviewPayload(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PROJECT_DRAFT_FIELD_KEYS) {
    const v = projectDraftFieldValue(draft, key);
    if (v) out[key] = v;
  }
  return out;
}
