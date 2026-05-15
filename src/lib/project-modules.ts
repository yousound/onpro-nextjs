export const PROJECT_MODULE_IDS = [
  "details",
  "payments",
  "invoices",
  "approvals",
  "internal",
  "people_access",
  "costing",
  "cs",
  "bulk_production",
  "shipping",
] as const;

export type ProjectModuleId = (typeof PROJECT_MODULE_IDS)[number];

export const PROJECT_MODULE_TABS: { id: ProjectModuleId; label: string }[] = [
  { id: "details", label: "Project details" },
  { id: "payments", label: "Payments" },
  { id: "invoices", label: "Invoices" },
  { id: "approvals", label: "Approvals" },
  { id: "internal", label: "Internal" },
  { id: "people_access", label: "People & access" },
  { id: "costing", label: "Costing" },
  { id: "cs", label: "Cut & sew" },
  { id: "bulk_production", label: "Bulk production" },
  { id: "shipping", label: "Shipping & receiving" },
];

export function parseProjectModuleTab(raw: string | null): ProjectModuleId {
  if (!raw) return "details";
  const hit = PROJECT_MODULE_IDS.find((id) => id === raw);
  return hit ?? "details";
}
