"use client";

import { BarcodePreview } from "@/components/barcode-preview";
import { labelLineSku } from "@/lib/style-number";
import { normalizeScanValue } from "@/lib/scan-value";
import type { JobLabelLine } from "@/lib/types/wip";

/** On-screen preview of a single printable barcode label. */
export function LabelStickerPreview({
  line,
  className = "",
}: {
  line: JobLabelLine;
  className?: string;
}) {
  const scan = normalizeScanValue(line.scan_value);
  const sku = labelLineSku(line.style_color_code, line.size);

  return (
    <div
      className={`flex w-[2.25in] max-w-full flex-col rounded-lg border border-border-light bg-white px-2 py-2 text-center shadow-sm ${className}`}
    >
      <p className="text-[11px] lowercase leading-tight text-text-primary">{line.description || "—"}</p>
      <p className="mt-1 text-xs font-bold text-text-primary">{sku}</p>
      <p className="mt-1 flex justify-between px-0.5 font-mono text-[10px] font-semibold text-text-secondary">
        <span>{scan || "—"}</span>
        <span>{line.size}</span>
      </p>
      <div className="mt-1 flex min-h-[52px] items-center justify-center">
        {scan ? <BarcodePreview value={scan} height={44} /> : (
          <span className="text-[10px] text-text-secondary">No scan ID</span>
        )}
      </div>
    </div>
  );
}
