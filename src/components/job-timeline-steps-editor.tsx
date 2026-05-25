"use client";

import { useState, type FormEvent } from "react";
import type { WipStep, WipStepState, JobDetailsSection } from "@/lib/types/wip";
import { WIP_STEP_STATES } from "@/lib/project-wip-edits";
import { createCustomWipStep, isDefaultWipStepId, moveWipStep } from "@/lib/wip-project-timeline";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function stepStateLabel(state: WipStepState): string {
  if (state === "completed") return "Done";
  if (state === "in_progress") return "In progress";
  if (state === "na") return "N/A";
  return "Upcoming";
}

function stepStateSelectClass(state: WipStepState): string {
  switch (state) {
    case "completed":
      return "border-emerald-300 bg-emerald-50/90 text-emerald-950";
    case "in_progress":
      return "border-violet-300 bg-violet-50/90 text-violet-950";
    case "na":
      return "border-slate-300 bg-slate-100 text-slate-800";
    default:
      return "border-border-light bg-white text-text-primary";
  }
}

function rowClass(state: WipStepState): string {
  switch (state) {
    case "completed":
      return "border-emerald-300/80 bg-emerald-50/95";
    case "in_progress":
      return "border-violet-300/80 bg-violet-50/95";
    case "na":
      return "border-slate-300 bg-slate-100/90";
    default:
      return "border-border-light bg-surface-body/40";
  }
}

function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {direction === "up" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  );
}

function GripIcon() {
  return (
    <svg className="h-4 w-4 text-text-secondary/70" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="7" r="1.25" />
      <circle cx="15" cy="7" r="1.25" />
      <circle cx="9" cy="12" r="1.25" />
      <circle cx="15" cy="12" r="1.25" />
      <circle cx="9" cy="17" r="1.25" />
      <circle cx="15" cy="17" r="1.25" />
    </svg>
  );
}

const OPENS_IN_OPTIONS: { value: JobDetailsSection | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "estimate", label: "Estimate" },
  { value: "costing", label: "Costing" },
  { value: "approvals", label: "Approvals" },
  { value: "bulk", label: "Bulk production" },
];

export function JobTimelineStepsEditor({
  steps,
  onChange,
  jobLabel,
}: {
  steps: WipStep[];
  onChange: (steps: WipStep[]) => void;
  /** Job identity — e.g. style # and colorway. */
  jobLabel: string;
}) {
  const [newLabel, setNewLabel] = useState("");

  function patchStep(stepId: string, patch: Partial<WipStep>) {
    onChange(steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  }

  function removeStep(stepId: string) {
    onChange(steps.filter((s) => s.id !== stepId));
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    onChange([...steps, createCustomWipStep(label)]);
    setNewLabel("");
  }

  return (
    <div className="rounded-2xl border border-border-light bg-surface-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Timeline steps</h3>
          <p className="mt-1 text-sm font-semibold text-text-primary">{jobLabel}</p>
          <p className="mt-0.5 text-xs text-text-secondary">↑↓ to reorder · Add custom steps below</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-text-secondary">
          {steps.length} step{steps.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${rowClass(step.state)}`}
          >
            <span className="flex w-6 shrink-0 items-center justify-center" title="Step order">
              <GripIcon />
            </span>
            <span className="w-6 shrink-0 text-center text-[11px] font-bold tabular-nums text-text-secondary">
              {index + 1}
            </span>
            <input
              type="text"
              className={`min-w-[8rem] flex-1 rounded-lg border border-border-light bg-white px-2.5 py-1.5 text-sm font-medium text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent`}
              value={step.label}
              aria-label={`Step ${index + 1} name`}
              onChange={(e) => patchStep(step.id, { label: e.target.value })}
            />
            {!isDefaultWipStepId(step.id) ? (
              <>
                <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                  Custom
                </span>
                <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-text-secondary">
                  Opens in
                  <select
                    value={step.opensIn ?? "none"}
                    aria-label={`${step.label} opens in section`}
                    onChange={(e) => {
                      const value = e.target.value as JobDetailsSection | "none";
                      patchStep(step.id, {
                        opensIn: value === "none" ? undefined : value,
                      });
                    }}
                    className="rounded-lg border border-border-light bg-white px-2 py-1 text-xs font-medium text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {OPENS_IN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <select
              value={step.state}
              aria-label={`Step ${index + 1} status`}
              onChange={(e) => patchStep(step.id, { state: e.target.value as WipStepState })}
              className={`rounded-lg border px-2 py-1 text-xs font-semibold focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 ${stepStateSelectClass(step.state)}`}
            >
              {WIP_STEP_STATES.map((s) => (
                <option key={s} value={s}>
                  {stepStateLabel(s)}
                </option>
              ))}
            </select>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Move ${step.label} up`}
                title="Move up"
                onClick={() => onChange(moveWipStep(steps, step.id, "up"))}
                className="rounded-lg p-1.5 text-text-secondary transition hover:bg-white hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronIcon direction="up" />
              </button>
              <button
                type="button"
                disabled={index === steps.length - 1}
                aria-label={`Move ${step.label} down`}
                title="Move down"
                onClick={() => onChange(moveWipStep(steps, step.id, "down"))}
                className="rounded-lg p-1.5 text-text-secondary transition hover:bg-white hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronIcon direction="down" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${step.label}`}
                title="Remove step"
                onClick={() => removeStep(step.id)}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      {steps.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">No steps yet — add one below.</p>
      ) : null}

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border-light pt-4">
        <label className="min-w-[12rem] flex-1 text-xs font-medium text-text-secondary">
          New step
          <input
            className={fieldClass}
            placeholder="e.g. Client sign-off"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={!newLabel.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add step
        </button>
      </form>
    </div>
  );
}
