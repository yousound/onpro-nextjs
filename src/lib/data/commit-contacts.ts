import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  loadContacts,
  persistCompanyWithMembers,
  removeContactsById,
  saveContacts,
} from "@/lib/contacts-store";
import { projectsUsingClient } from "@/lib/contacts-delete";
import { resolveClientProjectList } from "@/lib/mock/project-session";
import { getLiveCachedProjects, removeLiveContact, upsertLiveContact } from "@/lib/data/live-cache";
import type { CompanyMemberDraft } from "@/lib/company-members";
import { persistContactPermissionsToDb, persistContactToDb } from "@/lib/data/persist-contact";
import type { Contact } from "@/lib/types/contact";
import type { ProjectPermissionFlags } from "@/lib/project-permissions";

function notifyContactsChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
  }
}

/** Mock: write full list. Live: persist each row to Supabase. */
export async function commitContactList(contacts: Contact[]): Promise<void> {
  if (!isClientLiveBackend()) {
    saveContacts(contacts);
    notifyContactsChanged();
    return;
  }
  for (const c of contacts) {
    await persistContactToDb(c);
  }
  notifyContactsChanged();
}

export async function commitSingleContact(contact: Contact): Promise<Contact> {
  if (!isClientLiveBackend()) {
    const contacts = loadContacts();
    const existing = contacts.find((c) => c.id === contact.id);
    const next = existing
      ? contacts.map((c) => (c.id === contact.id ? contact : c))
      : [...contacts, contact];
    saveContacts(next);
    notifyContactsChanged();
    return contact;
  }
  const saved = await persistContactToDb(contact);
  const row = saved ?? contact;
  upsertLiveContact(row);
  notifyContactsChanged();
  return row;
}

export async function commitClientWithMembers(
  contacts: Contact[],
  company: Contact,
  members: CompanyMemberDraft[],
): Promise<void> {
  const next = persistCompanyWithMembers(contacts, company, members);

  if (!isClientLiveBackend()) {
    saveContacts(next);
    return;
  }

  const companyRow = next.find((c) => c.id === company.id) ?? company;
  const savedCompany = await persistContactToDb(companyRow);
  const companyId = savedCompany?.id ?? companyRow.id;

  const memberRows = next.filter(
    (c) => c.segment === "client" && c.parent_company_id === company.id,
  );
  const memberIds: string[] = [];
  for (const m of memberRows) {
    const saved = await persistContactToDb({ ...m, parent_company_id: companyId });
    memberIds.push(saved?.id ?? m.id);
  }

  if (company.kind === "company") {
    await persistContactToDb({
      ...(savedCompany ?? companyRow),
      id: companyId,
      member_contact_ids: memberIds,
    });
  }
}

export type DeleteContactResult = { ok: true } | { ok: false; error: string };

export async function deleteContact(contactId: string): Promise<DeleteContactResult> {
  const contacts = loadContacts();
  const target = contacts.find((c) => c.id === contactId);
  if (!target) return { ok: false, error: "Contact not found." };

  if (target.segment === "client") {
    const projects = resolveClientProjectList(getLiveCachedProjects());
    const blocking = projectsUsingClient(projects, contactId);
    if (blocking.length > 0) {
      const names = blocking.slice(0, 3).map((p) => p.name).join(", ");
      const more = blocking.length > 3 ? ` and ${blocking.length - 3} more` : "";
      return {
        ok: false,
        error: `This client is on ${blocking.length} project${blocking.length === 1 ? "" : "s"} (${names}${more}). Reassign or delete those projects first.`,
      };
    }
  }

  if (!isClientLiveBackend()) {
    saveContacts(removeContactsById(contacts, contactId));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
    }
    return { ok: true };
  }

  try {
    const res = await fetch(`/api/contacts?id=${encodeURIComponent(contactId)}`, {
      method: "DELETE",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "Could not delete contact." };
    removeLiveContact(contactId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete contact." };
  }
}

export async function commitContactPermissions(
  contactId: string,
  permissions: ProjectPermissionFlags,
): Promise<void> {
  if (!isClientLiveBackend()) {
    const now = new Date().toISOString();
    const next = loadContacts().map((c) =>
      c.id === contactId ? { ...c, permissions, updated_at: now } : c,
    );
    saveContacts(next);
    return;
  }
  await persistContactPermissionsToDb(contactId, permissions);
}
