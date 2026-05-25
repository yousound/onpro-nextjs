import type { Contact, PeopleSegment, TeamRole } from "@/lib/types/contact";
import { deriveCompanyCode } from "@/lib/types/contact";
import type { ProjectPermissionFlags } from "@/lib/project-permissions";
import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import type { CompanyMemberDraft } from "@/lib/company-members";
import { MOCK_DIRECTORY_PEOPLE } from "@/lib/mock/people";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { clientCodeByName } from "@/lib/reference/client-codes";

const now = () => new Date().toISOString();

function directoryToContact(p: (typeof MOCK_DIRECTORY_PEOPLE)[0]): Contact {
  const kind = p.company && p.company !== p.name ? "company" : "individual";
  const code =
    clientCodeByName(p.company ?? p.name) ??
    deriveCompanyCode(p.company ?? p.name);
  return {
    id: p.id,
    segment: p.segment,
    kind,
    company_code: code,
    name: p.company ?? p.name,
    contact_name: p.company ? p.name : undefined,
    email: p.email,
    phone: p.phone,
    notes: p.notes,
    avatar_url: null,
    member_contact_ids: [],
    permissions:
      kind === "company" ? defaultPermissionsForSegment(p.segment) : undefined,
    created_at: now(),
    updated_at: now(),
  };
}

export const SEED_CONTACTS: Contact[] = MOCK_DIRECTORY_PEOPLE.map(directoryToContact);

function migrateClientContact(c: Contact): Contact {
  if (c.segment !== "client") return c;
  const mock = MOCK_DIRECTORY_PEOPLE.find((p) => p.id === c.id);
  if (mock?.company && mock.company !== mock.name) {
    const code =
      c.company_code ||
      clientCodeByName(mock.company) ||
      deriveCompanyCode(mock.company);
    return {
      ...c,
      kind: "company",
      name: mock.company,
      contact_name: mock.name,
      company_code: code,
    };
  }
  return c;
}

export function loadContacts(): Contact[] {
  const saved = readMockLs<Contact[]>(MOCK_LS.contacts);
  if (saved?.length) return saved.map(migrateClientContact);
  return SEED_CONTACTS.map((c) => ({ ...c }));
}

export function saveContacts(contacts: Contact[]): void {
  writeMockLs(MOCK_LS.contacts, contacts);
}

export function findContactByEmail(contacts: Contact[], email: string): Contact | undefined {
  const e = email.trim().toLowerCase();
  return contacts.find((c) => c.email.toLowerCase() === e);
}

export function isCompanyCodeTaken(contacts: Contact[], code: string, excludeId?: string): boolean {
  const c = code.trim().toUpperCase();
  return contacts.some((x) => x.id !== excludeId && x.company_code.toUpperCase() === c);
}

export function contactsForSegment(contacts: Contact[], segment: PeopleSegment): Contact[] {
  return contacts.filter((c) => c.segment === segment);
}

export function clientContacts(contacts: Contact[]): Contact[] {
  return contacts.filter((c) => c.segment === "client");
}

/** Client companies + standalone individuals (not company members). */
export function clientListContacts(contacts: Contact[], query?: string): Contact[] {
  const clients = contacts.filter((c) => c.segment === "client");
  const needle = query?.trim().toLowerCase() ?? "";
  const isPrimaryRow = (c: Contact) =>
    c.kind === "company" || (c.kind === "individual" && !c.parent_company_id);

  if (!needle) {
    return clients.filter(isPrimaryRow).sort((a, b) => a.name.localeCompare(b.name));
  }

  const matched = new Map<string, Contact>();
  for (const c of clients) {
    if (!contactSearchBlob(contacts, c).includes(needle)) continue;
    if (c.parent_company_id) {
      const parent = contacts.find((x) => x.id === c.parent_company_id);
      if (parent && parent.kind === "company") matched.set(parent.id, parent);
    } else if (isPrimaryRow(c)) {
      matched.set(c.id, c);
    }
  }
  return [...matched.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function vendorDisplayName(c: Contact): string {
  if (c.segment !== "vendor") return contactDisplayName(c);
  return c.name;
}

export function vendorContacts(contacts: Contact[]): Contact[] {
  return contacts.filter((c) => c.segment === "vendor");
}

export function newContactId(): string {
  return `c-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
}

export function upsertInvitedContact(params: {
  segment: PeopleSegment;
  email: string;
  permissions: ProjectPermissionFlags;
  /** Vendor company name, or team member display name. */
  name: string;
  contactName?: string;
  phone?: string;
  teamRole?: TeamRole;
  teamRoleCustom?: string;
}): Contact {
  const contacts = loadContacts();
  const existing = findContactByEmail(contacts, params.email);
  const now = new Date().toISOString();
  const trimmedEmail = params.email.trim();
  const kind = params.segment === "vendor" ? "company" : "individual";
  const teamName = params.name.trim() || params.contactName?.trim() || trimmedEmail;
  const payload: Contact = {
    id: existing?.id ?? newContactId(),
    segment: params.segment,
    kind,
    company_code: existing?.company_code ?? deriveCompanyCode(params.segment === "vendor" ? params.name : teamName),
    name: params.segment === "vendor" ? params.name.trim() : teamName,
    contact_name:
      params.segment === "vendor"
        ? params.contactName?.trim() || undefined
        : params.contactName?.trim() || params.name.trim() || undefined,
    email: trimmedEmail,
    phone: params.phone?.trim() || existing?.phone,
    team_role: params.segment === "team" ? params.teamRole : existing?.team_role,
    team_role_custom:
      params.segment === "team" && params.teamRole === "custom"
        ? params.teamRoleCustom?.trim() || undefined
        : existing?.team_role_custom,
    permissions: params.permissions,
    avatar_url: existing?.avatar_url ?? null,
    member_contact_ids: existing?.member_contact_ids ?? [],
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  const next = existing
    ? contacts.map((c) => (c.id === payload.id ? { ...existing, ...payload } : c))
    : [...contacts, payload];
  saveContacts(next);
  return payload;
}

export function contactDisplayName(c: Contact, contacts?: Contact[]): string {
  if (c.segment === "client") {
    if (c.kind === "company") return c.name;
    if (c.parent_company_id && contacts) {
      const parent = contacts.find((x) => x.id === c.parent_company_id);
      if (parent) return parent.name;
    }
    return c.contact_name ?? c.name;
  }
  if (c.parent_company_id && c.contact_name) return c.contact_name;
  if (c.kind === "company" && c.contact_name) return `${c.name} (${c.contact_name})`;
  return c.name;
}

export function companyForContact(contacts: Contact[], c: Contact): Contact | undefined {
  if (!c.parent_company_id) return undefined;
  return contacts.find((x) => x.id === c.parent_company_id);
}

export function companyLabelForContact(contacts: Contact[], c: Contact): string | null {
  if (c.kind === "company") return c.name;
  return companyForContact(contacts, c)?.name ?? null;
}

export function contactSearchBlob(contacts: Contact[], c: Contact): string {
  const company = companyLabelForContact(contacts, c);
  return [
    c.name,
    c.contact_name,
    c.email,
    c.phone,
    c.company_code,
    company,
    c.notes,
    ...(c.other_emails ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function searchContacts(
  contacts: Contact[],
  query: string,
  segment?: Contact["segment"],
): Contact[] {
  const needle = query.trim().toLowerCase();
  return contacts.filter((c) => {
    if (segment && c.segment !== segment) return false;
    if (!needle) return true;
    return contactSearchBlob(contacts, c).includes(needle);
  });
}

export function persistCompanyWithMembers(
  contacts: Contact[],
  company: Contact,
  members: CompanyMemberDraft[],
): Contact[] {
  const now = new Date().toISOString();
  let next = contacts.filter((c) => c.id !== company.id);
  const prevMemberIds = new Set(
    contacts
      .filter(
        (c) => c.parent_company_id === company.id || company.member_contact_ids?.includes(c.id),
      )
      .map((c) => c.id),
  );

  const memberIds: string[] = [];
  const savedMembers: Contact[] = [];

  for (const draft of members) {
    if (!draft.name.trim() && !draft.email.trim()) continue;
    const existing = contacts.find((c) => c.id === draft.id);
    const id =
      draft.isNew || !existing || draft.id.startsWith("draft-") ? newContactId() : draft.id;
    savedMembers.push({
      id,
      segment: "client",
      kind: "individual",
      parent_company_id: company.id,
      company_code: company.company_code,
      name: draft.name.trim() || draft.email.trim(),
      contact_name: draft.name.trim() || undefined,
      email: draft.email.trim(),
      phone: draft.phone.trim() || undefined,
      avatar_url: existing?.avatar_url ?? null,
      member_contact_ids: [],
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
    memberIds.push(id);
  }

  const companyPayload: Contact = {
    ...company,
    member_contact_ids: memberIds,
    updated_at: now,
  };

  const keepIds = new Set([company.id, ...memberIds]);
  next = next.filter((c) => !prevMemberIds.has(c.id) || keepIds.has(c.id));

  return [...next, companyPayload, ...savedMembers];
}
