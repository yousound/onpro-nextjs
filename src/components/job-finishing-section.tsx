"use client";

import { useState } from "react";
import type { JobFinishingTask, SuppliedBy, FinishingPreset } from "@/lib/types/brand-products";
import {
  FINISHING_PRESET_OPTIONS,
  customFinishingSection,
  finishingTaskLabel,
  newFinishingLineId,
  presetFinishingTask,
  suppliedBySelectOptions,
} from "@/lib/brand-products/finishing";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function JobFinishingSection({
  tasks,
  onChange,
  fieldClass,
}: {
  tasks: JobFinishingTask[];
  onChange: (tasks: JobFinishingTask[]) => void;
  fieldClass: string;
}) {
  const [pendingPreset, setPendingPreset] = useState<FinishingPreset | "">("");

  function addPreset(preset: Exclude<FinishingPreset, "custom">) {
    onChange([...tasks, presetFinishingTask(preset)]);
    setPendingPreset("");
  }

  function addCustom() {
    onChange([...tasks, customFinishingSection("Custom section")]);
    setPendingPreset("");
  }

  function removeTask(id: string) {
    onChange(tasks.filter((t) => t.id !== id));
  }

  function patchTask(id: string, patch: Partial<JobFinishingTask>) {
    onChange(
      tasks.map((t) => (t.id === id ? ({ ...t, ...patch } as JobFinishingTask) : t)),
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Finishing</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Add standard tasks or custom sections with multiple line items. Mark who supplies each
          component.
        </p>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">No finishing tasks yet.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{finishingTaskLabel(task)}</p>
                <button
                  type="button"
                  onClick={() => removeTask(task.id)}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>

              {task.kind === "preset" ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    Supplied by
                    <select
                      className={fieldClass}
                      value={task.supplied_by ?? ""}
                      onChange={(e) =>
                        patchTask(task.id, {
                          supplied_by: (e.target.value || null) as SuppliedBy | null,
                        })
                      }
                    >
                      {suppliedBySelectOptions().map((opt) => (
                        <option key={opt.label} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Notes
                    <input
                      className={fieldClass}
                      value={task.notes ?? ""}
                      onChange={(e) => patchTask(task.id, { notes: e.target.value || null })}
                      placeholder="Optional detail"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <label className={labelClass}>
                    Section name
                    <input
                      className={fieldClass}
                      value={task.section_name}
                      onChange={(e) => patchTask(task.id, { section_name: e.target.value })}
                    />
                  </label>
                  {task.items.map((item, idx) => (
                    <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <input
                        className={fieldClass}
                        value={item.description}
                        placeholder="Line item description"
                        onChange={(e) => {
                          const items = [...task.items];
                          items[idx] = { ...item, description: e.target.value };
                          patchTask(task.id, { items });
                        }}
                      />
                      <select
                        className={fieldClass}
                        value={item.supplied_by ?? ""}
                        onChange={(e) => {
                          const items = [...task.items];
                          items[idx] = {
                            ...item,
                            supplied_by: (e.target.value || null) as SuppliedBy | null,
                          };
                          patchTask(task.id, { items });
                        }}
                      >
                        {suppliedBySelectOptions().map((opt) => (
                          <option key={opt.label} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const items = task.items.filter((_, i) => i !== idx);
                          patchTask(task.id, { items });
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      patchTask(task.id, {
                        items: [
                          ...task.items,
                          { id: newFinishingLineId(), description: "", supplied_by: null },
                        ],
                      });
                    }}
                    className="text-xs font-semibold text-[#7c3aed] hover:underline"
                  >
                    + Add line item
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          className={`${fieldClass} max-w-xs`}
          value={pendingPreset}
          onChange={(e) => {
            const v = e.target.value as FinishingPreset | "";
            setPendingPreset(v);
            if (v && v !== "custom") addPreset(v);
            if (v === "custom") {
              addCustom();
              setPendingPreset("");
            }
          }}
        >
          <option value="">+ Add finishing task…</option>
          {FINISHING_PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          <option value="custom">Custom section…</option>
        </select>
      </div>
    </div>
  );
}
