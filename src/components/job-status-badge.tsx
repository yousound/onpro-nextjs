import { jobStatusBadgeClass, jobStatusDisplay, type JobStatusDisplay } from "@/lib/job-status";
import type { ProjectJob } from "@/lib/types/wip";

export function JobStatusBadge({
  job,
  orderDueYmd,
  className = "",
}: {
  job: ProjectJob;
  orderDueYmd?: string | null;
  className?: string;
}) {
  const display = jobStatusDisplay(job, orderDueYmd);
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${jobStatusBadgeClass(display)} ${className}`}
    >
      {display}
    </span>
  );
}

export function JobStatusBadgeFromDisplay({
  display,
  className = "",
}: {
  display: JobStatusDisplay;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${jobStatusBadgeClass(display)} ${className}`}
    >
      {display}
    </span>
  );
}
