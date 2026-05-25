"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeDurationShort } from "@/lib/format";
import { summarizeWipSteps } from "@/lib/wip-progress";
import type { WipStep, WipStepState } from "@/lib/types/wip";

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function StepIcon({ state, large }: { state: WipStepState; large?: boolean }) {
  if (state === "completed") {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-health-ok font-bold text-white ${
          large ? "h-9 w-9 text-sm" : "h-5 w-5 text-[10px]"
        }`}
      >
        ✓
      </span>
    );
  }
  if (state === "in_progress") {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full bg-accent text-white ${
          large ? "h-10 w-10 ring-4 ring-accent/20" : "h-5 w-5"
        }`}
      >
        <ClockIcon className={large ? "h-4 w-4" : "h-3 w-3"} />
      </span>
    );
  }
  if (state === "na") {
    return (
      <span
        className={`flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 ${
          large ? "h-9 w-9 text-xs" : "h-5 w-5"
        }`}
      >
        —
      </span>
    );
  }
  return (
    <span
      className={`shrink-0 rounded-full border-2 border-slate-300 bg-white ${large ? "h-9 w-9" : "h-5 w-5"}`}
    />
  );
}

function solidConnectorClass(left: WipStepState, right: WipStepState): string {
  if (left === "completed" && (right === "completed" || right === "in_progress")) {
    return "bg-health-ok";
  }
  if (left === "in_progress" || (left === "completed" && right === "upcoming")) {
    return "bg-accent";
  }
  return "bg-slate-200";
}

function connectorIsDashed(left: WipStepState, right: WipStepState): boolean {
  return left === "upcoming" || (left === "in_progress" && right === "upcoming");
}

function connectorDuration(step: WipStep): string | undefined {
  if (step.durationShort?.trim()) return step.durationShort.trim();
  return step.durationLabel;
}

const durationPillClass =
  "whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold leading-none tabular-nums ring-1 ring-slate-200/80";

const durationTooltipClass =
  "pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 w-[min(100vw-2rem,15rem)] -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-left text-xs leading-relaxed text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";

function durationTooltipCopy(
  step: WipStep,
  nextStepLabel: string | undefined,
  short: string | undefined,
): { headline: string; detail: string; aria: string } {
  const to = nextStepLabel ?? "next step";
  const span = `${step.label} → ${to}`;
  if (short) {
    return {
      headline: `${short} expected`,
      detail: `Between ${span}. Click to change.`,
      aria: `${short} expected between ${span}. Click to edit.`,
    };
  }
  return {
    headline: "Add days between steps",
    detail: `After ${span}. Use values like 1d or 2–3d.`,
    aria: `Add expected days after ${span}. Example: 1d or 2-3d.`,
  };
}

function DurationTooltip({ headline, detail }: { headline: string; detail: string }) {
  return (
    <span className={durationTooltipClass} role="tooltip">
      <span className="block text-[13px] font-semibold leading-tight text-white">{headline}</span>
      <span className="mt-1 block text-[11px] font-normal leading-snug text-slate-200">{detail}</span>
    </span>
  );
}

function DurationPill({
  step,
  nextStepLabel,
  visible,
  editable,
  onChange,
}: {
  step: WipStep;
  nextStepLabel?: string;
  visible: boolean;
  editable: boolean;
  onChange?: (stepId: string, durationShort: string) => void;
}) {
  const short = connectorDuration(step);
  const tip = step.durationLabel ?? step.durationShort;
  const tooltip = durationTooltipCopy(step, nextStepLabel, short);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(short ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(short ?? "");
  }, [short, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!visible) {
    return <span className="h-5 w-full" aria-hidden />;
  }

  function commit() {
    const next = normalizeDurationShort(draft);
    const current = step.durationShort ? normalizeDurationShort(step.durationShort) : "";
    if (next !== current) {
      onChange?.(step.id, next);
    }
    setEditing(false);
  }

  if (editing && editable && onChange) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        aria-label={`Days after ${step.label}`}
        placeholder="1d"
        className={`${durationPillClass} min-w-[2.75rem] border border-accent bg-white text-text-primary outline-none ring-2 ring-accent/30`}
        style={{ width: `${Math.max(2.75, draft.length + 0.5)}ch` }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(short ?? "");
            setEditing(false);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (editable && onChange) {
    const empty = !short;
    return (
      <span className="group relative inline-flex max-w-full justify-center">
        <DurationTooltip headline={tooltip.headline} detail={tooltip.detail} />
        <button
          type="button"
          title={tooltip.aria}
          aria-label={tooltip.aria}
          className={
            empty
              ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold leading-none text-text-secondary ring-1 ring-slate-200/80 transition hover:bg-white hover:text-accent hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              : `${durationPillClass} cursor-pointer text-text-secondary transition hover:bg-white hover:text-text-primary hover:ring-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`
          }
          onClick={(e) => {
            e.stopPropagation();
            setDraft(short ?? "");
            setEditing(true);
          }}
        >
          {short ?? "+"}
        </button>
      </span>
    );
  }

  if (!short) {
    return <span className="h-5 w-full" aria-hidden />;
  }

  return (
    <span className={`${durationPillClass} text-text-secondary`} title={tip}>
      {short}
    </span>
  );
}

function Connector({
  left,
  right,
  showDuration,
  editableDurations,
  onDurationChange,
}: {
  left: WipStep;
  right: WipStep;
  showDuration: boolean;
  editableDurations?: boolean;
  onDurationChange?: (stepId: string, durationShort: string) => void;
}) {
  const dashed = connectorIsDashed(left.state, right.state);

  return (
    <div className="flex min-w-[2.75rem] flex-1 flex-col self-start px-0.5">
      <div className="flex h-5 shrink-0 items-center justify-center">
        <DurationPill
          step={left}
          nextStepLabel={right.label}
          visible={showDuration}
          editable={Boolean(editableDurations && onDurationChange)}
          onChange={onDurationChange}
        />
      </div>
      <div className="mt-1 flex h-3 items-center">
        {dashed ? <DashedLine /> : <SolidLine left={left.state} right={right.state} />}
      </div>
    </div>
  );
}

function DashedLine() {
  return <div className="h-0 w-full border-t-2 border-dashed border-slate-300" aria-hidden />;
}

function SolidLine({ left, right }: { left: WipStepState; right: WipStepState }) {
  return <div className={`h-1 w-full rounded-full ${solidConnectorClass(left, right)}`} aria-hidden />;
}

/** Compact progress for table rows (e.g. job list). Full step strip stays in modals / project timeline. */
export function WipProgressSummary({ steps, className = "" }: { steps: WipStep[]; className?: string }) {
  const { completed, total, currentLabel, tooltip } = summarizeWipSteps(steps);

  if (total === 0) {
    return <span className={`text-xs text-text-secondary ${className}`}>—</span>;
  }

  const pct = Math.round((completed / total) * 100);
  const barClass = completed === total ? "bg-health-ok" : completed > 0 ? "bg-accent" : "bg-slate-300";

  return (
    <div
      className={`min-w-0 max-w-[6.5rem] ${className}`}
      title={tooltip}
      aria-label={`${completed} of ${total} steps done${currentLabel ? `, current: ${currentLabel}` : ""}`}
    >
      <p className="text-xs font-semibold tabular-nums text-text-primary">
        {completed}/{total} <span className="font-medium text-text-secondary">done</span>
      </p>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full transition-[width] ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TimelineLegend() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-border-light pt-4 text-[11px] text-text-secondary">
      <span className="inline-flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-health-ok text-[9px] text-white">✓</span>
        Completed
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-white">
          <ClockIcon className="h-2.5 w-2.5" />
        </span>
        In progress
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-4 rounded-full border-2 border-slate-300 bg-white" />
        Upcoming
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-4 rounded-full border-2 border-dashed border-slate-300" />
        Not applicable
      </span>
    </div>
  );
}

export function WipTimeline({
  steps,
  className = "",
  editableDurations = false,
  onDurationChange,
  onStepClick,
}: {
  steps: WipStep[];
  className?: string;
  editableDurations?: boolean;
  onDurationChange?: (stepId: string, durationShort: string) => void;
  /** Opens Job Details scrolled to the section for this step. */
  onStepClick?: (stepId: string) => void;
}) {
  return (
    <section
      className={`scrollbar-light-gray overflow-x-auto rounded-2xl border border-border-light bg-surface-card p-6 shadow-sm [-ms-overflow-style:auto] [scrollbar-gutter:stable] ${className}`}
    >
      {editableDurations ? (
        <p className="mb-3 text-[11px] text-text-secondary">Tap + between steps to add or edit days.</p>
      ) : onStepClick ? (
        <p className="mb-3 text-[11px] text-text-secondary">Tap a step to open Job Details at that task.</p>
      ) : null}
      <div
        className="flex items-start"
        style={{ minWidth: `${Math.max(720, steps.length * 92)}px` }}
      >
        {steps.map((step, i) => {
          const next = steps[i + 1];
          const dur = connectorDuration(step);
          const prevDur = i > 0 ? connectorDuration(steps[i - 1]!) : undefined;
          const showDuration = editableDurations
            ? Boolean(next)
            : Boolean(dur && dur !== prevDur);
          return (
            <div key={step.id} className="flex flex-1 items-start">
              <div
                className={`flex flex-col items-center px-1 pt-6 ${
                  step.state === "in_progress" ? "min-w-[5.5rem]" : "min-w-[4.5rem]"
                } ${onStepClick ? "cursor-pointer rounded-xl transition hover:bg-violet-50/80" : ""}`}
                role={onStepClick ? "button" : undefined}
                tabIndex={onStepClick ? 0 : undefined}
                onClick={onStepClick ? () => onStepClick(step.id) : undefined}
                onKeyDown={
                  onStepClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onStepClick(step.id);
                        }
                      }
                    : undefined
                }
              >
                <StepIcon state={step.state} large={step.state === "in_progress"} />
                <p
                  className={`mt-2 text-center leading-tight ${
                    step.state === "in_progress"
                      ? "text-sm font-semibold text-accent"
                      : "text-[10px] font-medium text-text-primary sm:text-xs"
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {next ? (
                <Connector
                  left={step}
                  right={next}
                  showDuration={showDuration}
                  editableDurations={editableDurations}
                  onDurationChange={onDurationChange}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <TimelineLegend />
    </section>
  );
}
