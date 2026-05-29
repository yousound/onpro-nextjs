import { SHIRT_SIZE_OPTIONS } from "@/lib/reference/category-codes";
import type { ProjectJob } from "@/lib/types/wip";

/** Default size run when building labels for a standard apparel job. */
export const DEFAULT_LABEL_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

export function sizesForLabelLines(
  job: Pick<ProjectJob, "addon_shirt_sizes" | "addon_pant_sizes">,
): string[] {
  const shirt = job.addon_shirt_sizes ?? [];
  const pant = job.addon_pant_sizes ?? [];
  const combined = [...shirt, ...pant];
  if (combined.length) return combined;
  return [...DEFAULT_LABEL_SIZES];
}

export function labelSizeHint(): string {
  return `Default run: ${DEFAULT_LABEL_SIZES.join(", ")} · Shirt: ${SHIRT_SIZE_OPTIONS.slice(0, 6).join(", ")}…`;
}
