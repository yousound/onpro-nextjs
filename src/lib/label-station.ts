import type { LabelStationSheet, ProjectJob } from "@/lib/types/wip";

/** Size columns on the Connect Dots mobile station label (matches legacy PDF field names). */
export const MOBILE_STATION_SIZES = [
  { key: "XS", label: "X-Small", display: "XS", pdfField: "XSMALL" },
  { key: "S", label: "Small", display: "S", pdfField: "SMALL" },
  { key: "M", label: "Medium", display: "M", pdfField: "MEDIUM" },
  { key: "L", label: "Large", display: "L", pdfField: "LARGE" },
  { key: "XL", label: "X-Large", display: "XL", pdfField: "XLARGE" },
  { key: "2XL", label: "XX-Large", display: "XXL", pdfField: "XXLARGE" },
  { key: "3XL", label: "3X-Large", display: "3XL", pdfField: "3XLARGE" },
  { key: "OS", label: "One size", display: "OS", pdfField: "ONE SIZE" },
] as const;

export type MobileStationSizeKey = (typeof MOBILE_STATION_SIZES)[number]["key"];

export function emptySizeQty(): Record<string, string> {
  return Object.fromEntries(MOBILE_STATION_SIZES.map((s) => [s.key, ""]));
}

export function defaultLabelStationFromJob(
  job: Pick<
    ProjectJob,
    | "name"
    | "style_number"
    | "colorway"
    | "po_number"
    | "garment_brand"
    | "garment_style_number"
    | "garment_color"
    | "addon_shirt_sizes"
    | "addon_pant_sizes"
    | "label_lines"
  >,
  brandFallback = "Connect Dots",
): LabelStationSheet {
  const size_qty = emptySizeQty();
  const run = [
    ...(job.addon_shirt_sizes ?? []),
    ...(job.addon_pant_sizes ?? []),
  ];
  for (const size of run) {
    const key = sizeKeyFromLabelSize(size);
    if (key) size_qty[key] = size_qty[key] || "";
  }
  for (const line of job.label_lines ?? []) {
    const key = sizeKeyFromLabelSize(line.size);
    if (key && !size_qty[key]) size_qty[key] = "1";
  }

  return {
    brand: job.garment_brand?.trim() || brandFallback,
    style: job.style_number?.trim() || job.garment_style_number?.trim() || "",
    color: job.colorway?.trim() || job.garment_color?.trim() || "",
    po_number: job.po_number?.trim() ?? "",
    box_number: "1",
    weight: "",
    size_qty,
    total_units: "",
    box_total: "",
  };
}

/** Map sticker / addon size strings onto mobile station grid keys. */
export function sizeKeyFromLabelSize(size: string): MobileStationSizeKey | null {
  const n = size.trim().toUpperCase().replace(/\s+/g, "");
  if (!n) return null;
  if (n === "XS" || n === "XSMALL" || n === "X-SMALL") return "XS";
  if (n === "S" || n === "SMALL") return "S";
  if (n === "M" || n === "MEDIUM") return "M";
  if (n === "L" || n === "LARGE") return "L";
  if (n === "XL" || n === "XLARGE" || n === "X-LARGE") return "XL";
  if (n === "2XL" || n === "XXL" || n === "XXLARGE" || n === "XX-LARGE") return "2XL";
  if (n === "3XL" || n === "3XLARGE" || n === "3X-LARGE") return "3XL";
  if (n === "OS" || n === "ONESIZE" || n === "ONE SIZE") return "OS";
  return null;
}

export function parseStationQty(value: string): number {
  const n = parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function totalUnitsFromStation(sheet: LabelStationSheet): number {
  return MOBILE_STATION_SIZES.reduce(
    (sum, { key }) => sum + parseStationQty(sheet.size_qty[key] ?? ""),
    0,
  );
}

/** Printed / displayed total — manual entry wins over size sum. */
export function displayTotalUnits(sheet: LabelStationSheet): string {
  const manual = sheet.total_units?.trim();
  if (manual) return manual;
  const sum = totalUnitsFromStation(sheet);
  return sum > 0 ? String(sum) : "";
}

export function sizesWithQtyFromStation(
  sheet: LabelStationSheet,
): { size: string; qty: number }[] {
  return MOBILE_STATION_SIZES.map(({ key }) => ({
    size: key,
    qty: parseStationQty(sheet.size_qty[key] ?? ""),
  })).filter((r) => r.qty > 0);
}

export function normalizeLabelStation(
  partial: LabelStationSheet | undefined,
  job: ProjectJob,
): LabelStationSheet {
  const base = defaultLabelStationFromJob(job);
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    size_qty: { ...base.size_qty, ...partial.size_qty },
  };
}
