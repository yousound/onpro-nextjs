import type {
  FinishingPreset,
  JobFinishingTask,
  SuppliedBy,
} from "@/lib/types/brand-products";
import { FINISHING_PRESET_LABELS, SUPPLIED_BY_LABELS } from "@/lib/types/brand-products";

export function newFinishingId(): string {
  return `fin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newFinishingLineId(): string {
  return `fli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function presetFinishingTask(
  preset: Exclude<FinishingPreset, "custom">,
  supplied_by?: SuppliedBy | null,
): JobFinishingTask {
  return {
    id: newFinishingId(),
    kind: "preset",
    preset,
    supplied_by: supplied_by ?? null,
    notes: null,
  };
}

export function customFinishingSection(section_name: string): JobFinishingTask {
  return {
    id: newFinishingId(),
    kind: "custom",
    section_name,
    items: [{ id: newFinishingLineId(), description: "", supplied_by: null }],
  };
}

export function finishingTaskLabel(task: JobFinishingTask): string {
  if (task.kind === "preset") return FINISHING_PRESET_LABELS[task.preset];
  return task.section_name.trim() || "Custom finishing";
}

export function formatSuppliedSuffix(supplied_by?: SuppliedBy | null): string {
  if (!supplied_by) return "";
  const short =
    supplied_by === "client"
      ? "Client"
      : supplied_by === "operator"
        ? "Operator"
        : "Vendor";
  return ` — ${short} supplied`;
}

/** Plain-text lines for vendor RFQ / emails. */
export function finishingTasksToLines(tasks: JobFinishingTask[]): string[] {
  const lines: string[] = [];
  for (const task of tasks) {
    if (task.kind === "preset") {
      const base = FINISHING_PRESET_LABELS[task.preset];
      const suffix = formatSuppliedSuffix(task.supplied_by);
      const note = task.notes?.trim();
      lines.push(note ? `${base}${suffix} (${note})` : `${base}${suffix}`.trim());
      continue;
    }
    for (const item of task.items) {
      const text = item.description.trim();
      if (!text) continue;
      lines.push(`${text}${formatSuppliedSuffix(item.supplied_by)}`.trim());
    }
  }
  return lines.filter(Boolean);
}

export function suppliedBySelectOptions(): { value: SuppliedBy | ""; label: string }[] {
  return [
    { value: "", label: "Not specified" },
    ...(
      Object.entries(SUPPLIED_BY_LABELS) as [SuppliedBy, string][]
    ).map(([value, label]) => ({ value, label })),
  ];
}

export const FINISHING_PRESET_OPTIONS = (
  Object.entries(FINISHING_PRESET_LABELS) as [Exclude<FinishingPreset, "custom">, string][]
).map(([value, label]) => ({ value, label }));
