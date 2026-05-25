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

export function generateBarcode(styleNumber: string, colorway: string): string {
  const slug = colorway
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  return slug ? `${styleNumber}-${slug}` : styleNumber;
}
