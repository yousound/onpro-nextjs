import type { ProjectJob } from "@/lib/types/wip";

/** Ids from `buildDemoJobs` — excluded from real job lists and local storage. */
export const DEMO_SEED_JOB_IDS = new Set([
  "job-1-ggt148",
  "job-1-ggsw85",
  "job-1-ggsh12",
  "job-2-lnqsw05",
  "job-2-lnqb01",
  "job-3-vost08",
  "job-3-vost01",
  "job-4-hcsw01",
  "job-4-hcwt01",
  "job-5-esgh07",
  "job-5-esgh06",
  "job-6-qorsw09",
  "job-6-qort05",
]);

export function isDemoSeedJob(job: Pick<ProjectJob, "id">): boolean {
  return DEMO_SEED_JOB_IDS.has(job.id);
}

export function withoutDemoSeedJobs(jobs: ProjectJob[]): ProjectJob[] {
  return jobs.filter((j) => !isDemoSeedJob(j));
}
