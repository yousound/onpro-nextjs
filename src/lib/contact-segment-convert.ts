import {
  contactDisplayName,
  findContactByEmailInSegment,
  vendorDisplayName,
} from "@/lib/contacts-store";
import { projectsUsingClient } from "@/lib/contacts-delete";
import {
  validateClientContactFields,
  validateDirectoryCompanyCode,
} from "@/lib/contact-field-validation";
import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import { deriveCompanyCode, type Contact, type PeopleSegment } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";

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

function formatProjectList(projects: Project[], max = 3): string {
  const names = projects.slice(0, max).map((p) => p.name).join(", ");
  const more = projects.length > max ? ` and ${projects.length - max} more` : "";
  return `${names}${more}`;
}

/** Projects whose lead or specialty vendor fields match this vendor contact name. */
export function projectsUsingVendorName(projects: readonly Project[], contact: Contact): Project[] {
  const name = vendorDisplayName(contact).trim().toLowerCase();
  if (!name) return [];
  return projects.filter((p) => {
    const fields = [p.lead_vendor, p.dye_vendor, p.print_embroidery_vendor];
    return fields.some((v) => v?.trim().toLowerCase() === name);
  });
}

/** Blocks client → vendor when projects still point at this contact id. */
export function clientToVendorMoveError(
  projects: readonly Project[],
  contactId: string,
): string | null {
  const blocking = projectsUsingClient([...projects], contactId);
  if (blocking.length === 0) return null;
  return `This client is still assigned on ${blocking.length} project${blocking.length === 1 ? "" : "s"} (${formatProjectList(blocking)}). Open each project, set a different client, then try again. Moving to Vendors does not update those project links.`;
}

/** Informational when vendor name still appears on projects. */
export function vendorToClientMoveAdvisory(
  projects: readonly Project[],
  contact: Contact,
): string | null {
  const using = projectsUsingVendorName(projects, contact);
  if (using.length === 0) return null;
  return `This vendor name is still on ${using.length} project${using.length === 1 ? "" : "s"} (${formatProjectList(using)}) as lead or specialty vendor. Jobs will keep that name even after you move this contact.`;
}

/** Plain-language manual workflow — shown before someone uses Move. */
export function segmentMoveRecommendation(
  contact: Contact,
  target: ConvertibleSegment,
): string {
  if (contact.segment === "vendor" && target === "client") {
    return "You're better off adding a new Client (Clients → Add client), choosing them on each project that should bill to this company, updating lead vendor on jobs if needed, then deleting this vendor once nothing references them.";
  }
  if (contact.segment === "client" && target === "vendor") {
    return "You're better off adding a new Vendor (Vendors → Add vendor) and setting them as lead vendor on the project. Keep this client on the Clients tab if they're already on projects — moving won't rewire project or job data.";
  }
  return "";
}

export function validateSegmentConversion(
  contacts: readonly Contact[],
  contact: Contact,
  target: ConvertibleSegment,
  options?: { projects?: readonly Project[] },
): string | null {
  if (contact.segment === target) return null;

  if (target === "vendor" && contact.segment === "client" && options?.projects?.length) {
    const clientBlock = clientToVendorMoveError(options.projects, contact.id);
    if (clientBlock) return clientBlock;
  }

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
