import type { Estimate, ProjectJob } from "@/lib/types/wip";
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

export function buildEstimateHtml(
  job: ProjectJob,
  est: Estimate,
  clientName?: string,
): string {
  const sheet = est.costing_sheet_snapshot;
  const totals = costingTotals(sheet);
  const rows = sheet.lines
    .map(
      (l) => `
        <tr>
          <td>${escapeHtml(l.description)}</td>
          <td class="num">${l.qty}</td>
          <td class="num">${currency(l.price)}</td>
          <td class="num">${currency(l.price * l.qty)}</td>
        </tr>`,
    )
    .join("");

  return `
    <article class="sheet">
      <header>
        <div>
          <h1>ESTIMATE</h1>
          <p class="doc">${escapeHtml(est.document_number)}</p>
        </div>
        <div class="right">
          <p>Date: ${est.created_at ? new Date(est.created_at).toLocaleDateString() : "—"}</p>
          <p>Job: ${escapeHtml(job.job_number ?? "")}</p>
          ${clientName ? `<p>Client: ${escapeHtml(clientName)}</p>` : ""}
        </div>
      </header>
      <h2>${escapeHtml(job.style_number ?? "")} — ${escapeHtml(job.name ?? "")}</h2>
      <table>
        <thead>
          <tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="3">Subtotal</td><td class="num">${currency(totals.total_price)}</td></tr>
          ${
            sheet.estimated_qty
              ? `<tr><td colspan="3">Estimated buy (qty ${sheet.estimated_qty})</td><td class="num">${currency(totals.estimated_buy_total)}</td></tr>`
              : ""
          }
          <tr class="total"><td colspan="3">TOTAL</td><td class="num">${currency(totals.final_cost_to_quote_client)}</td></tr>
        </tfoot>
      </table>
      ${sheet.notes ? `<p class="notes">${escapeHtml(sheet.notes)}</p>` : ""}
      <footer>
        <p>Thank you. Connect Dots</p>
      </footer>
    </article>`;
}

const PRINT_STYLES = `
  @page { size: letter; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; color: #0f172a; margin: 0; padding: 0; }
  .toolbar { display: none; }
  @media screen {
    body { background: #e8eaed; }
    .toolbar {
      display: flex; gap: 12px; align-items: center; justify-content: space-between;
      padding: 10px 18px; background: white; border-bottom: 1px solid #ccc;
      position: sticky; top: 0; z-index: 1;
    }
    .toolbar .label { font: 600 12px system-ui; color: #475569; letter-spacing: 0.04em; text-transform: uppercase; }
    .toolbar .actions { display: flex; gap: 8px; }
    .toolbar button {
      font: 600 13px system-ui; padding: 8px 16px; border-radius: 8px;
      border: none; cursor: pointer;
    }
    .toolbar button.primary { background: #7c3aed; color: white; }
    .toolbar button.secondary { background: #f1f5f9; color: #0f172a; }
    .sheet-wrap { display: flex; justify-content: center; padding: 20px; }
  }
  .sheet { width: 100%; max-width: 8.25in; background: white; padding: 0.4in; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
  header h1 { margin: 0; font-size: 28px; letter-spacing: 0.05em; }
  header .doc { margin: 4px 0 0; font-family: ui-monospace, monospace; font-weight: 700; }
  header .right { text-align: right; font-size: 12px; color: #475569; }
  header .right p { margin: 2px 0; }
  h2 { font-size: 16px; margin: 0 0 12px; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; color: #475569; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 700; }
  tfoot tr.total td { font-size: 16px; border-top: 2px solid #0f172a; }
  .notes { margin-top: 12px; font-size: 12px; color: #475569; white-space: pre-wrap; }
  footer { margin-top: 28px; font-size: 12px; color: #64748b; }
  @media print {
    body { background: white; }
    .sheet-wrap { padding: 0; }
    .sheet { max-width: none; padding: 0; }
  }
`;

export function openEstimatePrintWindow(
  job: ProjectJob,
  est: Estimate,
  options?: { autoPrint?: boolean; documentTitle?: string; clientName?: string },
): Window | null {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return null;
  const title = options?.documentTitle ?? `Estimate ${est.document_number}`;
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style></head><body>
<div class="toolbar">
  <span class="label">Print preview · ${escapeHtml(est.document_number)}</span>
  <div class="actions">
    <button type="button" class="secondary" onclick="window.close()">Close</button>
    <button type="button" class="primary" onclick="window.print()">Print</button>
  </div>
</div>
<div class="sheet-wrap">${buildEstimateHtml(job, est, options?.clientName)}</div>
${options?.autoPrint ? "<script>setTimeout(function(){window.print();},400);</script>" : ""}
</body></html>`);
  w.document.close();
  return w;
}

export function printEstimate(
  job: ProjectJob,
  est: Estimate,
  options?: { documentTitle?: string; clientName?: string },
): void {
  openEstimatePrintWindow(job, est, { ...options, autoPrint: true });
}
