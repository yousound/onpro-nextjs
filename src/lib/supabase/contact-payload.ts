import type {
  Address,
  Contact,
  ContactKind,
  ContactLocation,
  FileRef,
  PeopleSegment,
  TeamRole,
} from "@/lib/types/contact";
import type { ProjectPermissionFlags } from "@/lib/project-permissions";

function locationHasContent(loc: ContactLocation): boolean {
  return Boolean(
    loc.label?.trim() ||
      loc.line1?.trim() ||
      loc.line2?.trim() ||
      loc.city?.trim() ||
      loc.state?.trim() ||
      loc.postal_code?.trim() ||
      loc.country?.trim(),
  );
}

export type ContactAddressPayload = {
  kind?: ContactKind;
  company_code?: string;
  parent_company_id?: string;
  member_contact_ids?: string[];
  contact_name?: string;
  permissions?: ProjectPermissionFlags;
  team_role?: TeamRole;
  team_role_custom?: string;
  team_role_label?: string;
  billing_address?: Address;
  shipping_address?: Address;
  locations?: ContactLocation[];
  other_emails?: string[];
  business_structure?: string;
  sell_permits?: FileRef[];
  sell_certificate?: FileRef[];
  documents?: FileRef[];
  /** Legacy plain-text notes when not JSON. */
  notes?: string;
};

export function encodeContactAddress(contact: Partial<Contact>): string | null {
  const payload: ContactAddressPayload = {};
  if (contact.kind) payload.kind = contact.kind;
  if (contact.company_code?.trim()) payload.company_code = contact.company_code.trim();
  if (contact.parent_company_id) payload.parent_company_id = contact.parent_company_id;
  if (contact.member_contact_ids?.length) payload.member_contact_ids = contact.member_contact_ids;
  if (contact.contact_name?.trim()) payload.contact_name = contact.contact_name.trim();
  if (contact.permissions) payload.permissions = contact.permissions;
  if (contact.team_role) payload.team_role = contact.team_role;
  if (contact.team_role_custom) payload.team_role_custom = contact.team_role_custom;
  if (contact.billing_address && Object.keys(contact.billing_address).length) {
    payload.billing_address = contact.billing_address;
  }
  if (contact.shipping_address && Object.keys(contact.shipping_address).length) {
    payload.shipping_address = contact.shipping_address;
  }
  if (contact.other_emails?.length) payload.other_emails = contact.other_emails;
  if (contact.business_structure) payload.business_structure = contact.business_structure;
  if (contact.sell_permits?.length) payload.sell_permits = contact.sell_permits;
  if (contact.sell_certificate?.length) payload.sell_certificate = contact.sell_certificate;
  if (contact.documents?.length) payload.documents = contact.documents;
  if (contact.locations?.length) payload.locations = contact.locations;
  if (contact.notes?.trim()) payload.notes = contact.notes.trim();

  if (Object.keys(payload).length === 0) return null;
  return JSON.stringify(payload);
}

export function decodeContactAddress(address: string | null | undefined): Partial<Contact> {
  if (!address?.trim()) return {};
  try {
    const parsed = JSON.parse(address) as ContactAddressPayload;
    if (parsed && typeof parsed === "object") {
      return {
        kind: parsed.kind,
        company_code: parsed.company_code,
        parent_company_id: parsed.parent_company_id,
        member_contact_ids: parsed.member_contact_ids,
        contact_name: parsed.contact_name,
        permissions: parsed.permissions,
        team_role: parsed.team_role,
        team_role_custom: parsed.team_role_custom,
        billing_address: parsed.billing_address,
        shipping_address: parsed.shipping_address,
        locations: parsed.locations,
        other_emails: parsed.other_emails,
        business_structure: parsed.business_structure,
        sell_permits: parsed.sell_permits,
        sell_certificate: parsed.sell_certificate,
        documents: parsed.documents,
        locations: parsed.locations,
        notes: parsed.notes,
      };
    }
  } catch {
    return { notes: address };
  }
  return { notes: address };
}

export function roleForSegment(segment: PeopleSegment): string {
  if (segment === "team") return "Team";
  if (segment === "vendor") return "Vendor";
  return "Client";
}

/** Map app Contact → Supabase `contacts` row (without id for insert). */
export function contactToDbRow(
  contact: Contact,
  userId: string,
): {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  avatar_url: string | null;
  role: string;
  address: string | null;
} {
  let name = contact.name.trim();
  let companyName: string | null = contact.company_name?.trim() || null;

  if (contact.segment === "vendor") {
    name = contact.name.trim();
    companyName = contact.contact_name?.trim() || null;
  } else if (contact.segment === "client" && contact.kind === "company") {
    name = contact.name.trim();
    companyName = contact.contact_name?.trim() || null;
  } else if (contact.segment === "team") {
    name = (contact.contact_name ?? contact.name).trim();
    companyName = contact.company_name?.trim() || null;
  }

  return {
    user_id: userId,
    name,
    email: contact.email.trim(),
    phone: contact.phone?.trim() || null,
    company_name: companyName,
    avatar_url: contact.avatar_url ?? null,
    role: roleForSegment(contact.segment),
    address: encodeContactAddress(contact),
  };
}
