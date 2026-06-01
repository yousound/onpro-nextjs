/** Category codes from Connect Dots Style Code Key */

export type CategoryCodeEntry = {
  code: string;
  label: string;
  /** UI dropdown label (job form) */
  dropdownLabel: string;
};

export const CATEGORY_CODES: CategoryCodeEntry[] = [
  { code: "T", label: "Tees/Tops", dropdownLabel: "Tee" },
  { code: "SW", label: "Sweatshirts", dropdownLabel: "Sweatshirt" },
  { code: "P", label: "Pants", dropdownLabel: "Pants" },
  { code: "SH", label: "Shorts", dropdownLabel: "Shorts" },
  { code: "J", label: "Jackets", dropdownLabel: "Jacket" },
  { code: "KN", label: "Knits", dropdownLabel: "Knit" },
  { code: "H", label: "Headwear", dropdownLabel: "Hat" },
  { code: "SK", label: "Skirts", dropdownLabel: "Skirt" },
  { code: "D", label: "Dress", dropdownLabel: "Dress" },
  { code: "U", label: "Underwear", dropdownLabel: "Underwear" },
  { code: "B", label: "Bags", dropdownLabel: "Bag" },
  { code: "A", label: "Accessories", dropdownLabel: "Accessory" },
  { code: "HG", label: "Home Goods", dropdownLabel: "Home Goods" },
  { code: "PG", label: "Paper Goods", dropdownLabel: "Paper Goods" },
  { code: "SB", label: "Skateboard", dropdownLabel: "Skateboard" },
  { code: "ST", label: "Stickers", dropdownLabel: "Sticker" },
];

/** Maps job category dropdown value to style prefix suffix */
export function categoryCodeForDropdown(label: string): string {
  const hit = CATEGORY_CODES.find((c) => c.dropdownLabel === label);
  return hit?.code ?? "T";
}

export function dropdownLabelForCategoryCode(code: string): string {
  const hit = CATEGORY_CODES.find((c) => c.code === code);
  return hit?.dropdownLabel ?? "Custom";
}

export const JOB_TYPE_OPTIONS = [
  { value: "print_production", label: "Print Production" },
  { value: "cut_sew", label: "Cut & Sew" },
  { value: "full_package", label: "Full Package" },
  { value: "design", label: "Design" },
  { value: "branding", label: "Branding" },
  { value: "custom", label: "Custom" },
] as const;

export const ADDON_CATEGORY_OPTIONS = [
  "Short sleeve tee",
  "Long sleeve tees",
  "Shirts",
  "Crewnecks",
  "Shorts",
  "Pants",
  "Hoodies",
  "Hats",
  "Socks",
  "Custom",
] as const;

export const SHIRT_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "2X", "3X"] as const;
export const PANT_SIZE_ALPHA = ["S", "M", "L", "XL", "2X"] as const;
export const PANT_SIZE_NUMERIC = ["27", "28", "29", "30", "31", "32", "33", "34", "36", "38", "40", "42"] as const;
