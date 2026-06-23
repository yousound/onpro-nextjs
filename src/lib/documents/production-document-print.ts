import { formatUsdDetailed } from "@/lib/ledger/format";
import {
  computeProductionDocumentTotals,
  productionDocumentTitle,
} from "@/lib/documents/production-document-draft";
import type { ProductionDocument } from "@/lib/documents/production-document-types";

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

function noteLinesHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p class="note-line">${escapeHtml(line)}</p>`)
    .join("");
}

function field(label: string, value: string): string {
  if (!value.trim()) return "";
  return `<div class="field"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`;
}

function documentHeading(kind: ProductionDocument["kind"]): string {
  if (kind === "vendor_po") return "PURCHASE ORDER";
  if (kind === "vendor_quote") return "VENDOR QUOTE";
  return "ESTIMATE";
}

function documentNumberLabel(kind: ProductionDocument["kind"]): string {
  if (kind === "vendor_po") return "Purchase Order No.";
  if (kind === "vendor_quote") return "Quote No.";
  return "Estimate No.";
}

function billToLabel(kind: ProductionDocument["kind"]): string {
  if (kind === "vendor_po" || kind === "vendor_quote") return "For";
  return "Bill To";
}

export function resolveLogoUrl(origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/cd-label-logo.png`;
}

export function buildProductionDocumentHtml(
  draft: ProductionDocument,
  logoUrl = "/cd-label-logo.png",
): string {
  const totals = computeProductionDocumentTotals(draft);
  const heading = documentHeading(draft.kind);

  const lineRows = draft.lines
    .filter((line) => line.description.trim() || line.rate.trim())
    .map((line, i) => {
      const amount = totals.lineAmountsCents[i] ?? 0;
      const marker = line.non_taxable && amount > 0 ? "*" : "";
      return `<tr>
        <td class="desc">${nl2br(line.description)}</td>
        <td class="num">${escapeHtml(line.quantity)}</td>
        <td class="num">${escapeHtml(line.rate)}</td>
        <td class="num">${formatUsdDetailed(amount)}${marker}</td>
      </tr>`;
    })
    .join("");

  const summaryBits = [
    draft.projectNumber ? `<p><strong>Project #:</strong> ${escapeHtml(draft.projectNumber)}</p>` : "",
    draft.jobNumber ? `<p><strong>Job #:</strong> ${escapeHtml(draft.jobNumber)}</p>` : "",
    draft.referenceNotes ? `<p><strong>Reference:</strong> ${escapeHtml(draft.referenceNotes)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="doc">
      <header class="top">
        <div class="brand">
          <img class="logo" src="${escapeHtml(logoUrl)}" alt="Connect Dots" />
          <div>
            <p class="issuer">${escapeHtml(draft.issuerName)}</p>
            <h1>${heading}</h1>
          </div>
        </div>
      </header>

      <section class="meta-grid">
        <div class="bill-to">
          <h2>${billToLabel(draft.kind)}</h2>
          <p class="name">${escapeHtml(draft.billToName)}</p>
          ${draft.billToEmail ? `<p>${escapeHtml(draft.billToEmail)}</p>` : ""}
          ${draft.billToAddress1 ? `<p>${nl2br(draft.billToAddress1)}</p>` : ""}
          ${draft.billToAddress2 ? `<p>${nl2br(draft.billToAddress2)}</p>` : ""}
        </div>
        <div class="doc-meta">
          ${field(documentNumberLabel(draft.kind), draft.documentNumber)}
          ${field("Date", draft.documentDate)}
          ${field("Terms", draft.terms)}
          ${field("Due Date", draft.dueDate)}
        </div>
      </section>

      ${
        draft.kind === "vendor_po"
          ? `<section class="ship-grid">
              <div class="ship-to">
                <h2>Ship To</h2>
                <p class="name">${escapeHtml(draft.shipToName)}</p>
                ${draft.shipToAddress1 ? `<p>${nl2br(draft.shipToAddress1)}</p>` : ""}
                ${draft.shipToAddress2 ? `<p>${nl2br(draft.shipToAddress2)}</p>` : ""}
              </div>
              <div class="ship-meta">
                ${field("Tracking No.", draft.trackingNumber)}
                ${field("Ship Via", draft.shipVia)}
                ${field("FOB", draft.fob)}
              </div>
            </section>`
          : ""
      }

      ${
        summaryBits || draft.projectName
          ? `<section class="summary-box">
              <h2>${escapeHtml(draft.projectName || "Project")}</h2>
              <div class="summary-meta">${summaryBits}</div>
            </section>`
          : ""
      }

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

      <p class="tax-note">*Indicates non-taxable item</p>

      <div class="totals-wrap">
        <table class="totals">
          <tbody>
            <tr><td>Subtotal</td><td class="num">${formatUsdDetailed(totals.subtotalCents)}</td></tr>
            <tr><td>Shipping</td><td class="num">${formatUsdDetailed(totals.shippingCents)}</td></tr>
            <tr class="emph"><td>Total</td><td class="num">${formatUsdDetailed(totals.totalCents)}</td></tr>
            ${
              draft.paid.trim()
                ? `<tr><td>Paid</td><td class="num">${formatUsdDetailed(totals.paidCents)}</td></tr>
                   <tr class="emph balance"><td>Balance Due</td><td class="num">${formatUsdDetailed(totals.balanceDueCents)}</td></tr>`
                : ""
            }
          </tbody>
        </table>
      </div>

      <footer class="doc-footer">
        ${
          draft.memoNotes.trim()
            ? `<section class="notes"><h3>Notes</h3>${noteLinesHtml(draft.memoNotes)}</section>`
            : ""
        }
        ${
          draft.termsAndConditions.trim()
            ? `<section class="notes terms"><h3>Terms and Conditions</h3>${noteLinesHtml(draft.termsAndConditions)}</section>`
            : ""
        }
        <section class="issuer-footer">
          <p>${escapeHtml(draft.issuerAddress1)}</p>
          <p>${escapeHtml(draft.issuerAddress2)}</p>
          <p>${escapeHtml(draft.issuerEmail)} · ${escapeHtml(draft.issuerWebsite)}</p>
          ${draft.taxRegNumber ? `<p>Tax Reg N°: ${escapeHtml(draft.taxRegNumber)}</p>` : ""}
        </section>
      </footer>
    </article>`;
}

const DOC_BASE_STYLES = `
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
  .doc {
    width: 100%;
    max-width: 7.5in;
    min-height: 9.9in;
    display: flex;
    flex-direction: column;
    background: white;
    padding: 0.15in 0.1in;
  }
  .doc-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid #e8e8e8; }
  .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
  .logo { height: 52px; width: auto; object-fit: contain; }
  .issuer { margin: 0; font-size: 13pt; font-weight: 700; }
  h1 { margin: 2px 0 0; font-size: 20pt; font-weight: 800; letter-spacing: 0.04em; color: #1a1a1a; }
  .meta-grid, .ship-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 16px;
  }
  .bill-to h2, .ship-to h2, .summary-box h2, .notes h3 {
    margin: 0 0 8px;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #666;
  }
  .bill-to p, .ship-to p { margin: 0 0 3px; }
  .bill-to .name, .ship-to .name { font-weight: 700; font-size: 10pt; }
  .doc-meta .field, .ship-meta .field {
    display: grid;
    grid-template-columns: 1.15in 1fr;
    gap: 8px;
    margin-bottom: 4px;
    align-items: baseline;
  }
  .doc-meta .label, .ship-meta .label {
    color: #666;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .doc-meta .value, .ship-meta .value { font-weight: 600; }
  .summary-box {
    border: 1px solid #d4d4d4;
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 14px;
    background: #fafafa;
  }
  .summary-meta p { margin: 0 0 4px; font-size: 8.5pt; }
  table.lines { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
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
  .tax-note { margin: 0 0 10px; font-size: 7.5pt; color: #777; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 14px; }
  table.totals { border-collapse: collapse; min-width: 2.4in; }
  table.totals td { padding: 4px 0 4px 16px; border: none; font-size: 9pt; }
  table.totals td:first-child { padding-left: 0; color: #555; }
  table.totals tr.emph td { font-weight: 700; font-size: 10pt; }
  table.totals tr.balance td { font-size: 11pt; }
  .notes .note-line { margin: 0 0 5px; font-size: 8.5pt; line-height: 1.4; }
  .notes.terms { margin-top: 10px; color: #555; }
  .issuer-footer { margin-top: 12px; font-size: 8pt; color: #666; }
  .issuer-footer p { margin: 0 0 2px; }
  @media print {
    body { background: white; }
    .page-wrap { padding: 0; }
    .doc { max-width: none; min-height: 9.9in; padding: 0; }
  }
`;

const PRINT_STYLES = `${DOC_BASE_STYLES}
  @media screen { body { background: white; } .page-wrap { display: block; padding: 0; } }
`;

const PRINT_WINDOW_STYLES = `${DOC_BASE_STYLES}
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
    .toolbar p { grid-column: 2; margin: 0; font-size: 12px; color: #64748b; text-align: center; }
    .toolbar button {
      grid-column: 3;
      justify-self: end;
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
  @media print { .toolbar { display: none !important; } }
`;

export function buildProductionDocumentPreviewDocument(
  draft: ProductionDocument,
  logoUrl?: string,
): string {
  const title = escapeHtml(productionDocumentTitle(draft));
  const resolvedLogo = logoUrl ?? resolveLogoUrl();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>${PRINT_STYLES}</style></head><body>
<div class="page-wrap">${buildProductionDocumentHtml(draft, resolvedLogo)}</div>
</body></html>`;
}

function buildProductionDocumentPrintDocument(
  draft: ProductionDocument,
  options?: { autoPrint?: boolean; logoUrl?: string },
): string {
  const title = escapeHtml(productionDocumentTitle(draft));
  const resolvedLogo = options?.logoUrl ?? resolveLogoUrl();
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>${PRINT_WINDOW_STYLES}</style></head><body>
<div class="toolbar">
  <p>Choose your printer, or select Save as PDF to download.</p>
  <button type="button" onclick="window.print()">Print / Save PDF</button>
</div>
<div class="page-wrap">${buildProductionDocumentHtml(draft, resolvedLogo)}</div>
${options?.autoPrint ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},400);});</script>" : ""}
</body></html>`;
}

export function openProductionDocumentPrintWindow(
  draft: ProductionDocument,
  options?: { autoPrint?: boolean },
): Window | null {
  const html = buildProductionDocumentPrintDocument(draft, options);
  const w = window.open("about:blank", "_blank");
  if (!w) return null;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
}

export function exportProductionDocumentPdf(draft: ProductionDocument): void {
  openProductionDocumentPrintWindow(draft, { autoPrint: true });
}
