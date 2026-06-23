import type { JobType } from "@/lib/types/wip";
import { JOB_TYPE_OPTIONS } from "@/lib/reference/category-codes";

export function jobTypeLabel(jobType: JobType | undefined): string {
  const hit = JOB_TYPE_OPTIONS.find((o) => o.value === jobType);
  return hit?.label ?? "Print Production";
}
