import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import { contactDisplayName } from "@/lib/contacts-store";

/** Contact ids to remove when deleting a company (includes members). */
export function contactIdsForDelete(contacts: Contact[], contactId: string): string[] {
  const target = contacts.find((c) => c.id === contactId);
  if (!target) return [];
  const ids = new Set<string>([contactId]);
  if (target.kind === "company") {
    for (const c of contacts) {
      if (c.parent_company_id === contactId) ids.add(c.id);
    }
    for (const mid of target.member_contact_ids ?? []) ids.add(mid);
  }
  return [...ids];
}

export function projectsUsingClient(
  projects: Project[],
  contactId: string,
): Project[] {
  const idNum = Number(contactId);
  if (!Number.isFinite(idNum)) return [];
  return projects.filter((p) => p.client.id === idNum);
}

export function deleteConfirmMessage(
  contacts: Contact[],
  contactId: string,
): string {
  const target = contacts.find((c) => c.id === contactId);
  if (!target) return "Remove this contact from People? This cannot be undone.";
  const label = contactDisplayName(target, contacts);
  if (target.kind === "company" && target.segment === "client") {
    const memberCount = contactIdsForDelete(contacts, contactId).length - 1;
    if (memberCount > 0) {
      return `Delete "${label}" and ${memberCount} company member${memberCount === 1 ? "" : "s"} from People? This cannot be undone.`;
    }
  }
  return `Remove "${label}" from People? This cannot be undone.`;
}
