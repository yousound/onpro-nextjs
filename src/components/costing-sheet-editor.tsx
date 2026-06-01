"use client";

import { useEffect, useMemo, useState } from "react";
import type { Contact } from "@/lib/types/contact";
import type {
  CostingLine,
  CostingMadeIn,
  CostingSheet,
  CostingType,
  ProjectJob,
  VendorQuote,
} from "@/lib/types/wip";
import {
  applyAggregateMargin,
  costingLineFromVendorQuote,
  costingTotals,
  impliedMarginPercent,
  newCostingLine,
  priceFromCostAndMargin,
} from "@/lib/costing-sheet";
import { printCostingSheet } from "@/lib/costing-sheet-print";
import {
  type CostingTemplate,
  deleteCostTemplate,
  listCostTemplates,
  saveCostTemplate,
} from "@/lib/cost-templates";
import { categoryCodeForDropdown } from "@/lib/reference/category-codes";
import {
  listVendorPrices,
  upsertVendorPrice,
  type VendorPriceEntry,
} from "@/lib/vendor-price-book";
import { VendorFieldSelect } from "@/components/vendor-select";

const fieldClass =
  "w-full rounded-md border border-border-light px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const numFieldClass = `${fieldClass} text-right tabular-nums`;

const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-text-secondary";

function currency(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseNumber(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function CostingSheetEditor({
  job,
  sheet,
  vendors,
  vendorQuotes,
  onChange,
  onGenerateEstimate,
}: {
  job: ProjectJob;
  sheet: CostingSheet;
  vendors: Contact[];
  vendorQuotes: VendorQuote[];
  onChange: (next: CostingSheet) => void;
  onGenerateEstimate?: () => void;
}) {
  const totals = useMemo(() => costingTotals(sheet), [sheet]);
  const quotesById = useMemo(
    () => new Map(vendorQuotes.map((q) => [q.id, q])),
    [vendorQuotes],
  );
  const categoryCode = useMemo(
    () => (job.category ? categoryCodeForDropdown(job.category) : ""),
    [job.category],
  );
  const [templates, setTemplates] = useState<CostingTemplate[]>([]);

  useEffect(() => {
    setTemplates(listCostTemplates(categoryCode));
  }, [categoryCode]);

  function handleSaveAsTemplate() {
    const name = window.prompt("Template name?");
    if (!name) return;
    const t = saveCostTemplate(categoryCode || "GEN", name, sheet);
    setTemplates((prev) => [...prev, t]);
  }

  function handleApplyTemplate(templateId: string) {
    if (!templateId) return;
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    onChange({
      ...sheet,
      costing_type: tmpl.sheet.costing_type,
      made_in: tmpl.sheet.made_in,
      lines: tmpl.sheet.lines.map((l) => ({
        ...l,
        id: `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      })),
      aggregate_margin_mode: tmpl.sheet.aggregate_margin_mode,
      aggregate_margin_value: tmpl.sheet.aggregate_margin_value,
      notes: tmpl.sheet.notes,
    });
  }

  function handleDeleteTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    deleteCostTemplate(t.category_code, t.id);
    setTemplates((prev) => prev.filter((x) => x.id !== templateId));
  }

  function commitVendorPriceFor(line: CostingLine) {
    if (line.vendor && line.description && line.cost > 0) {
      upsertVendorPrice(line.vendor, line.description, line.cost);
    }
  }

  function patch(partial: Partial<CostingSheet>) {
    onChange({ ...sheet, ...partial });
  }

  function patchLine(id: string, partial: Partial<CostingLine>) {
    onChange({
      ...sheet,
      lines: sheet.lines.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...partial };
        if ("cost" in partial || "margin_mode" in partial || "margin_value" in partial) {
          if (!("price" in partial)) {
            next.price = priceFromCostAndMargin(next.cost, next.margin_mode, next.margin_value);
          }
        } else if ("price" in partial) {
          next.margin_mode = "amount";
          next.margin_value = next.price - next.cost;
        }
        return next;
      }),
    });
  }

  function addLine() {
    onChange({ ...sheet, lines: [...sheet.lines, newCostingLine({ qty: sheet.estimated_qty || 1 })] });
  }

  function removeLine(id: string) {
    onChange({ ...sheet, lines: sheet.lines.filter((l) => l.id !== id) });
  }

  function pullFromQuote(quoteId: string) {
    const q = quotesById.get(quoteId);
    if (!q) return;
    onChange({ ...sheet, lines: [...sheet.lines, costingLineFromVendorQuote(q)] });
  }

  function applyAggregate(mode: "percent" | "amount", value: number) {
    onChange(applyAggregateMargin(sheet, mode, value));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          Costing type
          <select
            className={`${fieldClass} mt-1 font-semibold uppercase`}
            value={sheet.costing_type}
            onChange={(e) => patch({ costing_type: e.target.value as CostingType })}
          >
            <option value="print_production">Print Production</option>
            <option value="full_package">Full Package</option>
          </select>
        </label>
        <label className={labelClass}>
          Made in
          <select
            className={`${fieldClass} mt-1 font-semibold uppercase`}
            value={sheet.made_in ?? "USA"}
            onChange={(e) => patch({ made_in: e.target.value as CostingMadeIn })}
          >
            <option value="USA">USA</option>
            <option value="China">China</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label className={labelClass}>
          Estimated qty
          <input
            type="number"
            min={0}
            className={`${numFieldClass} mt-1`}
            value={sheet.estimated_qty || ""}
            onChange={(e) => patch({ estimated_qty: parseNumber(e.target.value) })}
            placeholder="100"
          />
        </label>
        <div className="flex items-end gap-2">
          {onGenerateEstimate ? (
            <button
              type="button"
              onClick={onGenerateEstimate}
              disabled={sheet.lines.length === 0}
              className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Generate Estimate
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => printCostingSheet(job, sheet)}
            disabled={sheet.lines.length === 0}
            className="rounded-lg border border-border-light px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Print
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-light bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
          Templates
          {categoryCode ? <span className="ml-1 font-mono text-text-primary">({categoryCode})</span> : null}
        </p>
        {templates.length === 0 ? (
          <p className="text-[11px] text-text-secondary">No templates saved yet.</p>
        ) : (
          <select
            className="rounded-md border border-border-light bg-white px-2 py-1 text-xs"
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              if (val) handleApplyTemplate(val);
              e.target.value = "";
            }}
          >
            <option value="">Apply template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {templates.length > 0 ? (
          <select
            className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-700"
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              if (val) handleDeleteTemplate(val);
              e.target.value = "";
            }}
          >
            <option value="">Delete template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={handleSaveAsTemplate}
          disabled={sheet.lines.length === 0}
          className="ml-auto rounded-md border border-accent/40 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save as template
        </button>
      </div>

      {vendorQuotes.length > 0 ? (
        <div className="rounded-lg border border-violet-100/90 bg-violet-50/50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            Pull from vendor quotes
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vendorQuotes.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => pullFromQuote(q.id)}
                className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-accent ring-1 ring-accent/30 hover:bg-violet-100"
              >
                {q.vendor || "Vendor"} · {q.item_description || "—"} · ${q.unit_cost.toFixed(2)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border-light bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            <tr>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2">Vendor</th>
              <th className="px-2 py-2 text-right">Cost</th>
              <th className="px-2 py-2 text-right">Margin</th>
              <th className="px-2 py-2 text-right">Price</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Total</th>
              <th className="px-2 py-2">Note</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sheet.lines.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-3 py-6 text-center text-text-secondary"
                >
                  No lines yet. Add one or pull from a vendor quote.
                </td>
              </tr>
            ) : (
              sheet.lines.map((l) => {
                const lineTotal = l.price * l.qty;
                return (
                  <tr key={l.id} className="border-t border-border-light/70">
                    <td className="px-2 py-1.5">
                      <input
                        className={fieldClass}
                        value={l.description}
                        placeholder="Item description"
                        onChange={(e) => patchLine(l.id, { description: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <VendorFieldSelect
                        label=""
                        labelClassName="sr-only"
                        vendors={vendors}
                        value={l.vendor}
                        onChange={(v) => patchLine(l.id, { vendor: v })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        className={numFieldClass}
                        value={l.cost || ""}
                        onChange={(e) => patchLine(l.id, { cost: parseNumber(e.target.value) })}
                        onBlur={() => commitVendorPriceFor(l)}
                        placeholder="0.00"
                      />
                      <VendorPriceSuggestions
                        line={l}
                        onApply={(entry) =>
                          patchLine(l.id, {
                            description: entry.description,
                            cost: entry.default_cost,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <select
                          className={`${fieldClass} w-12 px-1 text-center`}
                          value={l.margin_mode}
                          onChange={(e) =>
                            patchLine(l.id, { margin_mode: e.target.value as "percent" | "amount" })
                          }
                          aria-label="Margin mode"
                        >
                          <option value="percent">%</option>
                          <option value="amount">$</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          className={numFieldClass}
                          value={l.margin_value || ""}
                          onChange={(e) =>
                            patchLine(l.id, { margin_value: parseNumber(e.target.value) })
                          }
                          placeholder="0"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        className={numFieldClass}
                        value={l.price || ""}
                        onChange={(e) => patchLine(l.id, { price: parseNumber(e.target.value) })}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        className={numFieldClass}
                        value={l.qty || ""}
                        onChange={(e) => patchLine(l.id, { qty: parseNumber(e.target.value) })}
                        placeholder="1"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-text-primary">
                      {currency(lineTotal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        className={fieldClass}
                        value={l.note ?? ""}
                        onChange={(e) => patchLine(l.id, { note: e.target.value || undefined })}
                        placeholder="Note"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeLine(l.id)}
                        className="text-[10px] font-semibold text-red-600 hover:underline"
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot className="border-t border-border-light bg-slate-50 text-sm">
            <tr>
              <td colSpan={5} className="px-2 py-2 text-right text-[11px] font-semibold uppercase text-text-secondary">
                TOTAL
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text-primary">
                {currency(totals.total_cost)}
              </td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-text-primary">
                {currency(totals.total_price)}
              </td>
              <td colSpan={2} className="px-2 py-2 text-right text-[11px] text-text-secondary">
                FOB {sheet.made_in === "China" ? "FACTORY" : "LOS ANGELES"}
              </td>
            </tr>
            <tr className="bg-yellow-200/80">
              <td colSpan={5} className="px-2 py-2 text-right text-[11px] font-bold uppercase text-yellow-950">
                MARGIN (aggregate override)
              </td>
              <td className="px-2 py-2">
                <div className="flex justify-end gap-1">
                  <select
                    className={`${fieldClass} w-14 bg-white px-1 text-center`}
                    value={sheet.aggregate_margin_mode ?? "percent"}
                    onChange={(e) =>
                      patch({ aggregate_margin_mode: e.target.value as "percent" | "amount" })
                    }
                    aria-label="Aggregate margin mode"
                  >
                    <option value="percent">%</option>
                    <option value="amount">$</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    className={`${numFieldClass} w-24 bg-white`}
                    value={sheet.aggregate_margin_value || ""}
                    onChange={(e) => patch({ aggregate_margin_value: parseNumber(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-yellow-950">
                <span className="font-bold">{totals.aggregate_margin_percent.toFixed(1)}%</span>
              </td>
              <td colSpan={2} className="px-2 py-2 text-right">
                <button
                  type="button"
                  onClick={() =>
                    applyAggregate(
                      sheet.aggregate_margin_mode ?? "percent",
                      sheet.aggregate_margin_value,
                    )
                  }
                  className="rounded-md bg-yellow-900 px-2 py-1 text-[10px] font-bold text-white hover:bg-yellow-950"
                >
                  Apply to lines
                </button>
              </td>
            </tr>
            <tr>
              <td colSpan={5} className="px-2 py-2 text-right text-[11px] font-semibold uppercase text-text-secondary">
                ESTIMATED BUY
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                {sheet.estimated_qty || 0}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                {currency(totals.total_price)}
              </td>
              <td colSpan={2} className="px-2 py-2 text-right font-semibold tabular-nums text-text-primary">
                {currency(totals.estimated_buy_total)}
              </td>
            </tr>
            <tr>
              <td colSpan={5} className="px-2 py-2 text-right text-[11px] font-semibold uppercase text-text-secondary">
                ESTIMATED CD PROFIT
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                {sheet.estimated_qty || 0}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-text-secondary">
                {currency(totals.cd_profit_unit)}
              </td>
              <td colSpan={2} className="px-2 py-2 text-right font-semibold tabular-nums text-text-primary">
                {currency(totals.cd_profit_total)}
              </td>
            </tr>
            <tr className="bg-emerald-200/80">
              <td colSpan={6} className="px-2 py-2 text-right text-[11px] font-bold uppercase text-emerald-950">
                FINAL COST TO QUOTE CLIENT
              </td>
              <td colSpan={3} className="px-2 py-2 text-right text-base font-extrabold tabular-nums text-emerald-950">
                {currency(totals.final_cost_to_quote_client)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addLine}
          className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-violet-50"
        >
          + Add line
        </button>
        <p className="text-[11px] text-text-secondary">
          Margin column overrides per line; the aggregate row recalculates ALL lines.
        </p>
      </div>

      <label className={labelClass}>
        Notes
        <textarea
          rows={2}
          className={`${fieldClass} mt-1`}
          value={sheet.notes ?? ""}
          onChange={(e) => patch({ notes: e.target.value || undefined })}
          placeholder="Optional notes — appear under the table on print."
        />
      </label>
    </div>
  );
}

/* Used by the modal header chip. */
export function totalsFromSheet(sheet: CostingSheet) {
  return costingTotals(sheet);
}

function VendorPriceSuggestions({
  line,
  onApply,
}: {
  line: CostingLine;
  onApply: (entry: VendorPriceEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(
    () => (line.vendor ? listVendorPrices(line.vendor) : []),
    [line.vendor],
  );
  if (!line.vendor || suggestions.length === 0) return null;
  return (
    <div className="mt-1 text-[10px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-semibold text-accent hover:underline"
      >
        {open ? "Hide" : `${suggestions.length} saved`}
      </button>
      {open ? (
        <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border-light bg-white p-1">
          {suggestions.map((s) => (
            <li key={`${s.description}-${s.last_used}`}>
              <button
                type="button"
                onClick={() => {
                  onApply(s);
                  setOpen(false);
                }}
                className="block w-full rounded px-1.5 py-1 text-left text-[10px] hover:bg-slate-100"
              >
                <span className="font-semibold">${s.default_cost.toFixed(2)}</span>{" "}
                <span className="text-text-secondary">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { impliedMarginPercent };
