import {
  emptyCostingSheet,
  generateEstimateFromSheet,
  mergeProjectJobCostingSheets,
} from "@/lib/costing-sheet";
import type { Estimate, ProjectJob } from "@/lib/types/wip";

export function sortJobsForEstimate(jobs: ProjectJob[]): ProjectJob[] {
  return [...jobs].sort((a, b) => {
    const left = a.job_number?.trim() || a.style_number?.trim() || a.id;
    const right = b.job_number?.trim() || b.style_number?.trim() || b.id;
    return left.localeCompare(right, undefined, { numeric: true });
  });
}

export function projectHasClientEstimate(jobs: ProjectJob[]): boolean {
  return jobs.some((job) => (job.estimates?.length ?? 0) > 0);
}

export function primaryEstimateHost(jobs: ProjectJob[]): ProjectJob | undefined {
  const sorted = sortJobsForEstimate(jobs);
  return (
    sorted.find((job) => (job.estimates?.length ?? 0) > 0) ?? sorted[0]
  );
}

/** One client estimate on the primary job, merging lines from all target jobs. */
export function applyMergedProjectEstimate(
  allJobs: ProjectJob[],
  targetJobs: ProjectJob[],
  documentNumberBase: string,
): { jobs: ProjectJob[]; estimate: Estimate | null; created: boolean } {
  if (targetJobs.length === 0) {
    return { jobs: allJobs, estimate: null, created: false };
  }

  if (projectHasClientEstimate(allJobs)) {
    return { jobs: allJobs, estimate: null, created: false };
  }

  const sortedTargets = sortJobsForEstimate(targetJobs);
  const primary = sortedTargets[0]!;
  const mergedSheet = mergeProjectJobCostingSheets(sortedTargets) ?? emptyCostingSheet();
  const estimate = generateEstimateFromSheet(
    primary,
    mergedSheet,
    [],
    documentNumberBase,
  );

  const targetIds = new Set(sortedTargets.map((j) => j.id));
  const jobs = allJobs.map((job) => {
    if (job.id === primary.id) {
      return {
        ...job,
        costing_sheet: mergedSheet,
        estimates: [...(job.estimates ?? []), estimate],
      };
    }
    if (targetIds.has(job.id)) {
      return { ...job, estimates: [] };
    }
    return job;
  });

  return { jobs, estimate, created: true };
}

/**
 * When multiple jobs each have their own estimate, merge into one on the primary job.
 * Used to repair data created before project-level estimate merging.
 */
export function consolidateDuplicateProjectEstimates(
  jobs: ProjectJob[],
  documentNumberBase: string,
): ProjectJob[] {
  const jobsWithEstimates = jobs.filter((job) => (job.estimates?.length ?? 0) > 0);
  if (jobsWithEstimates.length <= 1) return jobs;

  const primary = primaryEstimateHost(jobs) ?? sortJobsForEstimate(jobs)[0]!;
  const mergeTargets = jobsOnSameOrder(jobs, primary);
  const mergedSheet = mergeProjectJobCostingSheets(mergeTargets) ?? emptyCostingSheet();

  const existingOnPrimary = primary.estimates?.[0];
  const estimate: Estimate = existingOnPrimary
    ? {
        ...existingOnPrimary,
        document_number: existingOnPrimary.document_number.startsWith("EST-")
          ? existingOnPrimary.document_number
          : `EST-${documentNumberBase}-01`,
        costing_sheet_snapshot: JSON.parse(JSON.stringify(mergedSheet)) as typeof mergedSheet,
        job_id: primary.id,
      }
    : generateEstimateFromSheet(primary, mergedSheet, [], documentNumberBase);

  return jobs.map((job) => {
    if (job.id === primary.id) {
      return {
        ...job,
        costing_sheet: mergedSheet,
        estimates: [estimate],
      };
    }
    return { ...job, estimates: [] };
  });
}

export function jobsOnSameOrder(allJobs: ProjectJob[], anchor: ProjectJob): ProjectJob[] {
  const orderId = anchor.order_id;
  if (!orderId) {
    return sortJobsForEstimate(allJobs);
  }

  const onOrder = allJobs.filter((job) => job.order_id === orderId);
  const orderIdsUsed = new Set(allJobs.map((job) => job.order_id).filter(Boolean));
  const orphans = allJobs.filter((job) => !job.order_id);
  if (orphans.length > 0 && orderIdsUsed.size <= 1) {
    const merged = [...onOrder, ...orphans];
    const unique = Array.from(new Map(merged.map((job) => [job.id, job])).values());
    return sortJobsForEstimate(unique.length > 0 ? unique : [anchor]);
  }

  return sortJobsForEstimate(onOrder.length > 0 ? onOrder : [anchor]);
}

/** Refresh a single project estimate so its snapshot includes every job on the order. */
export function refreshProjectEstimateSnapshot(
  jobs: ProjectJob[],
  documentNumberBase: string,
): ProjectJob[] {
  const host = primaryEstimateHost(jobs);
  const estimate = host?.estimates?.[0];
  if (!host || !estimate) return jobs;

  const orderJobs = jobsOnSameOrder(jobs, host);
  const mergedSheet = mergeProjectJobCostingSheets(orderJobs);
  if (!mergedSheet) return jobs;

  const snapshotLines = estimate.costing_sheet_snapshot?.lines?.length ?? 0;
  if (orderJobs.length <= 1 && snapshotLines >= 1) return jobs;
  if (orderJobs.length > 1 && snapshotLines >= orderJobs.length) return jobs;

  const updated: Estimate = {
    ...estimate,
    costing_sheet_snapshot: JSON.parse(JSON.stringify(mergedSheet)) as typeof mergedSheet,
    document_number: estimate.document_number || `EST-${documentNumberBase}-01`,
    job_id: host.id,
  };

  return jobs.map((job) => {
    if (job.id === host.id) {
      return { ...job, costing_sheet: mergedSheet, estimates: [updated] };
    }
    return { ...job, estimates: [] };
  });
}
