"use client";

import type { ProjectJob } from "@/lib/types/wip";

export function JobDetailsModalHeader({
  titleId,
  subtitle,
  jobs,
  activeJobId,
  onSelectJob,
  onClose,
}: {
  titleId: string;
  subtitle: string;
  jobs: ProjectJob[];
  activeJobId: string;
  onSelectJob?: (jobId: string) => void;
  onClose: () => void;
}) {
  const showSwitcher = jobs.length > 1 && onSelectJob;

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
          Job Details
        </h2>
        <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showSwitcher ? (
          <select
            className="max-w-[12rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15 sm:max-w-[14rem]"
            value={activeJobId}
            onChange={(e) => onSelectJob(e.target.value)}
            aria-label="Switch job"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.job_number ? `Job ${j.job_number}` : j.name?.trim() || "Untitled job"}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
