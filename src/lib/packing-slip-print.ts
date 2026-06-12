import type { PackingSlipDocument, PackingSlipVariant } from "@/lib/types/packing-slip";
import { packingSlipCompanyName, totalPieces } from "@/lib/packing-slip";
import { LABEL_LOGO_SRC } from "@/lib/label-logo";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function variantHeaders(variant: PackingSlipVariant): string[] {
  const base = ["BOX"];
  if (variant === "products_go") base.push("IID#");
  if (variant === "shipper") base.push("WEIGHT", "DIMS");
  base.push("STYLE", "COLOR", "DESCRIPTION", "SIZE", "QTY");
  return base;
}

function variantRow(line: PackingSlipDocument["lines"][number], variant: PackingSlipVariant): string {
  const cells: string[] = [String(line.box_number ?? "")];
  if (variant === "products_go") cells.push(line.iid_number ?? "");
  if (variant === "shipper") {
    cells.push(line.box_weight ?? "");
    cells.push(line.box_dimensions ?? "");
  }
  cells.push(
    line.style_number,
    line.colorway,
    line.description,
    line.size,
    String(line.quantity),
  );
  return `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`;
}

export function buildPackingSlipHtml(slip: PackingSlipDocument, logoUrl: string): string {
  const variant: PackingSlipVariant = slip.variant ?? "products_go";
  const headers = variantHeaders(variant);
  const rows = slip.lines.map((l) => variantRow(l, variant)).join("");
  const company = packingSlipCompanyName(slip).toUpperCase();
  const pieces = totalPieces(slip);

  return `
    <article class="sheet">
      <header class="masthead">
        <img class="cd-logo" src="${escapeHtml(logoUrl)}" alt="" />
        <div class="title">
          <h1>PACKING LIST</h1>
          <p class="doc">${escapeHtml(slip.document_number)}</p>
        </div>
      </header>

      <section class="meta">
        <div>
          <p class="lbl">PO NUMBER</p>
          <p class="val">${escapeHtml(slip.project_po_number ?? "—")}</p>
        </div>
        <div>
          <p class="lbl">JOB TITLE</p>
          <p class="val">${escapeHtml(slip.title)}</p>
        </div>
        <div>
          <p class="lbl">CLIENT</p>
          <p class="val">${escapeHtml(slip.ship_to_name)}</p>
        </div>
        <div>
          <p class="lbl">CONTACT</p>
          <p class="val">${escapeHtml(slip.ship_to_address || "—")}</p>
        </div>
        <div>
          <p class="lbl">SHIPPING METHOD</p>
          <p class="val">${escapeHtml(slip.carrier || "—")}</p>
        </div>
        <div>
          <p class="lbl">TRACKING</p>
          <p class="val">${escapeHtml(slip.tracking_number || "—")}</p>
        </div>
      </section>

      <section class="addr">
        <div>
          <p class="lbl">FROM</p>
          <p class="val">${escapeHtml(slip.ship_from_name)}</p>
          <p class="val small">${escapeHtml(slip.ship_from_address || "")}</p>
        </div>
        <div>
          <p class="lbl">TO</p>
          <p class="val">${escapeHtml(slip.ship_to_name)}</p>
          <p class="val small">${escapeHtml(slip.ship_to_address || "")}</p>
        </div>
      </section>

      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="${headers.length - 1}" class="right">TOTAL PIECES</td>
            <td>${pieces}</td>
          </tr>
        </tfoot>
      </table>

      ${slip.notes ? `<p class="notes">${escapeHtml(slip.notes)}</p>` : ""}

      <footer>
        <div>
          <p class="lbl">RECEIVED BY</p>
          <div class="line"></div>
        </div>
        <div>
          <p class="lbl">DATE</p>
          <div class="line"></div>
        </div>
        <p class="brand">${escapeHtml(company)}</p>
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
      display: flex; gap: 12px; align-items: center;
      padding: 12px 16px; background: white; border-bottom: 1px solid #ccc;
      position: sticky; top: 0; z-index: 1;
    }
    .toolbar button {
      font: 600 13px system-ui; padding: 8px 16px; border-radius: 8px;
      border: none; background: #7c3aed; color: white; cursor: pointer;
    }
    .sheet-wrap { display: flex; justify-content: center; padding: 20px; }
  }
  .sheet { width: 100%; max-width: 8.25in; background: white; padding: 0.4in; }
  .masthead { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 12px; }
  .cd-logo { width: 1.6in; height: auto; }
  .title h1 { margin: 0; font-size: 28px; letter-spacing: 0.08em; font-weight: 900; }
  .title .doc { margin: 4px 0 0; font-family: ui-monospace, monospace; font-weight: 700; letter-spacing: 0.06em; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 18px; margin-bottom: 12px; }
  .addr { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 14px; }
  .lbl { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: #475569; margin: 0; text-transform: uppercase; }
  .val { font-size: 13px; font-weight: 600; margin: 2px 0 0; }
  .val.small { font-size: 11px; font-weight: 400; color: #334155; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #94a3b8; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #e2e8f0; text-transform: uppercase; font-size: 10px; }
  td.right, th.right { text-align: right; }
  tfoot td { font-weight: 700; }
  .notes { margin-top: 12px; font-size: 12px; color: #475569; white-space: pre-wrap; }
  footer { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  footer .line { border-bottom: 1px solid #000; margin-top: 32px; }
  footer .brand { grid-column: 1 / -1; font-size: 11px; letter-spacing: 0.06em; color: #475569; text-align: center; margin-top: 24px; }
  @media print {
    body { background: white; }
    .sheet-wrap { padding: 0; }
    .sheet { max-width: none; padding: 0; }
  }
`;

export function openPackingSlipPrintWindow(
  slip: PackingSlipDocument,
  options?: { autoPrint?: boolean; documentTitle?: string },
): Window | null {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return null;
  const title = options?.documentTitle ?? `Packing list ${slip.document_number}`;
  const logoUrl = `${window.location.origin}${LABEL_LOGO_SRC.startsWith("/") ? LABEL_LOGO_SRC : `/${LABEL_LOGO_SRC}`}`;
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style></head><body>
<div class="toolbar">
  <button type="button" onclick="window.print()">Print</button>
</div>
<div class="sheet-wrap">${buildPackingSlipHtml(slip, logoUrl)}</div>
${options?.autoPrint ? "<script>setTimeout(function(){window.print();},400);</script>" : ""}
</body></html>`);
  w.document.close();
  return w;
}

export function printPackingSlip(slip: PackingSlipDocument, documentTitle?: string): void {
  openPackingSlipPrintWindow(slip, { autoPrint: true, documentTitle });
}
