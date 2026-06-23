import {
  applyMergedProjectEstimate,
  consolidateDuplicateProjectEstimates,
  projectHasClientEstimate,
  sortJobsForEstimate,
} from "@/lib/project-estimate-merge";
import type { Project } from "@/lib/types/project";
import type { ProjectJob, VendorQuote } from "@/lib/types/wip";
import { projectPoNumber } from "@/lib/po-number";

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

function estimateDocumentBase(project: Project | undefined, jobs: ProjectJob[]): string {
  const fromProject = project ? projectPoNumber(project)?.trim() : null;
  if (fromProject) return fromProject;
  const primary = sortJobsForEstimate(jobs)[0];
  const jobNum = primary?.job_number?.trim();
  if (jobNum) {
    return jobNum.replace(/-\d{2}$/, "");
  }
  return primary?.id ?? "project";
}

function seedPerJobVendorDocs(
  job: ProjectJob,
  options: FinancialSeedOptions,
): { job: ProjectJob; result: FinancialSeedResult } {
  const created: FinancialSeedKind[] = [];
  const skipped: FinancialSeedKind[] = [];
  const vendor_quotes = [...(job.vendor_quotes ?? [])];

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
    job: { ...job, vendor_quotes },
    result: {
      jobId: job.id,
      jobNumber: job.job_number?.trim() || job.id,
      created,
      skipped,
    },
  };
}

/** Seed financial documents for many jobs on a project (one merged client estimate). */
export function seedFinancialDocumentsForJobs(
  jobs: ProjectJob[],
  targetJobIds: string[] | "all",
  options: FinancialSeedOptions,
  project?: Project,
): { jobs: ProjectJob[]; results: FinancialSeedResult[] } {
  const idSet =
    targetJobIds === "all" ? null : new Set(targetJobIds.filter(Boolean));
  const targetJobs = jobs.filter((job) => !idSet || idSet.has(job.id));
  const results: FinancialSeedResult[] = [];

  const docBase = estimateDocumentBase(project, targetJobs.length > 0 ? targetJobs : jobs);
  let workingJobs = consolidateDuplicateProjectEstimates(jobs, docBase);

  if (options.estimate && targetJobs.length > 0) {
    if (projectHasClientEstimate(workingJobs)) {
      for (const job of targetJobs) {
        results.push({
          jobId: job.id,
          jobNumber: job.job_number?.trim() || job.id,
          created: [],
          skipped: ["estimate"],
        });
      }
    } else {
      const { jobs: mergedJobs, estimate, created } = applyMergedProjectEstimate(
        workingJobs,
        targetJobs,
        docBase,
      );
      workingJobs = mergedJobs;
      const host = sortJobsForEstimate(targetJobs)[0]!;
      results.push({
        jobId: host.id,
        jobNumber: host.job_number?.trim() || host.id,
        created: created ? ["estimate"] : [],
        skipped: created ? [] : ["estimate"],
      });
      if (created && estimate) {
        for (const job of targetJobs) {
          if (job.id === host.id) continue;
          results.push({
            jobId: job.id,
            jobNumber: job.job_number?.trim() || job.id,
            created: [],
            skipped: ["estimate"],
          });
        }
      }
    }
  }

  const nextJobs = workingJobs.map((job) => {
    if (idSet && !idSet.has(job.id)) return job;
    const { job: seeded, result } = seedPerJobVendorDocs(job, options);
    if (result.created.length > 0 || result.skipped.length > 0) {
      const existing = results.find((r) => r.jobId === job.id);
      if (existing) {
        existing.created.push(...result.created);
        existing.skipped.push(...result.skipped);
      } else {
        results.push(result);
      }
    }
    return seeded;
  });

  return { jobs: nextJobs, results };
}

export function countPendingFinancialSeeds(
  jobs: ProjectJob[],
  options: FinancialSeedOptions,
): number {
  let n = 0;
  if (options.estimate && !projectHasClientEstimate(jobs)) n += 1;
  for (const job of jobs) {
    if (options.vendor_quote && !hasVendorQuote(job)) n += 1;
    if (options.po && !hasPo(job)) n += 1;
  }
  return n;
}

/** @deprecated Single-job seed — prefer seedFinancialDocumentsForJobs for project estimates. */
export function seedFinancialDocumentsForJob(
  job: ProjectJob,
  options: FinancialSeedOptions,
): { job: ProjectJob; result: FinancialSeedResult } {
  const { jobs, results } = seedFinancialDocumentsForJobs([job], [job.id], options);
  return {
    job: jobs[0] ?? job,
    result: results[0] ?? {
      jobId: job.id,
      jobNumber: job.job_number?.trim() || job.id,
      created: [],
      skipped: [],
    },
  };
}
