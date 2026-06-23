"use client";

import type { ProjectJob } from "@/lib/types/wip";
import type { FinancialSeedOptions } from "@/lib/project-financials-seed";
export type FinancialDraftListItem = {
  id: string;
  label: string;
  sublabel?: string;
  uiKind: "estimate" | "invoice" | "po" | "vendor_quote";
};

function draftKindShort(kind: FinancialDraftListItem["uiKind"]): string {
  if (kind === "po") return "PO";
  if (kind === "vendor_quote") return "Quote";
  if (kind === "invoice") return "Invoice";
  return "Estimate";
}

export function FinancialDocumentWorkspaceSidebar({
  projectLabel,
  jobs,
  jobPickerMode,
  onJobPickerMode,
  selectedJobIds,
  onToggleJob,
  seedOptions,
  onSeedOptionsChange,
  onGenerateDrafts,
  drafts,
  activeDraftId,
  onSelectDraft,
  onDeleteDraft,
}: {
  projectLabel: string;
  jobs: ProjectJob[];
  jobPickerMode: "all" | "selected";
  onJobPickerMode: (mode: "all" | "selected") => void;
  selectedJobIds: Set<string>;
  onToggleJob: (jobId: string) => void;
  seedOptions: FinancialSeedOptions;
  onSeedOptionsChange: (options: FinancialSeedOptions) => void;
  onGenerateDrafts: () => void;
  drafts: FinancialDraftListItem[];
  activeDraftId: string;
  onSelectDraft: (id: string) => void;
  onDeleteDraft?: (id: string) => void;
}) {
  const visibleJobs = jobPickerMode === "all" ? jobs : jobs.filter((j) => selectedJobIds.has(j.id));

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:w-72 lg:max-w-[min(100%,280px)] lg:border-b-0 lg:border-r">
      <div className="flex-1 overflow-y-auto p-4">
        <section>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Source data</p>
          <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">
            {projectLabel}
          </p>
          <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1">
            {(["all", "selected"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onJobPickerMode(mode)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold capitalize ${
                  jobPickerMode === mode ? "bg-white text-violet-900 shadow-sm" : "text-slate-600"
                }`}
              >
                {mode === "all" ? "All jobs" : "Selected jobs"}
              </button>
            ))}
          </div>
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto">
            {jobs.map((job) => {
              const checked = jobPickerMode === "all" || selectedJobIds.has(job.id);
              return (
                <li key={job.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={jobPickerMode === "all"}
                      onChange={() => onToggleJob(job.id)}
                      className="mt-0.5 size-4 rounded border-slate-300"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-slate-800">
                        {job.job_number ? `Job ${job.job_number}` : "Job"}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {job.name?.trim() || "Untitled"}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Generate documents</p>
          <div className="mt-3 space-y-2">
            {(
              [
                ["estimate", "Client estimate"],
                ["vendor_quote", "Vendor quote requests"],
                ["po", "Vendor purchase orders"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={seedOptions[key]}
                  onChange={(e) => onSeedOptionsChange({ ...seedOptions, [key]: e.target.checked })}
                  className="size-4 rounded border-slate-300 text-accent"
                />
                {label}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={onGenerateDrafts}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
          >
            <span aria-hidden>✦</span> Generate drafts
          </button>
          <p className="mt-2 text-[11px] text-slate-500">
            {visibleJobs.length} job{visibleJobs.length === 1 ? "" : "s"} selected
          </p>
        </section>

        {drafts.length > 0 ? (
          <section className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Draft set ({drafts.length})
            </p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Documents on selected jobs. Click to open; remove extras you do not need.
            </p>
            <ul className="mt-3 space-y-1">
              {drafts.map((d) => {
                const on = d.id === activeDraftId;
                return (
                  <li key={d.id} className="group flex items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => onSelectDraft(d.id)}
                      className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-left transition ${
                        on
                          ? "border-violet-300 bg-violet-50 ring-1 ring-violet-200"
                          : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        {draftKindShort(d.uiKind)}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-sm font-semibold text-slate-900">
                        {d.label}
                      </span>
                      {d.sublabel ? (
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{d.sublabel}</span>
                      ) : null}
                    </button>
                    {onDeleteDraft ? (
                      <button
                        type="button"
                        onClick={() => onDeleteDraft(d.id)}
                        className="shrink-0 self-center rounded-lg px-2 py-1 text-xs font-semibold text-red-600 opacity-0 transition hover:bg-red-50 group-hover:opacity-100"
                        aria-label={`Delete ${d.label}`}
                        title="Delete document"
                      >
                        ×
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
