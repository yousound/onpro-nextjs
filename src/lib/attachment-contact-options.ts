import type { Contact } from "@/lib/types/contact";
import {
  clientListContacts,
  contactDisplayName,
  contactsForSegment,
  vendorContacts,
  vendorDisplayName,
} from "@/lib/contacts-store";
import { packingContactLabel, packingSlipContactOptions } from "@/lib/packing-slip-contacts";

export type ContactPickerScope = "vendor" | "client" | "party" | "from" | "all";

export function contactsForPicker(contacts: Contact[], scope: ContactPickerScope): Contact[] {
  switch (scope) {
    case "vendor":
      return [...vendorContacts(contacts)].sort((a, b) =>
        vendorDisplayName(a).localeCompare(vendorDisplayName(b), undefined, { sensitivity: "base" }),
      );
    case "client":
      return clientListContacts(contacts);
    case "party":
      return packingSlipContactOptions(contacts);
    case "from":
      return [
        ...contactsForSegment(contacts, "team"),
        ...vendorContacts(contacts),
      ].sort((a, b) =>
        contactPickerLabel(a, contacts).localeCompare(contactPickerLabel(b, contacts), undefined, {
          sensitivity: "base",
        }),
      );
    case "all":
      return [...contacts].sort((a, b) =>
        contactPickerLabel(a, contacts).localeCompare(contactPickerLabel(b, contacts), undefined, {
          sensitivity: "base",
        }),
      );
    default:
      return [];
  }
}

export function contactPickerLabel(c: Contact, contacts?: Contact[]): string {
  if (c.segment === "vendor") return vendorDisplayName(c);
  if (c.segment === "client") return packingContactLabel(c, contacts);
  return contactDisplayName(c, contacts);
}

export function findContactInPicker(
  contacts: Contact[],
  scope: ContactPickerScope,
  name: string,
): Contact | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return contactsForPicker(contacts, scope).find(
    (c) => contactPickerLabel(c, contacts).toLowerCase() === needle,
  );
}

export function contactPickerSelectValue(
  options: Contact[],
  contacts: Contact[],
  savedName: string,
): { selectValue: string; inList: boolean; current: string } {
  const current = savedName.trim();
  const match = options.find(
    (c) => contactPickerLabel(c, contacts).toLowerCase() === current.toLowerCase(),
  );
  if (match) return { selectValue: match.id, inList: true, current };
  if (current) return { selectValue: `__saved:${current}`, inList: false, current };
  return { selectValue: "", inList: true, current: "" };
}
