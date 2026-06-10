import { decodeContactAddress } from "@/lib/supabase/contact-payload";
import { normalizeContactAvatarUrl } from "@/lib/contact-display-avatar";
import type { Contact, ContactKind, PeopleSegment } from "@/lib/types/contact";
import type { ContactRowDb } from "@/lib/supabase/types-db";

function segmentFromRole(role: string): PeopleSegment {
  const r = role.trim().toLowerCase();
  if (r === "vendor") return "vendor";
  if (r === "team") return "team";
  return "client";
}

function kindFromRow(row: ContactRowDb, segment: PeopleSegment): ContactKind {
  if (segment === "vendor") return "company";
  if (segment === "client" && row.company_name) return "company";
  return "individual";
}

export function contactFromRow(row: ContactRowDb): Contact {
  const segment = segmentFromRole(row.role);
  const kind = kindFromRow(row, segment);
  const extra = decodeContactAddress(row.address);
  const created = row.created_at ?? new Date().toISOString();
  const updated = row.updated_at ?? created;

  const base: Contact = {
    id: String(row.id),
    segment,
    kind: extra.kind ?? kind,
    company_code: extra.company_code ?? "",
    parent_company_id: extra.parent_company_id,
    member_contact_ids: extra.member_contact_ids ?? [],
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    avatar_url: normalizeContactAvatarUrl(row.avatar_url),
    linked_auth_user_id: (row.linked_auth_user_id as string | null | undefined) ?? undefined,
    permissions: extra.permissions,
    team_role: extra.team_role,
    team_role_custom: extra.team_role_custom,
    business_structure: extra.business_structure,
    billing_address: extra.billing_address,
    shipping_address: extra.shipping_address,
    locations: extra.locations,
    other_emails: extra.other_emails,
    notes: extra.notes,
    created_at: created,
    updated_at: updated,
  };

  if (segment === "client" && (extra.kind ?? kind) === "company") {
    return {
      ...base,
      name: row.name,
      contact_name: extra.contact_name ?? row.company_name ?? undefined,
    };
  }

  if (segment === "client" && extra.parent_company_id) {
    return {
      ...base,
      contact_name: extra.contact_name ?? row.name,
    };
  }

  if (segment === "vendor") {
    return {
      ...base,
      name: row.name,
      contact_name: row.company_name ?? undefined,
    };
  }

  if (segment === "team") {
    return {
      ...base,
      name: row.name,
      contact_name: row.name,
      company_name: row.company_name ?? undefined,
    };
  }

  return {
    ...base,
    contact_name: row.company_name ? row.name : undefined,
  };
}
