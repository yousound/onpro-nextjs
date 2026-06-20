import type { BusinessType } from "@/lib/types/onboarding";

const APPAREL_TYPES: BusinessType[] = ["apparel", "promotional"];

/** Apparel-style jobs show Style #, colorway grids, and size breakdowns. */
export function isApparelWorkspace(businessType: string | null | undefined): boolean {
  if (!businessType?.trim()) return true;
  return APPAREL_TYPES.includes(businessType.trim() as BusinessType);
}
