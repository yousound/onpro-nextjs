"use client";

import { useMemo, useState } from "react";
import type { Contact } from "@/lib/types/contact";
import type { JobColorwayRow, JobType, ProjectJob } from "@/lib/types/wip";
import { JobColorwayEditor } from "@/components/job-colorway-editor";
import { VendorFieldSelect } from "@/components/vendor-select";
import {
  CATEGORY_CODES,
  JOB_TYPE_OPTIONS,
} from "@/lib/reference/category-codes";
import { colorwayRowTotal } from "@/lib/job-colorways";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-text-secondary";

function parseMoney(s: string | null | undefined): number {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function jobQtyTotal(rows: JobColorwayRow[]): number {
  return rows.reduce((sum, row) => sum + colorwayRowTotal(row), 0);
}

export function JobOverviewFields({
  draft,
  patch,
  vendors,
  categoryDropdown,
  onCategoryChange,
  onJobTypeChange,
  isPrimaryJob,
  colorwayRows,
  onColorwayChange,
  displayPrice,
  costingPrice,
  fieldClass,
  textareaClass,
  showLeadTimesLink,
  onApplyTimelineTemplate,
}: {
  draft: ProjectJob;
  patch: (partial: Partial<ProjectJob>) => void;
  vendors: Contact[];
  categoryDropdown: string;
  onCategoryChange: (label: string) => void;
  onJobTypeChange: (jobType: JobType) => void;
  isPrimaryJob: boolean;
  colorwayRows: JobColorwayRow[];
  onColorwayChange: (rows: JobColorwayRow[]) => void;
  displayPrice: string;
  costingPrice?: string | null;
  fieldClass: string;
  textareaClass: string;
  showLeadTimesLink?: boolean;
  onApplyTimelineTemplate?: () => void;
}) {
  const [optionalOpen, setOptionalOpen] = useState(
    Boolean(
      draft.quote_include_discount ||
        draft.quote_include_sales_tax ||
        draft.quote_include_days_or_hours,
    ),
  );

  const qtyTtl = useMemo(() => jobQtyTotal(colorwayRows), [colorwayRows]);
  const unitPrice = parseMoney(displayPrice);
  const lineTotal = qtyTtl > 0 && unitPrice > 0 ? qtyTtl * unitPrice : 0;

  function patchStyleName(value: string) {
    patch({ name: value, style_name: value });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          Job type
          <select
            className={fieldClass}
            value={draft.job_type ?? "print_production"}
            onChange={(e) => onJobTypeChange(e.target.value as JobType)}
          >
            {JOB_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Category
          <select
            className={fieldClass}
            value={categoryDropdown}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            {CATEGORY_CODES.map((c) => (
              <option key={c.code} value={c.dropdownLabel}>
                {c.dropdownLabel}
              </option>
            ))}
          </select>
        </label>
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
        ) : (
          <div className="flex flex-col justify-end">
            <VendorFieldSelect
              label="Supplier"
              vendors={vendors}
              value={draft.lead_vendor}
              onChange={(name) => patch({ lead_vendor: name ?? "" })}
            />
          </div>
        )}
      </div>

      {showLeadTimesLink && onApplyTimelineTemplate ? (
        <button
          type="button"
          onClick={onApplyTimelineTemplate}
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Lead times — apply template for this job type
        </button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Style number
          <input
            className={fieldClass}
            value={draft.style_number ?? ""}
            placeholder="e.g. GGT01"
            onChange={(e) => patch({ style_number: e.target.value.toUpperCase() })}
          />
        </label>
        <label className={labelClass}>
          Style name
          <input
            className={fieldClass}
            value={draft.name}
            placeholder="Product or style name"
            onChange={(e) => patchStyleName(e.target.value)}
          />
        </label>
      </div>

      <label className={labelClass}>
        Item description
        <textarea
          className={textareaClass}
          rows={2}
          value={draft.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="What we are making — decoration, materials, notes for the client quote"
        />
      </label>

      <div>
        <p className={labelClass}>Color / size breakdown</p>
        <div className="mt-2">
          <JobColorwayEditor rows={colorwayRows} onChange={onColorwayChange} />
        </div>
        <div className="mt-3 grid gap-3 rounded-xl border border-border-light bg-slate-50/80 px-4 py-3 sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Qty TTL</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{qtyTtl || "—"}</p>
          </div>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              Price per unit
            </span>
            <input
              className={`${fieldClass} mt-1`}
              value={displayPrice}
              readOnly={Boolean(costingPrice && !draft.price_manual_override)}
              onChange={(e) => patch({ price: e.target.value, price_manual_override: true })}
              placeholder="0.00"
            />
          </label>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Total</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700">
              {lineTotal > 0 ? formatMoney(lineTotal) : "—"}
            </p>
          </div>
          <div className="flex flex-col justify-end text-[11px] text-text-secondary">
            {costingPrice && !draft.price_manual_override ? (
              <span>From costing · ${costingPrice}</span>
            ) : costingPrice && draft.price_manual_override ? (
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => patch({ price_manual_override: false, price: costingPrice })}
              >
                Use costing price
              </button>
            ) : (
              <span>Enter unit price or build costing sheet</span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border-light bg-white">
        <button
          type="button"
          onClick={() => setOptionalOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-text-primary hover:bg-slate-50"
        >
          <span>+ Discount, sales tax, days or hours</span>
          <span className="text-xs text-text-secondary">{optionalOpen ? "Hide" : "Include if needed"}</span>
        </button>
        {optionalOpen ? (
          <div className="space-y-3 border-t border-border-light px-4 py-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(draft.quote_include_discount)}
                onChange={(e) => patch({ quote_include_discount: e.target.checked })}
              />
              Include discount
            </label>
            {draft.quote_include_discount ? (
              <input
                className={fieldClass}
                value={draft.quote_discount ?? ""}
                onChange={(e) => patch({ quote_discount: e.target.value || null })}
                placeholder="Discount amount or %"
              />
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(draft.quote_include_sales_tax)}
                onChange={(e) => patch({ quote_include_sales_tax: e.target.checked })}
              />
              Include sales tax
            </label>
            {draft.quote_include_sales_tax ? (
              <input
                className={fieldClass}
                value={draft.quote_sales_tax ?? ""}
                onChange={(e) => patch({ quote_sales_tax: e.target.value || null })}
                placeholder="Sales tax amount or %"
              />
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(draft.quote_include_days_or_hours)}
                onChange={(e) => patch({ quote_include_days_or_hours: e.target.checked })}
              />
              Include days or hours
            </label>
            {draft.quote_include_days_or_hours ? (
              <input
                className={fieldClass}
                value={draft.quote_days_or_hours ?? ""}
                onChange={(e) => patch({ quote_days_or_hours: e.target.value || null })}
                placeholder="e.g. 5 business days or 12 hours"
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {!isPrimaryJob ? null : (
        <div className="rounded-xl border border-border-light bg-surface-body/40 px-4 py-3">
          <VendorFieldSelect
            label="Vendor (optional)"
            vendors={vendors}
            value={draft.lead_vendor}
            onChange={(name) => patch({ lead_vendor: name ?? "" })}
          />
        </div>
      )}
    </div>
  );
}
