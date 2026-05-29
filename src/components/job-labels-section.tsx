"use client";

import { useMemo, useState } from "react";
import type { JobLabelLine, LabelStationSheet, ProjectJob } from "@/lib/types/wip";
import { LabelMobileStationSheet } from "@/components/label-mobile-station-sheet";
import { LabelStickerPreview } from "@/components/label-sticker-preview";
import { PrintBarcodeLabelsModal } from "@/components/print-barcode-labels-modal";
import { downloadBuiltLabelsPdf, printBuiltLabels } from "@/lib/label-print";
import {
  normalizeLabelStation,
  sizeKeyFromLabelSize,
  sizesWithQtyFromStation,
} from "@/lib/label-station";
import { labelSizeHint, sizesForLabelLines } from "@/lib/label-sizes";
import { collectScanValuesFromJobs, generateScanValue, normalizeScanValue } from "@/lib/scan-value";
import { labelLineSku, labelTitleFromJob, styleColorCode } from "@/lib/style-number";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const labelClass = "block text-xs font-medium text-text-secondary";

function stickerQtyByLineId(
  lines: JobLabelLine[],
  station: LabelStationSheet,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) {
    const key = sizeKeyFromLabelSize(line.size);
    if (!key) continue;
    const qty = parseInt((station.size_qty[key] ?? "").replace(/[^\d]/g, ""), 10);
    if (qty > 0) out[line.id] = qty;
  }
  return out;
}

export function JobLabelsSection({
  draft,
  allJobs,
  onPatch,
}: {
  draft: ProjectJob;
  allJobs: ProjectJob[];
  onPatch: (partial: Partial<ProjectJob>) => void;
}) {
  const labelLines = draft.label_lines ?? [];
  const station = useMemo(() => normalizeLabelStation(draft.label_station, draft), [draft]);
  const [printOpen, setPrintOpen] = useState(false);

  function patchLines(lines: JobLabelLine[]) {
    onPatch({ label_lines: lines });
  }

  function patchStation(next: LabelStationSheet) {
    onPatch({ label_station: next });
  }

  function patchLine(id: string, partial: Partial<JobLabelLine>) {
    patchLines(labelLines.map((l) => (l.id === id ? { ...l, ...partial } : l)));
  }

  function existingScanValues(): string[] {
    const others = allJobs.filter((j) => j.id !== draft.id);
    return collectScanValuesFromJobs([...others, { ...draft, label_lines: labelLines }]);
  }

  function buildLinesForSizes(sizes: string[]): JobLabelLine[] {
    const desc = labelTitleFromJob(draft);
    const code = styleColorCode(draft.style_number, draft.colorway ?? "", draft.color_code);
    let pool = existingScanValues();
    const lines: JobLabelLine[] = sizes.map((size, i) => {
      const scan_value = generateScanValue(pool);
      pool = [...pool, scan_value];
      return {
        id: `line-${Date.now()}-${i}`,
        size,
        style_color_code: code,
        description: desc,
        scan_value,
      };
    });
    return lines;
  }

  function generateAllLines() {
    onPatch({ label_lines: buildLinesForSizes(sizesForLabelLines(draft)) });
  }

  function generateFromStationSheet() {
    const withQty = sizesWithQtyFromStation(station);
    const sizes =
      withQty.length > 0 ? withQty.map((r) => r.size) : sizesForLabelLines(draft);
    onPatch({ label_lines: buildLinesForSizes(sizes) });
  }

  function addLine() {
    const pool = existingScanValues();
    patchLines([
      ...labelLines,
      {
        id: `line-${Date.now()}`,
        size: "M",
        style_color_code: styleColorCode(draft.style_number, draft.colorway ?? "", draft.color_code),
        description: labelTitleFromJob(draft),
        scan_value: generateScanValue(pool),
      },
    ]);
  }

  const docTitle = `${draft.name || "Job"} labels`;
  const qtyByLineId = stickerQtyByLineId(labelLines, station);
  const hasStickerQty = Object.keys(qtyByLineId).length > 0;

  return (
    <div className="space-y-8">
      <LabelMobileStationSheet draft={draft} sheet={station} onChange={patchStation} />

      <div className="border-t border-border-light pt-6">
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">Barcode stickers by size</p>
          <p className="mt-1 text-xs text-text-secondary">
            One sticker per size with scan ID and SKU. Quantities on the sheet above control how many
            copies print per size.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateFromStationSheet}
              className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              Generate stickers from sheet
            </button>
            <button
              type="button"
              onClick={generateAllLines}
              className="rounded-lg border border-border-light bg-white px-3 py-2 text-xs font-semibold text-text-primary hover:bg-slate-50"
            >
              Generate default sizes
            </button>
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg border border-border-light bg-white px-3 py-2 text-xs font-semibold text-text-primary hover:bg-slate-50"
            >
              + Add size
            </button>
            {labelLines.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    printBuiltLabels(labelLines, hasStickerQty ? qtyByLineId : undefined, {
                      documentTitle: docTitle,
                    })
                  }
                  className="rounded-lg border border-accent/40 bg-white px-3 py-2 text-xs font-semibold text-accent hover:bg-violet-50"
                >
                  Print stickers
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadBuiltLabelsPdf(
                      labelLines,
                      docTitle,
                      hasStickerQty ? qtyByLineId : undefined,
                    )
                  }
                  className="rounded-lg border border-accent/40 bg-white px-3 py-2 text-xs font-semibold text-accent hover:bg-violet-50"
                >
                  Sticker PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOpen(true)}
                  className="rounded-lg border border-border-light bg-white px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-slate-50"
                >
                  Print options…
                </button>
              </>
            ) : null}
          </div>
          <p className="mt-2 text-[11px] text-text-secondary">
            {labelSizeHint()}
            {hasStickerQty ? " · Printing uses quantities from the mobile station sheet." : null}
          </p>
        </div>

        {labelLines.length > 0 ? (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              Sticker preview
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {labelLines.map((line) => (
                <div key={line.id} className="relative">
                  <LabelStickerPreview line={line} />
                  {qtyByLineId[line.id] ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                      ×{qtyByLineId[line.id]}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border-light bg-slate-50/80 px-4 py-8 text-center text-sm text-text-secondary">
            Fill sizes on the sheet above, then click <strong>Generate stickers from sheet</strong>.
          </p>
        )}

        {labelLines.length > 0 ? (
          <details className="mt-4 rounded-xl border border-border-light bg-surface-body/30">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-text-primary">
              Edit sticker lines ({labelLines.length})
            </summary>
            <div className="space-y-4 border-t border-border-light px-4 py-4">
              {labelLines.map((line) => {
                const sku = labelLineSku(line.style_color_code, line.size);
                const scan = normalizeScanValue(line.scan_value);
                return (
                  <div key={line.id} className="rounded-lg border border-border-light bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-text-primary">Size {line.size}</p>
                      <button
                        type="button"
                        onClick={() => patchLines(labelLines.filter((l) => l.id !== line.id))}
                        className="text-[11px] font-semibold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className={labelClass}>
                        Size
                        <input
                          className={fieldClass}
                          value={line.size}
                          onChange={(e) => patchLine(line.id, { size: e.target.value })}
                        />
                      </label>
                      <label className={labelClass}>
                        Item ID (scan)
                        <input
                          className={fieldClass}
                          value={scan}
                          onChange={(e) =>
                            patchLine(line.id, { scan_value: normalizeScanValue(e.target.value) })
                          }
                        />
                      </label>
                      <label className={`${labelClass} sm:col-span-2`}>
                        Title
                        <input
                          className={fieldClass}
                          value={line.description}
                          onChange={(e) => patchLine(line.id, { description: e.target.value })}
                        />
                      </label>
                      <label className={labelClass}>
                        Style-color
                        <input
                          className={fieldClass}
                          value={line.style_color_code}
                          onChange={(e) => patchLine(line.id, { style_color_code: e.target.value })}
                        />
                      </label>
                      <label className={labelClass}>
                        SKU
                        <input className={fieldClass} value={sku} readOnly aria-readonly />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        ) : null}
      </div>

      <PrintBarcodeLabelsModal
        open={printOpen}
        lines={labelLines}
        jobTitle={draft.name}
        qtyByLineId={hasStickerQty ? qtyByLineId : undefined}
        onClose={() => setPrintOpen(false)}
      />
    </div>
  );
}
