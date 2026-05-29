"use client";

import { useMemo } from "react";
import type { Contact } from "@/lib/types/contact";
import { formatContactAddressOneLine } from "@/lib/contact-address";
import {
  contactPickerLabel,
  contactPickerSelectValue,
  contactsForPicker,
  type ContactPickerScope,
} from "@/lib/attachment-contact-options";
import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";

export function contactFieldsFromPick(contact: Contact, contacts: Contact[]): {
  name: string;
  address: string;
  email: string;
} {
  const name = contactPickerLabel(contact, contacts);
  const address = formatContactAddressOneLine(
    contact.shipping_address ?? contact.billing_address,
  );
  return { name, address, email: contact.email?.trim() ?? "" };
}

export function ContactFieldSelect({
  label,
  scope,
  contacts,
  value,
  onPick,
  emptyLabel = "Select…",
  variant = "field",
  labelClassName = "block text-sm font-medium text-slate-600",
}: {
  label: string;
  scope: ContactPickerScope;
  contacts: Contact[];
  value: string;
  onPick: (contact: Contact | null) => void;
  emptyLabel?: string;
  variant?: "field" | "document";
  labelClassName?: string;
}) {
  const pickerContacts = useMemo(() => contactsForPicker(contacts, scope), [contacts, scope]);
  const { selectValue, inList, current } = useMemo(
    () => contactPickerSelectValue(pickerContacts, contacts, value),
    [pickerContacts, contacts, value],
  );

  const options: SearchableSelectOption[] = useMemo(
    () =>
      pickerContacts.map((c) => ({
        value: c.id,
        label: contactPickerLabel(c, contacts),
        sublabel: [c.email, c.segment === "vendor" ? c.company_code : null].filter(Boolean).join(" · ") || undefined,
        keywords: [c.name, c.contact_name, c.email, c.company_code, c.phone].filter(Boolean).join(" "),
      })),
    [pickerContacts, contacts],
  );

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={inList ? selectValue : ""}
      savedLabel={!inList && current ? current : null}
      placeholder={emptyLabel}
      emptyMessage="No contacts match — try another name"
      variant={variant}
      labelClassName={labelClassName}
      onChange={(id) => {
        const contact = pickerContacts.find((c) => c.id === id) ?? null;
        onPick(contact);
      }}
      onClear={() => onPick(null)}
    />
  );
}
