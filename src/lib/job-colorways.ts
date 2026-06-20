import { DEFAULT_LABEL_SIZES } from "@/lib/label-sizes";
import { colorwayAbbrev, resolveColorCode } from "@/lib/style-number";
import type { JobColorwayRow, ProjectJob } from "@/lib/types/wip";

export const SIZE_RUN_PRESETS: { id: string; label: string; sizes: string[] }[] = [
  { id: "standard", label: "S – XL", sizes: ["S", "M", "L", "XL"] },
  { id: "extended", label: "S – 2XL", sizes: ["S", "M", "L", "XL", "2XL"] },
  { id: "full", label: "S – 5XL", sizes: ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] },
  { id: "youth", label: "YXS – YXL", sizes: ["YXS", "YS", "YM", "YL", "YXL"] },
];

export function newColorwayRow(partial: Partial<JobColorwayRow> = {}): JobColorwayRow {
  return {
    id: partial.id ?? `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: partial.name ?? "",
    color_code: partial.color_code ?? "",
    size_run: partial.size_run?.length ? [...partial.size_run] : [...DEFAULT_LABEL_SIZES],
    size_qty: { ...(partial.size_qty ?? {}) },
  };
}

export function colorwayRowTotal(row: JobColorwayRow): number {
  return row.size_run.reduce((sum, size) => sum + (Number(row.size_qty[size]) || 0), 0);
}

export function formatColorwayRowBreakdown(row: JobColorwayRow): string {
  const parts = row.size_run
    .map((size) => {
      const qty = Number(row.size_qty[size]) || 0;
      return qty > 0 ? `${size}-${qty}` : null;
    })
    .filter(Boolean);
  const total = colorwayRowTotal(row);
  if (!parts.length) return "";
  return `${parts.join(", ")} · TTL ${total}`;
}

export function formatJobSizeBreakdown(rows: JobColorwayRow[]): string {
  return rows
    .map((row) => {
      const line = formatColorwayRowBreakdown(row);
      if (!line) return null;
      const label = row.name.trim() || row.color_code.trim() || "Colorway";
      return `${label}: ${line}`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Sync legacy single colorway fields from the first row. */
export function syncLegacyColorwayFields(
  job: Pick<ProjectJob, "colorway" | "color_code" | "colorway_rows">,
): Pick<ProjectJob, "colorway" | "color_code" | "colorway_rows" | "size_breakdown"> {
  const rows = normalizeColorwayRows(job);
  const primary = rows[0];
  return {
    colorway_rows: rows,
    colorway: primary?.name ?? job.colorway ?? "",
    color_code: primary?.color_code ?? job.color_code ?? "",
    size_breakdown: formatJobSizeBreakdown(rows) || undefined,
  };
}

export function normalizeColorwayRows(
  job: Pick<ProjectJob, "colorway" | "color_code" | "colorway_rows">,
): JobColorwayRow[] {
  if (job.colorway_rows?.length) {
    return job.colorway_rows.map((row) => ({
      ...row,
      size_run: row.size_run?.length ? row.size_run : [...DEFAULT_LABEL_SIZES],
      size_qty: { ...(row.size_qty ?? {}) },
    }));
  }
  if (job.colorway?.trim()) {
    return [
      newColorwayRow({
        name: job.colorway,
        color_code: job.color_code?.trim() || resolveColorCode(job.colorway),
      }),
    ];
  }
  return [newColorwayRow()];
}

export function patchColorwayRow(
  rows: JobColorwayRow[],
  rowId: string,
  patch: Partial<JobColorwayRow>,
): JobColorwayRow[] {
  return rows.map((row) => {
    if (row.id !== rowId) return row;
    const next = { ...row, ...patch };
    if (patch.name !== undefined && patch.color_code === undefined) {
      next.color_code = colorwayAbbrev(patch.name);
    }
    return next;
  });
}
