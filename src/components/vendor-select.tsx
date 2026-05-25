"use client";

import { useMemo } from "react";
import type { Contact } from "@/lib/types/contact";
import { loadContacts, vendorContacts, vendorDisplayName } from "@/lib/contacts-store";

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
  const selectValue = inList ? match! : current ? `__saved:${current}` : "";
  return { selectValue, inList, current };
}

function onVendorPick(raw: string, onChange: (name: string | null) => void) {
  if (raw === "") {
    onChange(null);
    return;
  }
  if (raw.startsWith("__saved:")) return;
  onChange(raw);
}

function VendorOptions({
  options,
  inList,
  current,
}: {
  options: string[];
  inList: boolean;
  current: string;
}) {
  return (
    <>
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      {!inList && current ? (
        <option value={`__saved:${current}`}>{current} (saved)</option>
      ) : null}
    </>
  );
}

const stealthSelectClass =
  "min-h-[1.75rem] w-auto min-w-[9rem] max-w-[13rem] shrink-0 cursor-pointer rounded-lg border border-transparent bg-transparent px-2 py-1 pr-6 text-right text-sm font-semibold text-text-primary outline-none transition hover:bg-white/75 hover:shadow-sm focus:border-accent focus:bg-white focus:shadow-sm focus:ring-2 focus:ring-accent/20";

const fieldSelectClass =
  "mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
  const options = useMemo(() => vendorNameOptions(vendors), [vendors]);
  const { selectValue, inList, current } = vendorSelectBindings(value, options);

  return (
    <div className="rounded-xl border border-border-light bg-surface-body/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm font-medium text-text-secondary">{label}</span>
        <select
          value={selectValue}
          onChange={(e) => onVendorPick(e.target.value, onCommit)}
          className={stealthSelectClass}
          aria-label={label}
        >
          <option value="">{emptyLabel}</option>
          <VendorOptions options={options} inList={inList} current={current} />
        </select>
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
  labelClassName = "block text-xs font-medium text-text-secondary",
}: {
  label: string;
  vendors: Contact[];
  value: string | null | undefined;
  onChange: (name: string | null) => void;
  emptyLabel?: string;
  labelClassName?: string;
}) {
  const options = useMemo(() => vendorNameOptions(vendors), [vendors]);
  const { selectValue, inList, current } = vendorSelectBindings(value, options);

  return (
    <label className={labelClassName}>
      {label}
      <select
        value={selectValue}
        onChange={(e) => onVendorPick(e.target.value, onChange)}
        className={fieldSelectClass}
        aria-label={label}
      >
        <option value="">{emptyLabel}</option>
        <VendorOptions options={options} inList={inList} current={current} />
      </select>
    </label>
  );
}
