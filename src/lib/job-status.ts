import type { ProjectJob } from "@/lib/types/wip";

/** Stored on `ProjectJob.status` (mirrors Swift / `002_project_jobs.sql`). */
export type StoredJobStatus = ProjectJob["status"];

/** What ops sees in lists and the job modal. */
export type JobStatusDisplay = "Pending" | "In progress" | "Late" | "Completed";

export const JOB_STATUS_SELECT_OPTIONS: Array<{ value: StoredJobStatus; label: JobStatusDisplay }> = [
  { value: "Upcoming", label: "Pending" },
  { value: "In progress", label: "In progress" },
  { value: "Completed", label: "Completed" },
];

export function isJobLate(job: ProjectJob, orderDueYmd?: string | null): boolean {
  if (job.status === "Completed") return false;
  const due = (job.due_date ?? orderDueYmd ?? "").slice(0, 10);
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  const today = new Date().toISOString().slice(0, 10);
  return due < today;
}

/** Effective label for UI — Late overrides when past due and not completed. */
export function jobStatusDisplay(
  job: ProjectJob,
  orderDueYmd?: string | null,
): JobStatusDisplay {
  if (isJobLate(job, orderDueYmd)) return "Late";
  if (job.status === "Upcoming") return "Pending";
  if (job.status === "Completed") return "Completed";
  return "In progress";
}

export function jobStatusBadgeClass(display: JobStatusDisplay): string {
  switch (display) {
    case "Completed":
      return "bg-emerald-100 text-emerald-800";
    case "Late":
      return "bg-red-100 text-red-800";
    case "In progress":
      return "bg-violet-100 text-violet-800";
    case "Pending":
    default:
      return "bg-amber-100 text-amber-900";
  }
}
