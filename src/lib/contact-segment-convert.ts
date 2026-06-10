import {
  contactDisplayName,
  findContactByEmailInSegment,
} from "@/lib/contacts-store";
import {
  validateClientContactFields,
  validateDirectoryCompanyCode,
} from "@/lib/contact-field-validation";
import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import { deriveCompanyCode, type Contact, type PeopleSegment } from "@/lib/types/contact";

export type ConvertibleSegment = Extract<PeopleSegment, "client" | "vendor">;

export function convertContactToSegment(contact: Contact, target: ConvertibleSegment): Contact {
  const now = new Date().toISOString();
  const code = contact.company_code?.trim() || deriveCompanyCode(contact.name);

  if (target === "client") {
    const kind = contact.segment === "vendor" || contact.kind === "company" ? "company" : "individual";
    return {
      ...contact,
      segment: "client",
      kind,
      company_code: code,
      name: contact.name.trim(),
      contact_name:
        kind === "company"
          ? contact.contact_name?.trim() || contact.name.trim()
          : undefined,
      permissions: contact.permissions ?? defaultPermissionsForSegment("client"),
      updated_at: now,
    };
  }

  return {
    ...contact,
    segment: "vendor",
    kind: "company",
    company_code: code,
    name: contact.name.trim(),
    contact_name: contact.contact_name?.trim() || contact.name.trim(),
    permissions: contact.permissions ?? defaultPermissionsForSegment("vendor"),
    updated_at: now,
  };
}

export function validateSegmentConversion(
  contacts: readonly Contact[],
  contact: Contact,
  target: ConvertibleSegment,
): string | null {
  if (contact.segment === target) return null;

  const converted = convertContactToSegment(contact, target);
  const emailNorm = converted.email.trim().toLowerCase();
  const otherSegment = contacts.find(
    (c) =>
      c.id !== contact.id &&
      c.email.toLowerCase() === emailNorm &&
      c.segment !== target,
  );
  if (otherSegment) {
    return `This email is already used as a ${otherSegment.segment} contact (${contactDisplayName(otherSegment)}).`;
  }

  const duplicateInTarget = findContactByEmailInSegment(contacts, converted.email, target);
  if (duplicateInTarget && duplicateInTarget.id !== contact.id) {
    return `A ${target} contact with this email already exists (${contactDisplayName(duplicateInTarget)}).`;
  }

  if (target === "client") {
    const fields = validateClientContactFields(contacts, {
      kind: converted.kind,
      name: converted.name,
      email: converted.email,
      companyCode: converted.company_code,
      excludeContactId: contact.id,
    });
    if (fields.companyCode) return fields.companyCode;
    if (fields.email?.includes("already used for")) return fields.email;
    return null;
  }

  return validateDirectoryCompanyCode(contacts, converted.company_code, contact.id) ?? null;
}
