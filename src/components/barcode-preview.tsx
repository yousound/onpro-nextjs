"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { barcodeEncodeValue } from "@/lib/scan-value";

type BarcodePreviewProps = {
  value: string;
  className?: string;
  height?: number;
};

export function BarcodePreview({ value, className, height = 48 }: BarcodePreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || !value.trim()) return;
    const encoded = barcodeEncodeValue(value);
    if (!encoded) return;
    try {
      JsBarcode(el, encoded, {
        format: "CODE128",
        displayValue: true,
        fontSize: 12,
        height,
        margin: 4,
        width: 1.4,
      });
    } catch {
      el.innerHTML = "";
    }
  }, [value, height]);

  if (!value.trim()) {
    return <p className="text-xs text-text-secondary">No scan value</p>;
  }

  return <svg ref={svgRef} className={className} role="img" aria-label={`Barcode ${value}`} />;
}

export function downloadBarcodePng(value: string, filename?: string) {
  const canvas = document.createElement("canvas");
  const encoded = barcodeEncodeValue(value);
  if (!encoded) return;
  try {
    JsBarcode(canvas, encoded, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 60,
      margin: 8,
      width: 1.6,
    });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `barcode-${value}.png`;
    a.click();
  } catch {
    /* ignore invalid values */
  }
}
