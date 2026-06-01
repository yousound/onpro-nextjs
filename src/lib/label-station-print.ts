import {
  MOBILE_STATION_SIZES,
  displayTotalUnits,
} from "@/lib/label-station";
import type { LabelStationSheet } from "@/lib/types/wip";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function underlineField(label: string, value: string): string {
  return `
    <div class="field-line">
      <span class="field-lbl">${escapeHtml(label)}</span>
      <span class="field-val">${escapeHtml(value) || "&nbsp;"}</span>
    </div>`;
}

function sizeColumn(display: string, qty: string): string {
  return `
    <div class="size-col">
      <div class="size-hdr">${escapeHtml(display)}</div>
      <div class="size-box">${escapeHtml(qty) || "&nbsp;"}</div>
    </div>`;
}

function stationSheetHtml(sheet: LabelStationSheet, logoUrl: string): string {
  const total = displayTotalUnits(sheet) || "—";
  const boxOf = sheet.box_total.trim();
  const sizeBlocks = MOBILE_STATION_SIZES.map(({ key, display }) =>
    sizeColumn(display, sheet.size_qty[key] ?? ""),
  ).join("");

  return `
    <article class="sheet">
      <div class="top">
        <div class="logo-block" aria-hidden="true">
          <img class="cd-logo" src="${escapeHtml(logoUrl)}" alt="" />
        </div>
        <div class="top-fields">
          ${underlineField("BRAND", sheet.brand)}
          ${underlineField("STYLE", sheet.style)}
          ${underlineField("COLOR", sheet.color)}
        </div>
      </div>
      <section class="size-grid">${sizeBlocks}</section>
      <section class="footer-row">
        ${underlineField("PO#", sheet.po_number)}
        <div class="field-line total-line">
          <span class="field-lbl">TOTAL UNITS</span>
          <span class="field-val total-val">${total}</span>
        </div>
      </section>
      <section class="footer-row">
        <div class="field-line box-line">
          <span class="field-lbl">BOX</span>
          <span class="field-val box-num">${escapeHtml(sheet.box_number) || "&nbsp;"}</span>
          <span class="field-lbl box-of">OF</span>
          <span class="field-val box-num">${escapeHtml(boxOf) || "&nbsp;"}</span>
        </div>
        ${underlineField("WEIGHT", sheet.weight)}
      </section>
    </article>`;
}

const PRINT_STYLES = `
  @page { size: letter; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
    font-family: "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .toolbar { display: none; }
  @media screen {
    body { background: #e8eaed; }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #ccc;
      background: #fff;
      position: sticky;
      top: 0;
      z-index: 1;
      font-family: system-ui, sans-serif;
    }
    .toolbar button {
      font: 600 13px system-ui, sans-serif;
      padding: 8px 16px;
      border-radius: 8px;
      border: none;
      background: #7c3aed;
      color: white;
      cursor: pointer;
    }
    .toolbar p { margin: 0; font-size: 12px; color: #64748b; }
    .sheet-wrap {
      display: flex;
      justify-content: center;
      padding: 20px 16px 32px;
    }
  }
  .sheet {
    width: 100%;
    max-width: 8.25in;
    background: #fff;
    padding: 0.35in 0.4in 0.45in;
    page-break-inside: avoid;
  }
  .top {
    display: grid;
    grid-template-columns: 2in minmax(0, 1fr);
    gap: 0.28in;
    align-items: start;
    margin-bottom: 0.28in;
  }
  .logo-block {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
  }
  .cd-logo {
    width: 1.9in;
    height: auto;
    max-height: 1.55in;
    object-fit: contain;
    object-position: left top;
    display: block;
  }
  .top-fields {
    display: flex;
    flex-direction: column;
    gap: 0.14in;
    padding-top: 0.12in;
    min-width: 0;
  }
  .field-line {
    display: flex;
    align-items: flex-end;
    gap: 0.14in;
    min-height: 0.42in;
  }
  .field-lbl {
    font-size: 17pt;
    font-weight: 900;
    letter-spacing: 0.02em;
    white-space: nowrap;
    line-height: 1;
    padding-bottom: 0.06in;
  }
  .field-val {
    flex: 1;
    border-bottom: 2.5pt solid #000;
    font-size: 20pt;
    font-weight: 900;
    line-height: 1.1;
    padding: 0 0 0.05in 0.08in;
    min-height: 0.38in;
    font-variant-numeric: tabular-nums;
  }
  .size-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 0.1in;
    margin-bottom: 0.3in;
  }
  .size-col { text-align: center; }
  .size-hdr {
    font-size: 14pt;
    font-weight: 900;
    letter-spacing: 0.02em;
    margin-bottom: 0.06in;
  }
  .size-box {
    border: 2.5pt solid #000;
    min-height: 0.72in;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28pt;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    padding: 0.08in 0.04in;
  }
  .footer-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.35in;
    margin-bottom: 0.18in;
    align-items: end;
  }
  .footer-row:last-child { margin-bottom: 0; }
  .total-line .total-val {
    font-size: 26pt;
    text-align: center;
    padding-bottom: 0.04in;
  }
  .box-line .box-num {
    flex: 0 1 0.55in;
    text-align: center;
    padding-left: 0;
  }
  .box-line .box-of {
    flex: 0 0 auto;
    font-size: 15pt;
    padding-bottom: 0.06in;
  }
  @media print {
    body { background: white; }
    .sheet-wrap { padding: 0; }
    .sheet { max-width: none; padding: 0.25in 0.3in; }
  }
`;

export function openMobileStationPrintWindow(
  sheet: LabelStationSheet,
  options?: { autoPrint?: boolean; documentTitle?: string },
): Window | null {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return null;

  const title = options?.documentTitle ?? "Connect Dots label";
  const logoUrl = `${window.location.origin}/cd-label-logo.png`;
  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style></head><body>
<div class="toolbar">
  <button type="button" onclick="window.print()">Print</button>
  <p>Print → Save as PDF to download.</p>
</div>
<div class="sheet-wrap">${stationSheetHtml(sheet, logoUrl)}</div>
${options?.autoPrint ? "<script>setTimeout(function(){window.print();},400);</script>" : ""}
</body></html>`);
  w.document.close();
  return w;
}

export function printMobileStationSheet(
  sheet: LabelStationSheet,
  documentTitle?: string,
): void {
  openMobileStationPrintWindow(sheet, { autoPrint: true, documentTitle });
}

export function downloadMobileStationPdf(sheet: LabelStationSheet, documentTitle: string): void {
  printMobileStationSheet(sheet, documentTitle);
}
