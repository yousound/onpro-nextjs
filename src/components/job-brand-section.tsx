"use client";

import type { ProjectJob } from "@/lib/types/wip";
import { VendorFieldSelect } from "@/components/vendor-select";
import type { Contact } from "@/lib/types/contact";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function JobBrandSection({
  draft,
  patch,
  vendors,
  isPrimaryJob,
  fieldClass,
}: {
  draft: ProjectJob;
  patch: (partial: Partial<ProjectJob>) => void;
  vendors: Contact[];
  isPrimaryJob: boolean;
  fieldClass: string;
}) {
  return (
    <div className="space-y-5">
      {isPrimaryJob ? (
        <label className={labelClass}>
          Brand
          <input
            className={fieldClass}
            value={draft.garment_brand ?? ""}
            onChange={(e) => patch({ garment_brand: e.target.value })}
            placeholder="e.g. Client brand"
          />
        </label>
      ) : null}

      <label className={labelClass}>
        SKU #
        <input
          className={fieldClass}
          value={draft.sku ?? ""}
          placeholder="Unique SKU (optional)"
          onChange={(e) => patch({ sku: e.target.value.toUpperCase() })}
        />
        <p className="mt-1 text-[11px] font-normal normal-case tracking-normal text-slate-500">
          Must be unique across your workspace.
        </p>
      </label>

      <div>
        <p className="text-[11px] text-slate-500">
          Optional extra fields for this job (e.g. fabric content, decoration notes).
        </p>
        <div className="mt-3 space-y-2">
          {(draft.custom_fields ?? []).map((cf, idx) => (
            <div key={cf.id ?? `custom-field-${idx}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={fieldClass}
                value={cf.key}
                placeholder="Field name"
                onChange={(e) => {
                  const next = [...(draft.custom_fields ?? [])];
                  next[idx] = { ...cf, key: e.target.value };
                  patch({ custom_fields: next });
                }}
              />
              <input
                className={fieldClass}
                value={cf.value}
                placeholder="Value"
                onChange={(e) => {
                  const next = [...(draft.custom_fields ?? [])];
                  next[idx] = { ...cf, value: e.target.value };
                  patch({ custom_fields: next });
                }}
              />
              <button
                type="button"
                onClick={() =>
                  patch({
                    custom_fields: (draft.custom_fields ?? []).filter((_, i) => i !== idx),
                  })
                }
                className="text-xs font-semibold text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            patch({
              custom_fields: [
                ...(draft.custom_fields ?? []),
                { id: `cf-${Date.now().toString(36)}`, key: "", value: "" },
              ],
            })
          }
          className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-[#7c3aed] hover:text-[#7c3aed]"
        >
          + Add field
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Garment blanks (optional)
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Garment style #
            <input
              className={fieldClass}
              value={draft.garment_style_number ?? ""}
              onChange={(e) => patch({ garment_style_number: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Garment color
            <input
              className={fieldClass}
              value={draft.garment_color ?? ""}
              onChange={(e) => patch({ garment_color: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Garment size
            <input
              className={fieldClass}
              value={draft.garment_size ?? ""}
              onChange={(e) => patch({ garment_size: e.target.value })}
            />
          </label>
          <VendorFieldSelect
            label="Supplier"
            vendors={vendors}
            value={draft.lead_vendor}
            onChange={(name) => patch({ lead_vendor: name ?? "" })}
            emptyLabel="Select vendor…"
          />
        </div>
      </div>
    </div>
  );
}
