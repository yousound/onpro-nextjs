"use client";

import { useMemo } from "react";
import type { Contact } from "@/lib/types/contact";
import { loadContacts, vendorContacts, vendorDisplayName } from "@/lib/contacts-store";
import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";

export function useProjectVendors(): Contact[] {
  return useMemo(() => vendorContacts(loadContacts()), []);
}

export function vendorNameOptions(vendors: Contact[]): string[] {
  const names = vendors.map((v) => vendorDisplayName(v));
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function vendorSelectBindings(value: string | null | undefined, options: string[]) {
  const current = value?.trim() ?? "";
  const match = options.find((n) => n.toLowerCase() === current.toLowerCase());
  const inList = Boolean(match);
  const selectValue = inList ? match! : "";
  return { selectValue, inList, current };
}

const stealthWrapClass =
  "rounded-xl border border-border-light bg-surface-body/40 px-4 py-3";

const stealthLabelClass = "min-w-0 flex-1 text-sm font-medium text-text-secondary";

const fieldLabelClass = "block text-xs font-medium text-text-secondary";

function vendorSearchOptions(vendors: Contact[]): SearchableSelectOption[] {
  return vendorNameOptions(vendors).map((name) => {
    const v = vendors.find((c) => vendorDisplayName(c) === name);
    return {
      value: name,
      label: name,
      sublabel: v?.company_code ? `Code ${v.company_code}` : undefined,
      keywords: [v?.email, v?.company_code, v?.contact_name].filter(Boolean).join(" "),
    };
  });
}

export function VendorStealthSelect({
  label,
  vendors,
  value,
  onCommit,
  emptyLabel = "Select vendor…",
}: {
  label: string;
  vendors: Contact[];
  value: string | null | undefined;
  onCommit: (next: string | null) => void;
  emptyLabel?: string;
}) {
  const options = useMemo(() => vendorSearchOptions(vendors), [vendors]);
  const { selectValue, inList, current } = vendorSelectBindings(value, options.map((o) => o.value));

  return (
    <div className={stealthWrapClass}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={stealthLabelClass}>{label}</span>
        <div className="min-w-[12rem] flex-1">
          <SearchableSelect
            label="Vendor"
            labelClassName="sr-only"
            options={options}
            value={selectValue}
            savedLabel={!inList && current ? current : null}
            placeholder={emptyLabel}
            emptyMessage="No vendors match"
            variant="field"
            onChange={(name) => onCommit(name)}
            onClear={() => onCommit(null)}
          />
        </div>
      </div>
    </div>
  );
}

export function VendorFieldSelect({
  label,
  vendors,
  value,
  onChange,
  emptyLabel = "Select vendor…",
  labelClassName = fieldLabelClass,
}: {
  label: string;
  vendors: Contact[];
  value: string | null | undefined;
  onChange: (name: string | null) => void;
  emptyLabel?: string;
  labelClassName?: string;
}) {
  const options = useMemo(() => vendorSearchOptions(vendors), [vendors]);
  const { selectValue, inList, current } = vendorSelectBindings(value, options.map((o) => o.value));

  return (
    <SearchableSelect
      label={label}
      options={options}
      value={selectValue}
      savedLabel={!inList && current ? current : null}
      placeholder={emptyLabel}
      emptyMessage="No vendors match"
      labelClassName={labelClassName}
      onChange={(name) => onChange(name)}
      onClear={() => onChange(null)}
    />
  );
}
