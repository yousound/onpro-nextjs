import { formatUsdDetailed } from "@/lib/ledger/format";
import { computeInvoiceTotals } from "@/lib/ledger/invoice-draft";
import type { LedgerPrintableInvoice } from "@/lib/ledger/invoice-types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, "<br/>");
}

/** Each logical row on its own line — handles newlines and “; then ” payment-schedule phrasing. */
function normalizeNoteText(text: string): string {
  return text
    .replace(/;\s*then /gi, ";\nthen ")
    .replace(/\.\s+(?=Deliverable detail)/i, ".\n")
    .replace(/\.\s+(?=Current ledger:)/i, ".\n");
}

function noteLinesHtml(text: string): string {
  const lines = normalizeNoteText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => `<p class="note-line">${escapeHtml(line)}</p>`).join("");
}

function field(label: string, value: string): string {
  return `<div class="field"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

export function buildInvoiceHtml(draft: LedgerPrintableInvoice): string {
  const totals = computeInvoiceTotals(draft);

  const lineRows = draft.lines
    .filter((line) => line.description.trim() || line.rate.trim())
    .map((line, i) => {
      const amount = totals.lineAmountsCents[i] ?? 0;
      return `<tr>
        <td class="desc">${nl2br(line.description)}</td>
        <td class="num">${escapeHtml(line.quantity)}</td>
        <td class="num">${escapeHtml(line.rate)}</td>
        <td class="num">${formatUsdDetailed(amount)}</td>
      </tr>`;
    })
    .join("");

  const summaryRows = [
    ["Project value", draft.projectValue],
    ["Value accrued", draft.valueAccrued],
    ["Work finished", draft.workFinishedPercent],
    ["Paid to date", draft.paidToDate],
    ["Cap remaining", draft.capRemainingBefore],
  ]
    .map(
      ([label, value]) =>
        `<div class="summary-cell"><span class="summary-label">${escapeHtml(label)}</span><span class="summary-value">${escapeHtml(value)}</span></div>`,
    )
    .join("");

  return `
    <article class="invoice">
      <header class="top">
        <div>
          <p class="issuer">${escapeHtml(draft.issuerName)}</p>
          <h1>INVOICE</h1>
        </div>
      </header>

      <section class="meta-grid">
        <div class="bill-to">
          <h2>Bill To</h2>
          <p class="name">${escapeHtml(draft.billToName)}</p>
          ${draft.billToEmail ? `<p>${escapeHtml(draft.billToEmail)}</p>` : ""}
          ${draft.billToAddress1 ? `<p>${escapeHtml(draft.billToAddress1)}</p>` : ""}
          ${draft.billToAddress2 ? `<p>${escapeHtml(draft.billToAddress2)}</p>` : ""}
        </div>
        <div class="invoice-meta">
          ${field("Invoice No.", draft.invoiceNumber)}
          ${field("Invoice Date", draft.invoiceDate)}
          ${field("Terms", draft.terms)}
          ${field("Due Date", draft.dueDate)}
          ${field("Scheduled Date", draft.scheduledPaymentDate)}
        </div>
      </section>

      <section class="summary-box">
        <h2>OnPro Development Summary</h2>
        <div class="summary-meta">
          <p><strong>Project:</strong> ${escapeHtml(draft.projectName)}</p>
          <p><strong>Ledger reference:</strong> ${escapeHtml(draft.ledgerReference)}</p>
        </div>
        <div class="summary-grid">${summaryRows}</div>
      </section>

      <table class="lines">
        <thead>
          <tr>
            <th>Description</th>
            <th class="num">Quantity</th>
            <th class="num">Rate</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineRows || `<tr><td colspan="4" class="empty">No line items</td></tr>`}
        </tbody>
      </table>

      <div class="totals-wrap">
        <table class="totals">
          <tbody>
            <tr><td>Subtotal</td><td class="num">${formatUsdDetailed(totals.subtotalCents)}</td></tr>
            <tr class="emph"><td>Total</td><td class="num">${formatUsdDetailed(totals.totalCents)}</td></tr>
            <tr><td>Paid</td><td class="num">${formatUsdDetailed(totals.paidCents)}</td></tr>
            <tr class="emph balance"><td>Balance Due</td><td class="num">${formatUsdDetailed(totals.balanceDueCents)}</td></tr>
            <tr class="cap-after"><td>Cap after payment</td><td class="num">${formatUsdDetailed(totals.capRemainingAfterCents)}</td></tr>
          </tbody>
        </table>
      </div>

      <footer class="invoice-footer">
        <section class="notes">
          <h3>Memo / Payment Context</h3>
          ${noteLinesHtml(draft.memoNotes)}
        </section>

        ${
          draft.paymentScheduleNote.trim()
            ? `<section class="notes schedule"><h3>Payment Schedule Note</h3>${noteLinesHtml(draft.paymentScheduleNote)}</section>`
            : ""
        }
      </footer>
    </article>`;
}

const INVOICE_BASE_STYLES = `
  @page { size: letter; margin: 0.55in; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #3e3e3e;
    margin: 0;
    padding: 0;
    font-size: 9pt;
    line-height: 1.35;
  }
  .toolbar { display: none; }
  .invoice {
    width: 100%;
    max-width: 7.5in;
    min-height: 9.9in;
    display: flex;
    flex-direction: column;
    background: white;
    padding: 0.15in 0.1in;
  }
  .invoice-footer {
    margin-top: auto;
    padding-top: 20px;
    border-top: 1px solid #e8e8e8;
  }
  .top { margin-bottom: 18px; }
  .issuer { margin: 0; font-size: 14pt; font-weight: 700; letter-spacing: 0.02em; }
  h1 { margin: 2px 0 0; font-size: 22pt; font-weight: 800; letter-spacing: 0.04em; }
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 18px;
  }
  .bill-to h2, .summary-box h2, .notes h3 {
    margin: 0 0 8px;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #666;
  }
  .bill-to p { margin: 0 0 3px; }
  .bill-to .name { font-weight: 700; font-size: 10pt; }
  .invoice-meta .field {
    display: grid;
    grid-template-columns: 1.1in 1fr;
    gap: 8px;
    margin-bottom: 4px;
    align-items: baseline;
  }
  .invoice-meta .label { color: #666; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.05em; }
  .invoice-meta .value { font-weight: 600; }
  .summary-box {
    border: 1px solid #d4d4d4;
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 16px;
    background: #fafafa;
  }
  .summary-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 10px; font-size: 8.5pt; }
  .summary-meta p { margin: 0; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    border-top: 1px solid #e0e0e0;
    padding-top: 8px;
  }
  .summary-cell { min-width: 0; }
  .summary-label {
    display: block;
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #777;
    margin-bottom: 2px;
  }
  .summary-value { font-weight: 700; font-size: 9pt; }
  table.lines {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }
  table.lines th, table.lines td {
    border: 1px solid #d4d4d4;
    padding: 7px 8px;
    vertical-align: top;
  }
  table.lines th {
    background: #f3f3f3;
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #555;
  }
  td.desc { width: 55%; white-space: pre-wrap; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.empty { color: #999; font-style: italic; text-align: center; }
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 16px;
  }
  table.totals { border-collapse: collapse; min-width: 2.4in; }
  table.totals td {
    padding: 4px 0 4px 16px;
    border: none;
    font-size: 9pt;
  }
  table.totals td:first-child { padding-left: 0; color: #555; }
  table.totals tr.emph td { font-weight: 700; font-size: 10pt; }
  table.totals tr.balance td { font-size: 11pt; }
  table.totals tr.cap-after td { color: #555; font-size: 8.5pt; border-top: 1px solid #ddd; padding-top: 8px; }
  .notes .note-line { margin: 0 0 5px; font-size: 8.5pt; line-height: 1.4; }
  .notes .note-line:last-child { margin-bottom: 0; }
  .notes.schedule { margin-top: 10px; color: #666; }
  .notes.schedule h3 { font-size: 7pt; }
  .notes.schedule .note-line { font-size: 7.5pt; }
  @media print {
    body { background: white; }
    .page-wrap { padding: 0; }
    .invoice { max-width: none; min-height: 9.9in; padding: 0; }
  }
`;

const PRINT_STYLES = `${INVOICE_BASE_STYLES}
  @media screen {
    body { background: white; }
    .page-wrap { display: block; padding: 0; }
  }
`;

const PRINT_WINDOW_STYLES = `${INVOICE_BASE_STYLES}
  @media screen {
    body { background: #e8eaed; }
    .toolbar {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 16px;
      background: white;
      border-bottom: 1px solid #ccc;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .toolbar p {
      grid-column: 2;
      margin: 0;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
    .toolbar button {
      grid-column: 3;
      justify-self: end;
      flex-shrink: 0;
      font: 600 13px system-ui, sans-serif;
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      background: #7c3aed;
      color: white;
      cursor: pointer;
    }
    .page-wrap { display: flex; justify-content: center; padding: 20px; }
  }
  @media print {
    .toolbar { display: none !important; }
  }
`;

function parseUsInvoiceDate(value: string): { y: string; m: string; d: string } | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return { y: yyyy, m: mm.padStart(2, "0"), d: dd.padStart(2, "0") };
}

/** Browser “Save as PDF” uses the document title — keep it date-readable, not a blob UUID. */
export function invoiceSaveTitle(draft: LedgerPrintableInvoice): string {
  const parsed = parseUsInvoiceDate(draft.invoiceDate);
  if (parsed) {
    return `ConnectDots Invoice-RR-${parsed.y}-${parsed.m}-${parsed.d}`;
  }
  const number = draft.invoiceNumber.trim();
  if (number) return `ConnectDots Invoice-RR-${number}`;
  return "ConnectDots Invoice-RR";
}

export function buildInvoicePreviewDocument(draft: LedgerPrintableInvoice): string {
  const title = escapeHtml(invoiceSaveTitle(draft));
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>${PRINT_STYLES}</style></head><body>
<div class="page-wrap">${buildInvoiceHtml(draft)}</div>
</body></html>`;
}

function buildInvoicePrintDocument(
  draft: LedgerPrintableInvoice,
  options?: { autoPrint?: boolean },
): string {
  const title = escapeHtml(invoiceSaveTitle(draft));
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>${PRINT_WINDOW_STYLES}</style></head><body>
<div class="toolbar">
  <p>Choose your printer, or select Save as PDF to download.</p>
  <button type="button" onclick="window.print()">Print / Save PDF</button>
</div>
<div class="page-wrap">${buildInvoiceHtml(draft)}</div>
${options?.autoPrint ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>" : ""}
</body></html>`;
}

export function openInvoicePrintWindow(
  draft: LedgerPrintableInvoice,
  options?: { autoPrint?: boolean },
): Window | null {
  const html = buildInvoicePrintDocument(draft, options);
  const w = window.open("about:blank", "_blank");
  if (!w) return null;

  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
}

export function exportInvoicePdf(draft: LedgerPrintableInvoice): void {
  openInvoicePrintWindow(draft, { autoPrint: true });
}

