"use client";

import { useEffect, useMemo, useState } from "react";
import type { JobLabelLine } from "@/lib/types/wip";
import { BarcodePreview } from "@/components/barcode-preview";
import { labelLineSku } from "@/lib/style-number";
import { normalizeScanValue } from "@/lib/scan-value";

type PrintRow = {
  lineId: string;
  scanValue: string;
  sku: string;
  description: string;
  stock: number;
};

export function PrintBarcodeLabelsModal({
  open,
  lines,
  onClose,
}: {
  open: boolean;
  lines: JobLabelLine[];
  onClose: () => void;
}) {
  const rows: PrintRow[] = useMemo(
    () =>
      lines.map((l) => ({
        lineId: l.id,
        scanValue: normalizeScanValue(l.scan_value),
        sku: labelLineSku(l.style_color_code, l.size),
        description: l.description,
        stock: 0,
      })),
    [lines],
  );

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [qty, setQty] = useState<Record<string, number>>({});
  const [caseLabels, setCaseLabels] = useState(false);

  useEffect(() => {
    if (!open) return;
    const ids = new Set(rows.map((r) => r.lineId));
    setSelected(ids);
    setQty(
      Object.fromEntries(rows.map((r) => [r.lineId, Math.max(0, r.stock) || 1])),
    );
    setCaseLabels(false);
  }, [open, rows]);

  if (!open) return null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function printSelected() {
    const toPrint = rows.filter((r) => selected.has(r.lineId) && (qty[r.lineId] ?? 0) > 0);
    if (!toPrint.length) return;

    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;

    const labelBlocks = toPrint
      .flatMap((r) => {
        const count = qty[r.lineId] ?? 1;
        const blocks: string[] = [];
        for (let i = 0; i < count; i++) {
          blocks.push(`
            <div class="label">
              <p class="title">${escapeHtml(r.description)}</p>
              <p class="sku">${escapeHtml(r.sku)}${caseLabels ? " · CASE" : ""}</p>
              <p class="meta"><span>${escapeHtml(r.scanValue)}</span><span>${escapeHtml(r.sku.split("_").pop() ?? "")}</span></p>
              <svg class="barcode" data-value="${escapeHtml(r.scanValue)}"></svg>
            </div>
          `);
        }
        return blocks;
      })
      .join("");

    w.document.write(`<!DOCTYPE html>
<html><head><title>Barcode labels</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
  @page { margin: 12mm; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 8px; }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; }
  .label { width: 2.25in; border: 1px solid #e2e8f0; padding: 8px; page-break-inside: avoid; text-align: center; }
  .title { font-size: 11px; margin: 0 0 4px; text-transform: lowercase; }
  .sku { font-size: 12px; font-weight: 700; margin: 0 0 6px; }
  .meta { display: flex; justify-content: space-between; font-size: 10px; font-weight: 600; margin-bottom: 4px; }
  .barcode { width: 100%; height: 48px; }
</style></head><body>
<div class="grid">${labelBlocks}</div>
<script>
  document.querySelectorAll('svg.barcode').forEach(function(el) {
    try { JsBarcode(el, el.getAttribute('data-value'), { format: 'CODE128', displayValue: true, fontSize: 11, height: 40, margin: 2, width: 1.4 }); } catch(e) {}
  });
  setTimeout(function() { window.print(); }, 400);
</script>
</body></html>`);
    w.document.close();
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
                <th className="py-2 pr-2 w-8" />
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
                <th className="py-2 text-right">Stock</th>
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
                  <td className="py-2 pr-2">
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
                  <td className="py-2 text-right text-slate-500">{r.stock}</td>
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
            Print
          </button>
        </footer>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
