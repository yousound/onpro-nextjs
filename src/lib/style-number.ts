import { STYLE_PREFIX_MAX_SEQ } from "@/lib/reference/client-codes";
import { categoryCodeForDropdown } from "@/lib/reference/category-codes";

/** Build style prefix: clientCode + categoryCode (e.g. GG + T -> GGT, GG + SW -> GGSW) */
export function stylePrefix(clientCode: string, categoryDropdownLabel: string): string {
  const cc = clientCode.trim().toUpperCase();
  const cat = categoryCodeForDropdown(categoryDropdownLabel);
  if (cat === "SH") return `${cc}SH`;
  if (cat === "SW") return `${cc}SW`;
  return `${cc}${cat}`;
}

/** Next style number for client + category, e.g. GGT149 if max is 148 */
export function generateStyleNumber(
  clientCode: string,
  categoryDropdownLabel: string,
  existingStyles: string[] = [],
): string {
  const prefix = stylePrefix(clientCode, categoryDropdownLabel);
  let maxFromRef = STYLE_PREFIX_MAX_SEQ[prefix] ?? 0;
  for (const s of existingStyles) {
    const m = s.trim().replace(/\s/g, "").match(new RegExp(`^${prefix}(\\d+)$`, "i"));
    if (m) maxFromRef = Math.max(maxFromRef, parseInt(m[1], 10));
  }
  const next = maxFromRef + 1;
  return `${prefix}${String(next).padStart(2, "0")}`;
}

/** Common colorway → 3-letter codes (matches legacy inventory VID). */
export const COLORWAY_ABBREV: Record<string, string> = {
  white: "WHT",
  "off white": "OWT",
  black: "BLK",
  navy: "NVY",
  red: "RED",
  blue: "BLU",
  green: "GRN",
  grey: "GRY",
  gray: "GRY",
  pink: "PNK",
  "baby pink": "BPK",
  olive: "OLV",
  cream: "CRM",
  natural: "NAT",
};

/** Display names for colorway picker (title case). */
export const COMMON_COLORWAY_NAMES = Object.keys(COLORWAY_ABBREV).map((k) =>
  k.replace(/\b\w/g, (c) => c.toUpperCase()),
);

export function resolveColorCode(colorway: string, explicitCode?: string): string {
  const manual = explicitCode?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  if (manual) return manual;
  return colorwayAbbrev(colorway);
}

export function colorwayAbbrev(colorway: string): string {
  const key = colorway.trim().toLowerCase();
  if (COLORWAY_ABBREV[key]) return COLORWAY_ABBREV[key];
  const words = colorway.trim().split(/\s+/);
  if (words.length >= 2) {
    const fromWords = words
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 3);
    if (fromWords.length >= 2) return fromWords;
  }
  const slug = colorway
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 3);
  return slug || "XX";
}

/** Style + color code for labels e.g. FT28127-BPK */
export function styleColorCode(
  styleNumber: string,
  colorway: string,
  colorCode?: string,
): string {
  const style = styleNumber.trim().toUpperCase();
  if (!style) return "";
  const abbrev = resolveColorCode(colorway, colorCode);
  return abbrev ? `${style}-${abbrev}` : style;
}

export function generateBarcode(
  styleNumber: string,
  colorway: string,
  colorCode?: string,
): string {
  return styleColorCode(styleNumber, colorway, colorCode);
}

/** Product description for label e.g. "fitted tee (baby pink)" */
export function labelDescription(category: string, colorway: string): string {
  const cat = category.trim().toLowerCase() || "garment";
  const color = colorway.trim().toLowerCase();
  return color ? `${cat} (${color})` : cat;
}

/** Short title on barcode label — prefer job name (legacy inventory “Title”). */
export function labelTitleFromJob(job: { name?: string; category?: string; colorway?: string }): string {
  const name = job.name?.trim();
  if (name) return name.toLowerCase();
  return labelDescription(job.category ?? "", job.colorway ?? "");
}

/** Full SKU / VID e.g. FT18123-WHT_S */
export function labelLineSku(styleColorCode: string, size: string): string {
  const base = styleColorCode.trim().toUpperCase();
  const sz = size.trim().toUpperCase().replace(/\s+/g, "");
  if (!sz) return base;
  return `${base}_${sz}`;
}
