"use client";

import { SIZE_RUN_PRESETS, colorwayRowTotal, newColorwayRow, patchColorwayRow } from "@/lib/job-colorways";
import { COMMON_COLORWAY_NAMES, resolveColorCode } from "@/lib/style-number";
import type { JobColorwayRow } from "@/lib/types/wip";

const fieldClass =
  "mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

type Props = {
  rows: JobColorwayRow[];
  onChange: (rows: JobColorwayRow[]) => void;
};

export function JobColorwayEditor({ rows, onChange }: Props) {
  function updateRow(rowId: string, patch: Partial<JobColorwayRow>) {
    onChange(patchColorwayRow(rows, rowId, patch));
  }

  function setSizeRun(rowId: string, presetId: string) {
    const preset = SIZE_RUN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    updateRow(rowId, { size_run: [...preset.sizes], size_qty: {} });
  }

  function setQty(rowId: string, size: string, raw: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const qty = raw.trim() === "" ? undefined : Math.max(0, parseInt(raw, 10) || 0);
    const size_qty = { ...row.size_qty };
    if (qty === undefined) delete size_qty[size];
    else size_qty[size] = qty;
    updateRow(rowId, { size_qty });
  }

  return (
    <div className="space-y-4">
      {rows.map((row, idx) => {
        const total = colorwayRowTotal(row);
        const presetId =
          SIZE_RUN_PRESETS.find((p) => p.sizes.join(",") === row.size_run.join(","))?.id ?? "standard";
        return (
          <div key={row.id} className="rounded-xl border border-border-light bg-surface-body/40 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                Colorway {idx + 1}
              </p>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Colorway
                <input
                  className={fieldClass}
                  list="job-colorway-options"
                  value={row.name}
                  placeholder="e.g. Black, Baby pink"
                  onChange={(e) => updateRow(row.id, { name: e.target.value })}
                />
              </label>
              <label className={labelClass}>
                Color code (3 letters)
                <input
                  className={fieldClass}
                  value={row.color_code}
                  placeholder={resolveColorCode(row.name) || "Auto"}
                  maxLength={3}
                  onChange={(e) =>
                    updateRow(row.id, {
                      color_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3),
                    })
                  }
                />
              </label>
            </div>
            <p className="mt-1 text-[11px] text-text-secondary">
              Code preview:{" "}
              <span className="font-mono font-semibold text-text-primary">
                {row.color_code.trim() || resolveColorCode(row.name) || "—"}
              </span>
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Size range
                <select
                  className={fieldClass}
                  value={presetId}
                  onChange={(e) => setSizeRun(row.id, e.target.value)}
                >
                  {SIZE_RUN_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col justify-end">
                <p className={labelClass}>Total qty</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{total}</p>
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {row.size_run.map((size) => (
                  <label key={size} className="w-16 shrink-0 text-center">
                    <span className="text-[10px] font-semibold uppercase text-text-secondary">{size}</span>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-1 text-center text-sm tabular-nums"
                      value={row.size_qty[size] ?? ""}
                      onChange={(e) => setQty(row.id, size, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <datalist id="job-colorway-options">
        {COMMON_COLORWAY_NAMES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={() => onChange([...rows, newColorwayRow()])}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border-light px-3 py-2 text-xs font-semibold text-text-secondary hover:border-accent hover:text-accent"
      >
        + Add colorway
      </button>
    </div>
  );
}
