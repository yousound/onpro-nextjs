"use client";

import { useState } from "react";
import type { FileRef } from "@/lib/types/contact";
import type { JobLabelLine, ProjectJob } from "@/lib/types/wip";
import { FileUploadList } from "@/components/contact-form-fields";
import { BarcodePreview, downloadBarcodePng } from "@/components/barcode-preview";
import { PrintBarcodeLabelsModal } from "@/components/print-barcode-labels-modal";
import { collectScanValuesFromJobs, generateScanValue, normalizeScanValue } from "@/lib/scan-value";
import { labelLineSku, labelTitleFromJob, styleColorCode } from "@/lib/style-number";
import {
  PANT_SIZE_ALPHA,
  PANT_SIZE_NUMERIC,
  SHIRT_SIZE_OPTIONS,
} from "@/lib/reference/category-codes";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const labelClass = "block text-xs font-medium text-text-secondary";

function sizesFromJob(job: Pick<ProjectJob, "addon_shirt_sizes" | "addon_pant_sizes" | "addon_pant_size_mode">): string[] {
  const shirt = job.addon_shirt_sizes ?? [];
  const pant = job.addon_pant_sizes ?? [];
  const combined = [...shirt, ...pant];
  if (combined.length) return combined;
  return ["OS"];
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
  const labelFiles = draft.label_files ?? [];
  const labelLines = draft.label_lines ?? [];
  const [printOpen, setPrintOpen] = useState(false);

  function patchLines(lines: JobLabelLine[]) {
    onPatch({ label_lines: lines });
  }

  function patchLine(id: string, partial: Partial<JobLabelLine>) {
    patchLines(labelLines.map((l) => (l.id === id ? { ...l, ...partial } : l)));
  }

  function existingScanValues(): string[] {
    const others = allJobs.filter((j) => j.id !== draft.id);
    return collectScanValuesFromJobs([...others, { ...draft, label_lines: labelLines }]);
  }

  function generateAllLines() {
    const sizes = sizesFromJob(draft);
    const desc = labelTitleFromJob(draft);
    const code = styleColorCode(draft.style_number, draft.colorway ?? "");
    let pool = existingScanValues();
    const lines: JobLabelLine[] = sizes.map((size, i) => ({
      id: `line-${Date.now()}-${i}`,
      size,
      style_color_code: code,
      description: desc,
      scan_value: generateScanValue(pool),
    }));
    for (const l of lines) pool = [...pool, l.scan_value];
    onPatch({ label_lines: lines });
  }

  function addLine() {
    const pool = existingScanValues();
    patchLines([
      ...labelLines,
      {
        id: `line-${Date.now()}`,
        size: "M",
        style_color_code: styleColorCode(draft.style_number, draft.colorway ?? ""),
        description: labelTitleFromJob(draft),
        scan_value: generateScanValue(pool),
      },
    ]);
  }

  return (
    <div className="space-y-4 border-t border-border-light pt-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Label files</p>
        <p className="mt-1 text-xs text-text-secondary">Upload finalized label PDFs (e.g. size grid artwork).</p>
        <div className="mt-2">
          <FileUploadList
            label="Label PDFs"
            files={labelFiles}
            onChange={(files: FileRef[]) => onPatch({ label_files: files })}
          />
        </div>
        {labelFiles[0]?.url ? (
          <iframe
            title="Label preview"
            src={labelFiles[0].url}
            className="mt-3 h-48 w-full rounded-lg border border-border-light bg-white"
          />
        ) : null}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Label lines</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateAllLines}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Generate all sizes
            </button>
            <button type="button" onClick={addLine} className="text-xs font-semibold text-accent hover:underline">
              + Add line
            </button>
            {labelLines.length > 0 ? (
              <button
                type="button"
                onClick={() => setPrintOpen(true)}
                className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
              >
                Print labels…
              </button>
            ) : null}
          </div>
        </div>
        {labelLines.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">No label lines yet.</p>
        ) : (
          <div className="mt-3 space-y-4">
            {labelLines.map((line) => {
              const sku = labelLineSku(line.style_color_code, line.size);
              const scan = normalizeScanValue(line.scan_value);
              return (
                <div key={line.id} className="rounded-xl border border-border-light bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-text-primary">Size {line.size}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-secondary">SKU {sku}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => patchLines(labelLines.filter((l) => l.id !== line.id))}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-2 text-center text-sm lowercase text-text-primary">{line.description}</p>
                  <div className="mt-1 flex items-center justify-between text-sm font-semibold text-text-primary">
                    <span>{line.style_color_code}</span>
                    <span>{line.size}</span>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <BarcodePreview value={scan} />
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                      SKU (preview)
                      <input className={fieldClass} value={sku} readOnly aria-readonly />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadBarcodePng(scan, `barcode-${scan}.png`)}
                    className="mt-2 text-xs font-semibold text-accent hover:underline"
                  >
                    Download barcode PNG
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[11px] text-text-secondary">
          Shirt sizes: {SHIRT_SIZE_OPTIONS.slice(0, 5).join(", ")}… · Pant:{" "}
          {PANT_SIZE_ALPHA.slice(0, 4).join(", ")} / {PANT_SIZE_NUMERIC.slice(0, 4).join(", ")}…
        </p>
      </div>

      <PrintBarcodeLabelsModal open={printOpen} lines={labelLines} onClose={() => setPrintOpen(false)} />
    </div>
  );
}
