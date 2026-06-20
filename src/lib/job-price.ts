import { costingTotals } from "@/lib/costing-sheet";
import type { CostingSheet, ProjectJob } from "@/lib/types/wip";

export function priceFromCostingSheet(sheet: CostingSheet | undefined | null): string | null {
  if (!sheet || sheet.lines.length === 0) return null;
  const totals = costingTotals(sheet);
  if (totals.total_price <= 0) return null;
  return totals.total_price.toFixed(2);
}

export function effectiveJobPrice(job: Pick<ProjectJob, "price" | "price_manual_override" | "costing_sheet">): string {
  if (job.price_manual_override && job.price?.trim()) return job.price.trim();
  const fromCosting = priceFromCostingSheet(job.costing_sheet);
  if (fromCosting) return fromCosting;
  return job.price?.trim() ?? "";
}

export function syncJobPriceFromCosting(
  job: Pick<ProjectJob, "price" | "price_manual_override" | "costing_sheet">,
): Pick<ProjectJob, "price"> {
  if (job.price_manual_override) return { price: job.price ?? "" };
  const fromCosting = priceFromCostingSheet(job.costing_sheet);
  if (fromCosting) return { price: fromCosting };
  return { price: job.price ?? "" };
}
