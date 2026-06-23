import { emptyCostingSheet, generateEstimateFromSheet } from "@/lib/costing-sheet";
import type { ProjectJob, VendorQuote } from "@/lib/types/wip";

export type FinancialSeedKind = "estimate" | "vendor_quote" | "po";

export type FinancialSeedOptions = {
  estimate: boolean;
  vendor_quote: boolean;
  po: boolean;
};

export const DEFAULT_FINANCIAL_SEED_OPTIONS: FinancialSeedOptions = {
  estimate: true,
  vendor_quote: true,
  po: true,
};

export type FinancialSeedResult = {
  jobId: string;
  jobNumber: string;
  created: FinancialSeedKind[];
  skipped: FinancialSeedKind[];
};

function hasEstimate(job: ProjectJob): boolean {
  return Boolean(job.estimates?.length);
}

function hasVendorQuote(job: ProjectJob): boolean {
  return Boolean(job.vendor_quotes?.some((q) => !q.po_number?.trim()));
}

function hasPo(job: ProjectJob): boolean {
  return Boolean(job.vendor_quotes?.some((q) => q.po_number?.trim()));
}

function newVendorQuote(job: ProjectJob, withPo: boolean): VendorQuote {
  const base = job.job_number?.trim() || job.id;
  return {
    id: `vq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    vendor: job.lead_vendor ?? job.job_vendors?.[0] ?? "",
    item_description: job.name?.trim() || job.style_name?.trim() || "Line item",
    qty: 1,
    unit_cost: 0,
    received_at: null,
    status: "draft",
    po_number: withPo ? `PO-${base}` : null,
  };
}

/** Add missing financial document records on a single job (does not overwrite existing). */
export function seedFinancialDocumentsForJob(
  job: ProjectJob,
  options: FinancialSeedOptions,
): { job: ProjectJob; result: FinancialSeedResult } {
  const created: FinancialSeedKind[] = [];
  const skipped: FinancialSeedKind[] = [];
  const estimates = [...(job.estimates ?? [])];
  const vendor_quotes = [...(job.vendor_quotes ?? [])];

  if (options.estimate) {
    if (hasEstimate(job)) skipped.push("estimate");
    else {
      const sheet = job.costing_sheet ?? emptyCostingSheet();
      estimates.push(generateEstimateFromSheet(job, sheet, estimates));
      created.push("estimate");
    }
  }

  if (options.vendor_quote) {
    if (hasVendorQuote(job)) skipped.push("vendor_quote");
    else {
      vendor_quotes.push(newVendorQuote(job, false));
      created.push("vendor_quote");
    }
  }

  if (options.po) {
    if (hasPo(job)) skipped.push("po");
    else {
      vendor_quotes.push(newVendorQuote(job, true));
      created.push("po");
    }
  }

  return {
    job: { ...job, estimates, vendor_quotes },
    result: {
      jobId: job.id,
      jobNumber: job.job_number?.trim() || job.id,
      created,
      skipped,
    },
  };
}

/** Seed financial documents for many jobs on a project. */
export function seedFinancialDocumentsForJobs(
  jobs: ProjectJob[],
  targetJobIds: string[] | "all",
  options: FinancialSeedOptions,
): { jobs: ProjectJob[]; results: FinancialSeedResult[] } {
  const idSet =
    targetJobIds === "all" ? null : new Set(targetJobIds.filter(Boolean));
  const results: FinancialSeedResult[] = [];
  const nextJobs = jobs.map((job) => {
    if (idSet && !idSet.has(job.id)) return job;
    const { job: seeded, result } = seedFinancialDocumentsForJob(job, options);
    if (result.created.length > 0 || result.skipped.length > 0) results.push(result);
    return seeded;
  });
  return { jobs: nextJobs, results };
}

export function countPendingFinancialSeeds(
  jobs: ProjectJob[],
  options: FinancialSeedOptions,
): number {
  let n = 0;
  for (const job of jobs) {
    if (options.estimate && !hasEstimate(job)) n += 1;
    if (options.vendor_quote && !hasVendorQuote(job)) n += 1;
    if (options.po && !hasPo(job)) n += 1;
  }
  return n;
}
