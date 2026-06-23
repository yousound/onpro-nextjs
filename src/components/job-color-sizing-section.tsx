"use client";

import { useMemo, useState } from "react";
import type { ProjectJob } from "@/lib/types/wip";
import { JobColorwayEditor } from "@/components/job-colorway-editor";
import { colorwayRowTotal } from "@/lib/job-colorways";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const fieldClass =
  "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15";

function parseMoney(s: string | null | undefined): number {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function JobColorSizingSection({
  draft,
  patch,
  colorwayRows,
  onColorwayChange,
  displayPrice,
  costingPrice,
}: {
  draft: ProjectJob;
  patch: (partial: Partial<ProjectJob>) => void;
  colorwayRows: import("@/lib/types/wip").JobColorwayRow[];
  onColorwayChange: (rows: import("@/lib/types/wip").JobColorwayRow[]) => void;
  displayPrice: string;
  costingPrice?: string | null;
}) {
  const [optionalOpen, setOptionalOpen] = useState(
    Boolean(
      draft.quote_include_discount ||
        draft.quote_include_sales_tax ||
        draft.quote_include_days_or_hours,
    ),
  );

  const qtyTtl = useMemo(
    () => colorwayRows.reduce((sum, row) => sum + colorwayRowTotal(row), 0),
    [colorwayRows],
  );
  const unitPrice = parseMoney(displayPrice);
  const lineTotal = qtyTtl > 0 && unitPrice > 0 ? qtyTtl * unitPrice : 0;

  return (
    <div className="space-y-5">
      <JobColorwayEditor rows={colorwayRows} onChange={onColorwayChange} />

      <div className="grid gap-4 rounded-2xl border border-slate-200/90 bg-slate-50/70 px-5 py-4 sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty TTL</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{qtyTtl || "—"}</p>
        </div>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Price per unit
          </span>
          <input
            className={`${fieldClass} mt-2`}
            value={displayPrice}
            readOnly={Boolean(costingPrice && !draft.price_manual_override)}
            onChange={(e) => patch({ price: e.target.value, price_manual_override: true })}
            placeholder="0.00"
          />
        </label>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-600">
            {lineTotal > 0 ? formatMoney(lineTotal) : "—"}
          </p>
        </div>
        <div className="flex flex-col justify-end text-xs text-slate-500">
          {costingPrice && !draft.price_manual_override ? (
            <span>From costing · ${costingPrice}</span>
          ) : costingPrice && draft.price_manual_override ? (
            <button
              type="button"
              className="font-semibold text-[#7c3aed] hover:underline"
              onClick={() => patch({ price_manual_override: false, price: costingPrice })}
            >
              Use costing price
            </button>
          ) : (
            <span>Enter unit price or build costing sheet</span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setOptionalOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <span>+ Discount, sales tax, days or hours</span>
          <span className="text-xs font-medium text-slate-400">
            {optionalOpen ? "Hide" : "Include if needed"}
          </span>
        </button>
        {optionalOpen ? (
          <div className="space-y-3 border-t border-slate-100 px-5 py-4">
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
    </div>
  );
}
