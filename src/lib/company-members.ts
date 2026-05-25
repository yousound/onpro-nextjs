import type { Contact } from "@/lib/types/contact";

/** Editable row while adding/updating company members. */
export type CompanyMemberDraft = {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** True when created inline in the editor (not yet in contacts store). */
  isNew: boolean;
};

export function memberDraftsFromCompany(contacts: Contact[], company: Contact): CompanyMemberDraft[] {
  const ids = new Set(company.member_contact_ids ?? []);
  const linked = contacts.filter(
    (c) => ids.has(c.id) || c.parent_company_id === company.id,
  );
  return linked.map((c) => ({
    id: c.id,
    name: c.contact_name ?? c.name,
    email: c.email,
    phone: c.phone ?? "",
    isNew: false,
  }));
}

export function emptyMemberDraft(): CompanyMemberDraft {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    email: "",
    phone: "",
    isNew: true,
  };
}
