/** Contact / company types for People ingestion (mock CRM). */

import type { ProjectPermissionFlags } from "@/lib/project-permissions";

export type ContactKind = "company" | "individual";
export type PeopleSegment = "team" | "vendor" | "client";
export type TeamRole = "admin" | "manager" | "staff" | "temp" | "custom";

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface FileRef {
  id: string;
  name: string;
  url: string;
  uploaded_at: string;
}

export interface Contact {
  id: string;
  segment: PeopleSegment;
  kind: ContactKind;
  company_code: string;
  /** Company name or individual display name */
  name: string;
  contact_name?: string;
  /** Team / operator workspace company label (stored in `contacts.company_name`). */
  company_name?: string;
  email: string;
  other_emails?: string[];
  phone?: string;
  billing_address?: Address;
  shipping_address?: Address;
  sell_permits?: FileRef[];
  sell_certificate?: FileRef[];
  avatar_url?: string | null;
  member_contact_ids?: string[];
  /** Individual linked to a company client (searchable in People + pickers). */
  parent_company_id?: string;
  /** Vendor-only */
  business_structure?: string;
  documents?: FileRef[];
  /** Team-only */
  team_role?: TeamRole;
  team_role_custom?: string;
  notes?: string;
  /** Workspace permission profile — on companies; members inherit. */
  permissions?: ProjectPermissionFlags;
  created_at: string;
  updated_at: string;
}

export type VendorContact = Contact & { segment: "vendor" };

/** Derive 2–3 char company code from a name (individual w/o company). */
export function deriveCompanyCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "XX";
  if (words.length === 1) {
    const w = words[0].replace(/[^a-zA-Z]/g, "");
    return w.slice(0, 3).toUpperCase().padEnd(2, "X");
  }
  const initials = words
    .slice(0, 3)
    .map((w) => w.replace(/[^a-zA-Z]/g, "")[0])
    .filter(Boolean)
    .join("");
  return initials.slice(0, 3).toUpperCase().padEnd(2, "X");
}

export function teamRoleLabel(role: TeamRole, custom?: string): string {
  if (role === "custom" && custom?.trim()) return custom.trim();
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "staff":
      return "Staff";
    case "temp":
      return "Temp";
    default:
      return custom?.trim() || "Custom";
  }
}

export const BUSINESS_STRUCTURE_OPTIONS = [
  "LLC",
  "Corporation",
  "Sole Proprietorship",
  "Partnership",
  "Non-profit",
  "Other",
] as const;
