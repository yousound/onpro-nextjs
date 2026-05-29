import type { JobLabelLine } from "@/lib/types/wip";
import { labelLineSku } from "@/lib/style-number";
import { normalizeScanValue } from "@/lib/scan-value";

export type LabelPrintItem = {
  lineId: string;
  scanValue: string;
  sku: string;
  description: string;
  size: string;
  qty: number;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function labelPrintItemsFromLines(
  lines: JobLabelLine[],
  qtyByLineId?: Record<string, number>,
): LabelPrintItem[] {
  return lines.map((l) => ({
    lineId: l.id,
    scanValue: normalizeScanValue(l.scan_value),
    sku: labelLineSku(l.style_color_code, l.size),
    description: l.description,
    size: l.size,
    qty: Math.max(1, qtyByLineId?.[l.id] ?? 1),
  }));
}

function labelBlocksHtml(items: LabelPrintItem[], caseLabels: boolean): string {
  return items
    .flatMap((r) => {
      const blocks: string[] = [];
      for (let i = 0; i < r.qty; i++) {
        blocks.push(`
          <div class="label">
            <p class="title">${escapeHtml(r.description)}</p>
            <p class="sku">${escapeHtml(r.sku)}${caseLabels ? " · CASE" : ""}</p>
            <p class="meta"><span>${escapeHtml(r.scanValue)}</span><span>${escapeHtml(r.size)}</span></p>
            <svg class="barcode" data-value="${escapeHtml(r.scanValue)}"></svg>
          </div>
        `);
      }
      return blocks;
    })
    .join("");
}

const PRINT_STYLES = `
  @page { margin: 12mm; }
  body { font-family: system-ui, sans-serif; margin: 0; padding: 8px; }
  .toolbar { display: none; }
  @media screen {
    .toolbar {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      position: sticky;
      top: 0;
    }
    .toolbar button {
      font: 600 13px system-ui, sans-serif;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #c4b5fd;
      background: #7c3aed;
      color: white;
      cursor: pointer;
    }
    .toolbar p { margin: 0; font-size: 12px; color: #64748b; align-self: center; }
  }
  .grid { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; }
  .label {
    width: 2.25in;
    border: 1px solid #e2e8f0;
    padding: 8px;
    page-break-inside: avoid;
    text-align: center;
    background: white;
  }
  .title { font-size: 11px; margin: 0 0 4px; text-transform: lowercase; }
  .sku { font-size: 12px; font-weight: 700; margin: 0 0 6px; }
  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .barcode { width: 100%; height: 48px; }
`;

/** Open built labels in a new window — print or Save as PDF from the browser dialog. */
export function openBuiltLabelsPrintWindow(
  items: LabelPrintItem[],
  options?: { caseLabels?: boolean; autoPrint?: boolean; documentTitle?: string },
): Window | null {
  if (!items.length) return null;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return null;

  const title = options?.documentTitle ?? "Barcode labels";
  const caseLabels = options?.caseLabels ?? false;
  const blocks = labelBlocksHtml(items, caseLabels);

  w.document.write(`<!DOCTYPE html>
<html><head><title>${escapeHtml(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>${PRINT_STYLES}</style></head><body>
<div class="toolbar">
  <button type="button" onclick="window.print()">Print</button>
  <p>Use Print → Save as PDF to download a PDF.</p>
</div>
<div class="grid">${blocks}</div>
<script>
  document.querySelectorAll('svg.barcode').forEach(function(el) {
    try {
      JsBarcode(el, el.getAttribute('data-value'), {
        format: 'CODE128', displayValue: true, fontSize: 11, height: 40, margin: 2, width: 1.4
      });
    } catch (e) {}
  });
  ${options?.autoPrint ? "setTimeout(function() { window.print(); }, 500);" : ""}
</script>
</body></html>`);
  w.document.close();
  return w;
}

export function printBuiltLabels(
  lines: JobLabelLine[],
  qtyByLineId?: Record<string, number>,
  options?: { caseLabels?: boolean; documentTitle?: string },
): void {
  const items = labelPrintItemsFromLines(lines, qtyByLineId);
  openBuiltLabelsPrintWindow(items, { ...options, autoPrint: true });
}

export function downloadBuiltLabelsPdf(
  lines: JobLabelLine[],
  documentTitle: string,
  qtyByLineId?: Record<string, number>,
): void {
  printBuiltLabels(lines, qtyByLineId, { documentTitle });
}
