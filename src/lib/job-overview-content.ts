import type { ProjectJob } from "@/lib/types/wip";
import { colorwayRowTotal } from "@/lib/job-colorways";

/** True when the Overview tab has meaningful content to show. */
export function hasJobOverviewContent(job: ProjectJob): boolean {
  if (job.style_number?.trim()) return true;
  if (job.name?.trim() || job.style_name?.trim()) return true;
  if (job.description?.trim()) return true;
  if (job.garment_brand?.trim() || job.garment_style_number?.trim()) return true;
  if (job.lead_vendor?.trim()) return true;
  if (job.product_image?.url?.trim()) return true;

  const colorways = job.colorway_rows ?? [];
  if (colorways.some((r) => r.name?.trim() || colorwayRowTotal(r) > 0)) return true;

  if ((job.vendor_quotes ?? []).length > 0) return true;
  if ((job.estimates ?? []).length > 0) return true;
  if ((job.costing_sheet?.lines ?? []).length > 0) return true;
  if ((job.detail_modules ?? []).length > 0) return true;

  return false;
}
