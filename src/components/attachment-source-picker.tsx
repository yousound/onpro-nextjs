"use client";

import { useMemo, type ReactNode } from "react";
import type { AttachmentSourceOption } from "@/lib/attachment-composer-sources";
import { SearchableSelect, type SearchableSelectOption } from "@/components/searchable-select";

export function AttachmentSourcePicker({
  label,
  options,
  value,
  emptyHint,
  onSelect,
  onCreateNew,
  createLabel = "+ Create new",
  extraActions,
}: {
  label: string;
  options: AttachmentSourceOption[];
  value: string;
  emptyHint?: string;
  onSelect: (sourceId: string) => void;
  onCreateNew: () => void;
  createLabel?: string;
  extraActions?: ReactNode;
}) {
  const match = options.find((o) => o.id === value);

  const selectOptions: SearchableSelectOption[] = useMemo(
    () =>
      options.map((o) => ({
        value: o.id,
        label: o.label,
        sublabel: o.sublabel,
        keywords: o.sublabel,
      })),
    [options],
  );

  const savedLabel = !match && value ? options.find((o) => o.id === value)?.label : null;

  return (
    <div className="mb-6 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
      <SearchableSelect
        label={label}
        labelClassName="block text-sm font-semibold text-slate-800"
        options={selectOptions}
        value={match ? value : ""}
        savedLabel={!match && value ? "Saved selection" : savedLabel}
        placeholder={
          options.length === 0
            ? (emptyHint ?? "Nothing saved yet — create one below")
            : "Search or select existing…"
        }
        emptyMessage={emptyHint ?? "No matches — create a new one below"}
        onChange={(id) => onSelect(id)}
        onClear={() => onSelect("")}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreateNew}
          className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
        >
          {createLabel}
        </button>
        {extraActions}
      </div>
    </div>
  );
}
