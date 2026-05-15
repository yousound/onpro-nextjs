import type { WipStep, WipStepState } from "@/lib/types/wip";

export type WipProgress = {
  completed: number;
  total: number;
  /** Active step label, if any. */
  currentLabel?: string;
  tooltip: string;
};

function stateLabel(state: WipStepState): string {
  switch (state) {
    case "completed":
      return "Done";
    case "in_progress":
      return "In progress";
    case "na":
      return "N/A";
    default:
      return "Upcoming";
  }
}

/** Counts applicable steps (excludes N/A) for compact job-row progress. */
export function summarizeWipSteps(steps: WipStep[]): WipProgress {
  const applicable = steps.filter((s) => s.state !== "na");
  const completed = applicable.filter((s) => s.state === "completed").length;
  const total = applicable.length;
  const current =
    applicable.find((s) => s.state === "in_progress") ??
    applicable.find((s) => s.state === "upcoming");
  const tooltip = applicable.map((s) => `${s.label} — ${stateLabel(s.state)}`).join("\n");

  return {
    completed,
    total,
    currentLabel: current?.label,
    tooltip,
  };
}
