"use client";

import type { Contact } from "@/lib/types/contact";
import type { VendorQuote } from "@/lib/types/wip";
import { newVendorQuote } from "@/lib/costing-sheet";
import { VendorFieldSelect } from "@/components/vendor-select";

const fieldClass =
  "w-full rounded-md border border-border-light px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const numFieldClass = `${fieldClass} text-right tabular-nums`;

function parseNumber(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function VendorQuotesSection({
  quotes,
  vendors,
  onChange,
  onPullToCosting,
}: {
  quotes: VendorQuote[];
  vendors: Contact[];
  onChange: (next: VendorQuote[]) => void;
  onPullToCosting?: (quoteId: string) => void;
}) {
  function patch(id: string, partial: Partial<VendorQuote>) {
    onChange(quotes.map((q) => (q.id === id ? { ...q, ...partial } : q)));
  }
  function add() {
    onChange([...quotes, newVendorQuote()]);
  }
  function remove(id: string) {
    onChange(quotes.filter((q) => q.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          Inbound vendor quotes for this job. Pull lines into the cost sheet below.
        </p>
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-violet-50"
        >
          + Add quote
        </button>
      </div>

      {quotes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-light bg-slate-50/80 px-4 py-6 text-center text-sm text-text-secondary">
          No vendor quotes yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-light bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-2 py-2">Vendor</th>
                <th className="px-2 py-2">Item / description</th>
                <th className="px-2 py-2 text-right">Unit cost</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2">Notes</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t border-border-light/70">
                  <td className="px-2 py-1.5">
                    <VendorFieldSelect
                      label=""
                      labelClassName="sr-only"
                      vendors={vendors}
                      value={q.vendor}
                      onChange={(name) => patch(q.id, { vendor: name ?? "" })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={fieldClass}
                      value={q.item_description}
                      onChange={(e) => patch(q.id, { item_description: e.target.value })}
                      placeholder="e.g. 5-color plastisol print"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      className={numFieldClass}
                      value={q.unit_cost || ""}
                      onChange={(e) => patch(q.id, { unit_cost: parseNumber(e.target.value) })}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min={0}
                      className={numFieldClass}
                      value={q.qty || ""}
                      onChange={(e) => patch(q.id, { qty: parseNumber(e.target.value) })}
                      placeholder="1"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={fieldClass}
                      value={q.notes ?? ""}
                      onChange={(e) => patch(q.id, { notes: e.target.value || undefined })}
                      placeholder="Note"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex justify-end gap-1">
                      {onPullToCosting ? (
                        <button
                          type="button"
                          onClick={() => onPullToCosting(q.id)}
                          className="rounded-md bg-accent/10 px-2 py-1 text-[10px] font-bold text-accent hover:bg-accent/20"
                          title="Add as a line on the cost sheet"
                        >
                          → Cost sheet
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => remove(q.id)}
                        className="rounded-md px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"
                        aria-label="Remove quote"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
