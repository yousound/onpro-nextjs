"use client";

import { useMemo, useState } from "react";
import type { JobDetailModule, JobDetailModuleKind } from "@/lib/job-detail-modules";
import {
  JOB_DETAIL_MODULE_LABELS,
  createDetailModule,
  detailModulesForJobType,
} from "@/lib/job-detail-modules";
import type { JobType } from "@/lib/types/wip";

export function JobDetailModulesSection({
  jobType,
  modules,
  onChange,
  highlightKind,
  renderModule,
}: {
  jobType?: JobType;
  modules: JobDetailModule[];
  onChange: (modules: JobDetailModule[]) => void;
  highlightKind?: JobDetailModuleKind | null;
  renderModule: (kind: JobDetailModuleKind) => React.ReactNode;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const available = useMemo(() => detailModulesForJobType(jobType), [jobType]);
  const addable = available.filter((kind) => !modules.some((m) => m.kind === kind));

  function addModule(kind: JobDetailModuleKind) {
    onChange([...modules, createDetailModule(kind)]);
    setPickerOpen(false);
  }

  function removeModule(id: string) {
    const mod = modules.find((m) => m.id === id);
    if (!mod) return;
    const label = JOB_DETAIL_MODULE_LABELS[mod.kind];
    if (!window.confirm(`Remove "${label}" from this job? Data is kept on the job until you clear it.`)) {
      return;
    }
    onChange(modules.filter((m) => m.id !== id));
  }

  return (
    <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Add production modules as line items — colorways, specs, decoration, samples.
          </p>
        </div>
        {addable.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="rounded-lg border border-dashed border-violet-300 bg-violet-50/50 px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50"
            >
              + Add task
            </button>
            {pickerOpen ? (
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {addable.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addModule(kind)}
                    className="block w-full px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                  >
                    {JOB_DETAIL_MODULE_LABELS[kind]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {modules.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">No tasks yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Use <strong>+ Add task</strong> to add color & sizing, production specs, or other modules.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {modules.map((mod) => {
            const highlighted = highlightKind === mod.kind;
            return (
              <li
                key={mod.id}
                id={`job-module-${mod.kind}`}
                className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-shadow ${
                  highlighted ? "ring-2 ring-[#7c3aed]/40 ring-offset-2" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {JOB_DETAIL_MODULE_LABELS[mod.kind]}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeModule(mod.id)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="px-4 py-4">{renderModule(mod.kind)}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
