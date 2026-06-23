import type {
  CostingLine,
  CostingMadeIn,
  CostingSheet,
  CostingType,
  Estimate,
  ProjectJob,
  VendorQuote,
} from "@/lib/types/wip";
import { colorwayRowTotal } from "@/lib/job-colorways";

/** Build a fresh empty costing sheet. */
export function emptyCostingSheet(
  costing_type: CostingType = "print_production",
  made_in: CostingMadeIn = "USA",
): CostingSheet {
  return {
    costing_type,
    made_in,
    lines: [],
    aggregate_margin_mode: null,
    aggregate_margin_value: 0,
    estimated_qty: 0,
    notes: "",
  };
}

export function newCostingLine(partial: Partial<CostingLine> = {}): CostingLine {
  const cost = partial.cost ?? 0;
  const margin_mode = partial.margin_mode ?? "percent";
  const margin_value = partial.margin_value ?? 0;
  const price = partial.price ?? priceFromCostAndMargin(cost, margin_mode, margin_value);
  return {
    id:
      partial.id ??
      `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    description: partial.description ?? "",
    vendor: partial.vendor ?? null,
    vendor_quote_id: partial.vendor_quote_id,
    cost,
    margin_mode,
    margin_value,
    price,
    qty: partial.qty ?? 1,
    note: partial.note,
  };
}

/** Compute the per-unit price from cost + a margin override. */
export function priceFromCostAndMargin(
  cost: number,
  mode: "percent" | "amount",
  value: number,
): number {
  if (mode === "amount") return cost + value;
  // percent margin = (price - cost) / price → price = cost / (1 - margin%)
  const m = Math.min(0.99, Math.max(-9.99, value / 100));
  if (m >= 0.99) return cost; // safety
  if (m <= -9.99) return cost;
  return cost / (1 - m);
}

/** Compute the per-line margin % implied by current cost & price. */
export function impliedMarginPercent(cost: number, price: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

export type CostingTotals = {
  total_cost: number; // Σ line.cost * line.qty
  total_price: number; // Σ line.price * line.qty
  aggregate_margin_percent: number;
  cd_profit_unit: number;
  cd_profit_total: number;
  estimated_buy_total: number;
  final_cost_to_quote_client: number;
};

export function costingTotals(sheet: CostingSheet): CostingTotals {
  const total_cost = sheet.lines.reduce((s, l) => s + l.cost * l.qty, 0);
  const total_price = sheet.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const aggregate_margin_percent = impliedMarginPercent(total_cost, total_price);
  const cd_profit_unit = total_price - total_cost;
  const estimated_buy_total = sheet.estimated_qty * total_price;
  const cd_profit_total = sheet.estimated_qty * cd_profit_unit;
  return {
    total_cost,
    total_price,
    aggregate_margin_percent,
    cd_profit_unit,
    cd_profit_total,
    estimated_buy_total,
    final_cost_to_quote_client: total_price,
  };
}

/**
 * Apply aggregate margin to ALL lines proportionally.
 * Each line's new price = cost + (cost * aggregate %). Mode "amount" splits the lump sum
 * by current cost weight; falls back to zero-distribution if total cost = 0.
 */
export function applyAggregateMargin(
  sheet: CostingSheet,
  mode: "percent" | "amount",
  value: number,
): CostingSheet {
  if (mode === "percent") {
    const lines = sheet.lines.map((l) => ({
      ...l,
      margin_mode: "percent" as const,
      margin_value: value,
      price: priceFromCostAndMargin(l.cost, "percent", value),
    }));
    return { ...sheet, lines, aggregate_margin_mode: "percent", aggregate_margin_value: value };
  }
  const totalCost = sheet.lines.reduce((s, l) => s + l.cost * l.qty, 0);
  const lines = sheet.lines.map((l) => {
    const weight = totalCost > 0 ? (l.cost * l.qty) / totalCost : 0;
    const share = weight * value;
    const perUnit = l.qty > 0 ? share / l.qty : 0;
    return {
      ...l,
      margin_mode: "amount" as const,
      margin_value: perUnit,
      price: l.cost + perUnit,
    };
  });
  return { ...sheet, lines, aggregate_margin_mode: "amount", aggregate_margin_value: value };
}

/** Build a costing line seeded from a vendor quote. */
export function costingLineFromVendorQuote(quote: VendorQuote): CostingLine {
  return newCostingLine({
    description: quote.item_description,
    vendor: quote.vendor,
    vendor_quote_id: quote.id,
    cost: quote.unit_cost,
    qty: quote.qty || 1,
  });
}

/** Build a new vendor quote. */
export function newVendorQuote(partial: Partial<VendorQuote> = {}): VendorQuote {
  return {
    id:
      partial.id ??
      `vq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vendor: partial.vendor ?? "",
    item_description: partial.item_description ?? "",
    unit_cost: partial.unit_cost ?? 0,
    qty: partial.qty ?? 1,
    notes: partial.notes,
    received_at: partial.received_at ?? new Date().toISOString(),
    source: partial.source ?? { kind: "manual" },
    po_number: partial.po_number ?? null,
    status: partial.status ?? "draft",
    sent_at: partial.sent_at,
    job_seq: partial.job_seq,
    line_item_ids: partial.line_item_ids,
  };
}

/** Snapshot the current sheet into a new Estimate. */
export function generateEstimateFromSheet(
  job: ProjectJob,
  sheet: CostingSheet,
  existingEstimates: Estimate[] = [],
  documentNumberBase?: string,
): Estimate {
  const seq = String(existingEstimates.length + 1).padStart(2, "0");
  const docBase =
    documentNumberBase?.trim() ||
    job.job_number?.trim() ||
    job.style_number?.trim() ||
    job.id;
  return {
    id: `est-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    job_id: job.id,
    document_number: `EST-${docBase}-${seq}`,
    costing_sheet_snapshot: JSON.parse(JSON.stringify(sheet)) as CostingSheet,
    created_at: new Date().toISOString(),
    status: "draft",
  };
}

function workingCostingSheet(job: ProjectJob): CostingSheet {
  const sheet = job.costing_sheet ?? emptyCostingSheet();
  if (sheet.lines.length > 0) return sheet;
  if ((job.vendor_quotes?.length ?? 0) === 0) return sheet;
  return {
    ...sheet,
    lines: (job.vendor_quotes ?? []).map((q) => costingLineFromVendorQuote(q)),
  };
}

function jobLabelForMerge(job: ProjectJob): string {
  return job.style_number?.trim() || job.name?.trim() || job.job_number?.trim() || job.id;
}

function parseJobUnitPrice(job: ProjectJob): number {
  return parseFloat(String(job.price ?? "").replace(/[^0-9.\-]/g, "")) || 0;
}

function jobLineQuantity(job: ProjectJob): number {
  const rows = job.colorway_rows ?? [];
  if (rows.length > 0) {
    const total = rows.reduce((sum, row) => sum + colorwayRowTotal(row), 0);
    if (total > 0) return total;
  }
  return 1;
}

/** One costing line from job metadata when no sheet / vendor quotes exist yet. */
export function syntheticCostingLineFromJob(job: ProjectJob, multiJob: boolean): CostingLine {
  const desc = [job.style_number?.trim(), job.name?.trim()].filter(Boolean).join(" — ")
    || job.name?.trim()
    || "Line item";
  return newCostingLine({
    description: multiJob ? `${jobLabelForMerge(job)}: ${desc}`.trim() : desc,
    qty: jobLineQuantity(job),
    price: parseJobUnitPrice(job),
    cost: 0,
  });
}

/** Merge costing lines from multiple jobs into one client-facing sheet. */
export function mergeProjectJobCostingSheets(jobs: ProjectJob[]): CostingSheet | null {
  if (jobs.length === 0) return null;

  const multiJob = jobs.length > 1;
  const lines = jobs.flatMap((job) => {
    const sheet = workingCostingSheet(job);
    if (sheet.lines.length > 0) {
      return sheet.lines.map((line) =>
        newCostingLine({
          ...line,
          description: multiJob
            ? `${jobLabelForMerge(job)}: ${line.description}`.trim()
            : line.description,
        }),
      );
    }
    return [syntheticCostingLineFromJob(job, multiJob)];
  });

  const notes = jobs
    .map((job) => workingCostingSheet(job).notes?.trim())
    .filter(Boolean)
    .join("\n");

  const base = workingCostingSheet(jobs[0]!);
  return {
    ...(base.lines.length > 0 ? base : emptyCostingSheet()),
    lines,
    estimated_qty: jobs.reduce((sum, job) => sum + jobLineQuantity(job), 0),
    notes,
  };
}
