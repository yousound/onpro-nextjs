import type { Contact } from "@/lib/types/contact";
import {
  defaultPermissionsForSegment,
  type ProjectPermissionFlags,
} from "@/lib/project-permissions";

export function companyForContactPermissions(
  contacts: Contact[],
  contact: Contact,
): Contact | undefined {
  if (contact.kind === "company") return contact;
  if (!contact.parent_company_id) return undefined;
  return contacts.find((c) => c.id === contact.parent_company_id);
}

/** Effective workspace permissions: company profile, or own profile for standalone contacts. */
export function effectiveContactPermissions(
  contacts: Contact[],
  contact: Contact,
): { flags: ProjectPermissionFlags; source: "company" | "self" | "segment-default"; company?: Contact } {
  const company = companyForContactPermissions(contacts, contact);
  if (company?.permissions) {
    return { flags: company.permissions, source: "company", company };
  }
  if (contact.permissions) {
    return { flags: contact.permissions, source: "self" };
  }
  return {
    flags: defaultPermissionsForSegment(contact.segment),
    source: "segment-default",
    company,
  };
}

export function permissionsLabel(source: "company" | "self" | "segment-default", company?: Contact): string {
  switch (source) {
    case "company":
      return company ? `Inherited from ${company.name}` : "Inherited from company";
    case "self":
      return "Set on this contact";
    default:
      return "OnPro segment defaults (set on company to customize)";
  }
}
