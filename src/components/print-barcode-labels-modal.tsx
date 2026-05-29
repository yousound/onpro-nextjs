"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobLabelLine } from "@/lib/types/wip";
import { labelPrintItemsFromLines, printBuiltLabels } from "@/lib/label-print";

export function PrintBarcodeLabelsModal({
  open,
  lines,
  jobTitle = "Job",
  qtyByLineId,
  onClose,
}: {
  open: boolean;
  lines: JobLabelLine[];
  jobTitle?: string;
  /** Pre-fill copy counts (e.g. from mobile station sheet quantities). */
  qtyByLineId?: Record<string, number>;
  onClose: () => void;
}) {
  const rows = useMemo(() => labelPrintItemsFromLines(lines), [lines]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [qty, setQty] = useState<Record<string, number>>({});
  const [caseLabels, setCaseLabels] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ids = new Set(rows.map((r) => r.lineId));
    setSelected(ids);
    setQty(
      Object.fromEntries(
        rows.map((r) => [r.lineId, Math.max(1, qtyByLineId?.[r.lineId] ?? 1)]),
      ),
    );
    setCaseLabels(false);
  }, [open, rows, qtyByLineId]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function qtyMap(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of rows) {
      if (!selected.has(r.lineId)) continue;
      out[r.lineId] = qty[r.lineId] ?? 1;
    }
    return out;
  }

  function printSelected() {
    const map = qtyMap();
    const filtered = lines.filter((l) => selected.has(l.id) && (map[l.id] ?? 0) > 0);
    if (!filtered.length) return;
    printBuiltLabels(filtered, map, {
      caseLabels,
      documentTitle: `${jobTitle} labels`,
    });
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="print-barcodes-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="print-barcodes-title" className="text-lg font-bold text-slate-900">
            Print barcode labels
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <th className="w-8 py-2 pr-2" />
                <th className="py-2 pr-2">Item ID</th>
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 pr-2">
                  <label className="inline-flex items-center gap-1.5 normal-case font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={caseLabels}
                      onChange={(e) => setCaseLabels(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Case labels
                  </label>
                </th>
                <th className="py-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.lineId} className="border-b border-slate-100">
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.lineId)}
                      onChange={() => toggle(r.lineId)}
                      aria-label={`Select ${r.sku}`}
                    />
                  </td>
                  <td className="py-2 pr-2 font-mono text-slate-900">{r.scanValue}</td>
                  <td className="py-2 pr-2 font-medium text-slate-800">{r.sku}</td>
                  <td className="py-2 pr-2 text-xs text-slate-500">{r.description}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={qty[r.lineId] ?? 0}
                      onChange={(e) =>
                        setQty((prev) => ({
                          ...prev,
                          [r.lineId]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="w-16 rounded border border-slate-200 px-2 py-1 text-sm"
                      aria-label={`Quantity for ${r.sku}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Generate label lines first.</p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={printSelected}
            disabled={!rows.some((r) => selected.has(r.lineId))}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Print / PDF
          </button>
        </footer>
      </div>
    </div>
  );
}
