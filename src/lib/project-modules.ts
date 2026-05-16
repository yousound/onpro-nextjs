export const PROJECT_MODULE_IDS = [
  "details",
  "internal",
  "costing",
  "cs",
  "bulk_production",
  "approvals",
  "payments",
  "invoices",
  "shipping",
  "people_access",
] as const;

export type ProjectModuleId = (typeof PROJECT_MODULE_IDS)[number];

export const PROJECT_MODULE_TABS: { id: ProjectModuleId; label: string }[] = [
  { id: "details", label: "Project details" },
  { id: "internal", label: "Internal" },
  { id: "costing", label: "Costing" },
  { id: "cs", label: "Cut & sew" },
  { id: "bulk_production", label: "Bulk production" },
  { id: "approvals", label: "Approvals" },
  { id: "payments", label: "Payments" },
  { id: "invoices", label: "Invoices" },
  { id: "shipping", label: "Shipping & receiving" },
  { id: "people_access", label: "People & access" },
];

export function parseProjectModuleTab(raw: string | null): ProjectModuleId {
  if (!raw) return "details";
  const hit = PROJECT_MODULE_IDS.find((id) => id === raw);
  return hit ?? "details";
}
