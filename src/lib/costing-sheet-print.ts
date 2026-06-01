import type { CostingSheet, ProjectJob } from "@/lib/types/wip";
import { costingTotals } from "@/lib/costing-sheet";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function currency(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function buildCostingSheetHtml(job: ProjectJob, sheet: CostingSheet): string {
  const totals = costingTotals(sheet);
  const rows = sheet.lines
    .map(
      (l) => `
        <tr>
          <td>${escapeHtml(l.description)}</td>
          <td>${escapeHtml(l.vendor ?? "")}</td>
          <td class="num">${currency(l.cost)}</td>
          <td class="num">${l.margin_mode === "percent" ? `${l.margin_value}%` : currency(l.margin_value)}</td>
          <td class="num">${currency(l.price)}</td>
          <td class="num">${l.qty}</td>
          <td class="num">${currency(l.price * l.qty)}</td>
          <td>${escapeHtml(l.note ?? "")}</td>
        </tr>`,
    )
    .join("");

  return `
    <article class="sheet">
      <header>
        <h1>${escapeHtml(job.style_number || "")} — ${escapeHtml(job.name || "")}</h1>
        <p class="meta">
          ${escapeHtml(job.job_number ?? "")} ·
          ${escapeHtml(sheet.costing_type === "full_package" ? "Full Package" : "Print Production")} ·
          Made in ${escapeHtml(sheet.made_in ?? "—")} ·
          Est. qty ${sheet.estimated_qty || 0}
        </p>
      </header>
      <table>
        <thead>
          <tr>
            <th>Item</th><th>Vendor</th><th class="num">Cost</th><th class="num">Margin</th>
            <th class="num">Price</th><th class="num">Qty</th><th class="num">Total</th><th>Note</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="total">
            <td colspan="2">TOTAL</td>
            <td class="num">${currency(totals.total_cost)}</td>
            <td></td>
            <td></td>
            <td></td>
            <td class="num">${currency(totals.total_price)}</td>
            <td></td>
          </tr>
          <tr class="aggregate">
            <td colspan="6">MARGIN ${totals.aggregate_margin_percent.toFixed(1)}%</td>
            <td class="num">${currency(totals.cd_profit_total)}</td>
            <td>CD profit</td>
          </tr>
          <tr class="final">
            <td colspan="6">FINAL COST TO QUOTE CLIENT</td>
            <td class="num">${currency(totals.final_cost_to_quote_client)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      ${sheet.notes ? `<p class="notes">${escapeHtml(sheet.notes)}</p>` : ""}
    </article>`;
}

const PRINT_STYLES = `
  @page { size: letter landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; color: #0f172a; margin: 0; padding: 0; }
  .toolbar { display: none; }
  @media screen {
    body { background: #e8eaed; }
    .toolbar {
      display: flex; gap: 12px; align-items: center;
      padding: 12px 16px; background: white; border-bottom: 1px solid #ccc;
      position: sticky; top: 0; z-index: 1;
    }
    .toolbar button {
      font: 600 13px system-ui; padding: 8px 16px; border-radius: 8px;
      border: none; background: #7c3aed; color: white; cursor: pointer;
    }
    .toolbar p { margin: 0; font-size: 12px; color: #64748b; }
    .sheet-wrap { display: flex; justify-content: center; padding: 20px; }
  }
  .sheet { width: 100%; max-width: 11in; background: white; padding: 0.4in; }
  header h1 { font-size: 22px; margin: 0; }
  .meta { font-size: 12px; color: #475569; margin: 4px 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; }
  tr.aggregate td { background: #fef9c3; }
  tr.final td { background: #d1fae5; font-size: 15px; }
  .notes { margin-top: 12px; font-size: 12px; color: #475569; white-space: pre-wrap; }
  @media print {
    body { background: white; }
    .sheet-wrap { padding: 0; }
    .sheet { max-width: none; padding: 0; }
  }
`;

export function openCostingSheetPrintWindow(
  job: ProjectJob,
  sheet: CostingSheet,
  options?: { autoPrint?: boolean; documentTitle?: string },
): Window | null {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return null;
  const title = options?.documentTitle ?? `Cost sheet · ${job.job_number ?? job.name}`;
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style></head><body>
<div class="toolbar">
  <button type="button" onclick="window.print()">Print</button>
  <p>Print → Save as PDF to download.</p>
</div>
<div class="sheet-wrap">${buildCostingSheetHtml(job, sheet)}</div>
${options?.autoPrint ? "<script>setTimeout(function(){window.print();},400);</script>" : ""}
</body></html>`);
  w.document.close();
  return w;
}

export function printCostingSheet(job: ProjectJob, sheet: CostingSheet, documentTitle?: string): void {
  openCostingSheetPrintWindow(job, sheet, { autoPrint: true, documentTitle });
}
