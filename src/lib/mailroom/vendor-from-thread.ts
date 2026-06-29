import {
  findContactByEmailInSegment,
  vendorContacts,
  vendorDisplayName,
} from "@/lib/contacts-store";
import type { Contact } from "@/lib/types/contact";
import type { EmailThread } from "@/lib/types/agent";
import { threadParticipantRoles, type ParticipantRole } from "@/lib/mailroom/thread-participants";

function emailDomain(email: string): string {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "";
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function vendorByDomain(vendors: Contact[], domain: string): Contact | undefined {
  if (!domain) return undefined;
  return vendors.find((v) => emailDomain(v.email) === domain);
}

function vendorByName(vendors: Contact[], name: string): Contact | undefined {
  const needle = normalizeName(name);
  if (!needle) return undefined;
  return vendors.find((v) => {
    const display = normalizeName(vendorDisplayName(v));
    const contact = normalizeName(v.contact_name ?? "");
    const company = normalizeName(v.company_name ?? "");
    return (
      display === needle ||
      contact === needle ||
      company === needle ||
      display.includes(needle) ||
      needle.includes(display)
    );
  });
}

/**
 * Resolve the vendor contact from thread participants — email match first,
 * then domain, then fuzzy name match, then display name from thread role.
 */
export function resolveVendorFromThread(
  thread: EmailThread,
  contacts: Contact[],
  overrides?: Record<string, ParticipantRole>,
): { name: string; contact: Contact | null } | null {
  const vendors = vendorContacts(contacts);
  const vendorParticipants = threadParticipantRoles(thread, overrides).filter(
    (p) => p.role === "vendor",
  );
  if (vendorParticipants.length === 0) return null;

  for (const participant of vendorParticipants) {
    const byEmail = findContactByEmailInSegment(contacts, participant.email, "vendor");
    if (byEmail) {
      return { name: vendorDisplayName(byEmail), contact: byEmail };
    }
  }

  for (const participant of vendorParticipants) {
    const domain = emailDomain(participant.email);
    const byDomain = vendorByDomain(vendors, domain);
    if (byDomain) {
      return { name: vendorDisplayName(byDomain), contact: byDomain };
    }
  }

  for (const participant of vendorParticipants) {
    const byName = vendorByName(vendors, participant.name);
    if (byName) {
      return { name: vendorDisplayName(byName), contact: byName };
    }
  }

  const first = vendorParticipants[0]!;
  return { name: first.name, contact: null };
}

export function inferVendorNameFromThreadWithContacts(
  thread: EmailThread,
  contacts: Contact[],
  overrides?: Record<string, ParticipantRole>,
): string | null {
  return resolveVendorFromThread(thread, contacts, overrides)?.name ?? null;
}
