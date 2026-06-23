export const PROJECT_MODULE_IDS = [
  "details",
  "internal",
  "documents",
  "financials",
  "shipping",
  "payments",
  "people_access",
] as const;

export type ProjectModuleId = (typeof PROJECT_MODULE_IDS)[number];

export const PROJECT_MODULE_TABS: { id: ProjectModuleId; label: string }[] = [
  { id: "details", label: "Project details" },
  { id: "internal", label: "Internal" },
  { id: "documents", label: "Documents" },
  { id: "financials", label: "Financials" },
  { id: "shipping", label: "Shipping & receiving" },
  { id: "payments", label: "Payments" },
  { id: "people_access", label: "People & access" },
];

export function parseProjectModuleTab(raw: string | null): ProjectModuleId {
  if (!raw) return "details";
  if (raw === "invoices") return "financials";
  if ((LEGACY_PROJECT_MODULE_IDS as readonly string[]).includes(raw)) return "details";
  const hit = PROJECT_MODULE_IDS.find((id) => id === raw);
  return hit ?? "details";
}

/** Legacy tabs removed from project level — now live on Job Details */
export const LEGACY_PROJECT_MODULE_IDS = ["costing", "cs", "bulk_production", "approvals"] as const;
