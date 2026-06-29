"use client";

import {
  PROJECT_DRAFT_FIELD_KEYS,
  PROJECT_DRAFT_FIELD_LABELS,
  mergeProjectDraftFields,
  projectDraftFieldValue,
  type ProjectDraftFieldKey,
} from "@/lib/mailroom/project-draft";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

const labelClass = "block text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export function ProjectDraftFields({
  draft,
  onChange,
}: {
  draft: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  function patch(key: ProjectDraftFieldKey, value: string) {
    onChange(mergeProjectDraftFields(draft, { [key]: value }));
  }

  return (
    <div className="mt-3 space-y-3">
      {PROJECT_DRAFT_FIELD_KEYS.map((key) => (
        <label key={key} className={labelClass}>
          {PROJECT_DRAFT_FIELD_LABELS[key]}
          {key === "due_date" ? (
            <input
              type="date"
              value={projectDraftFieldValue(draft, key)}
              onChange={(e) => patch(key, e.target.value)}
              className={fieldClass}
            />
          ) : (
            <input
              type="text"
              value={projectDraftFieldValue(draft, key)}
              onChange={(e) => patch(key, e.target.value)}
              className={fieldClass}
              placeholder={key === "client_po_number" ? "e.g. GG260601" : undefined}
            />
          )}
        </label>
      ))}
    </div>
  );
}
