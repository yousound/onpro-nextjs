import type { Contact } from "@/lib/types/contact";
import {
  clientListContacts,
  contactDisplayName,
  vendorContacts,
} from "@/lib/contacts-store";
import { formatContactAddressOneLine } from "@/lib/contact-address";
import type { PackingSlipDocument } from "@/lib/types/packing-slip";
import type { Project } from "@/lib/types/project";

/** Display name for packing list party dropdowns (company / vendor / client). */
export function packingContactLabel(c: Contact, contacts?: Contact[]): string {
  if (c.segment === "vendor" || c.kind === "company") return c.name;
  return contactDisplayName(c, contacts);
}

/** All directory parties that can appear on a packing list. */
export function packingSlipContactOptions(contacts: Contact[]): Contact[] {
  const map = new Map<string, Contact>();
  for (const c of [...vendorContacts(contacts), ...clientListContacts(contacts)]) {
    map.set(c.id, c);
  }
  return [...map.values()].sort((a, b) =>
    packingContactLabel(a, contacts).localeCompare(packingContactLabel(b, contacts), undefined, {
      sensitivity: "base",
    }),
  );
}

export function packingSlipFieldsFromContact(
  contact: Contact,
  contacts: Contact[],
  fallbackAddress = "",
): { name: string; address: string } {
  const name = packingContactLabel(contact, contacts);
  const address =
    formatContactAddressOneLine(contact.shipping_address ?? contact.billing_address) ||
    fallbackAddress;
  return { name, address };
}

export function findPackingContactById(
  contacts: Contact[],
  id: string | null | undefined,
): Contact | undefined {
  if (!id?.trim()) return undefined;
  return packingSlipContactOptions(contacts).find((c) => c.id === id);
}

export function findPackingContactByName(
  contacts: Contact[],
  name: string,
): Contact | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return packingSlipContactOptions(contacts).find(
    (c) => packingContactLabel(c, contacts).toLowerCase() === needle,
  );
}

export function findPackingContactForProjectClient(
  contacts: Contact[],
  project: Project,
): Contact | undefined {
  return findPackingContactByName(contacts, project.client.name);
}

export function applyCompanyContact(
  slip: PackingSlipDocument,
  contact: Contact | null,
  contacts: Contact[],
): PackingSlipDocument {
  if (!contact) {
    return { ...slip, company_contact_id: null, company_name: "" };
  }
  const { name } = packingSlipFieldsFromContact(contact, contacts);
  return { ...slip, company_contact_id: contact.id, company_name: name };
}

export function applyShipFromContact(
  slip: PackingSlipDocument,
  contact: Contact | null,
  contacts: Contact[],
  fallbackAddress = "",
): PackingSlipDocument {
  if (!contact) {
    return { ...slip, ship_from_contact_id: null, ship_from_name: "", ship_from_address: "" };
  }
  const { name, address } = packingSlipFieldsFromContact(contact, contacts, fallbackAddress);
  return {
    ...slip,
    ship_from_contact_id: contact.id,
    ship_from_name: name,
    ship_from_address: address,
  };
}

export function applyShipToContact(
  slip: PackingSlipDocument,
  contact: Contact | null,
  contacts: Contact[],
): PackingSlipDocument {
  if (!contact) {
    return { ...slip, ship_to_contact_id: null, ship_to_name: "", ship_to_address: "" };
  }
  const { name, address } = packingSlipFieldsFromContact(contact, contacts);
  return {
    ...slip,
    ship_to_contact_id: contact.id,
    ship_to_name: name,
    ship_to_address: address,
  };
}

export function packingContactSelectValue(
  options: Contact[],
  contacts: Contact[],
  contactId: string | null | undefined,
  savedName: string,
): { selectValue: string; inList: boolean; current: string } {
  const current = savedName.trim();
  if (contactId && options.some((c) => c.id === contactId)) {
    return { selectValue: contactId, inList: true, current };
  }
  const byName = findPackingContactByName(contacts, current);
  if (byName && options.some((c) => c.id === byName.id)) {
    return { selectValue: byName.id, inList: true, current };
  }
  if (current) {
    return { selectValue: `__saved:${current}`, inList: false, current };
  }
  return { selectValue: "", inList: true, current: "" };
}
