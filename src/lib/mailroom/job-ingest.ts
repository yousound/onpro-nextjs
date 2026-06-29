import { newColorwayRow, syncLegacyColorwayFields } from "@/lib/job-colorways";
import { resolveColorCode } from "@/lib/style-number";
import type { JobColorwayRow, ProjectJob } from "@/lib/types/wip";

function parsePayloadQty(payload: Record<string, unknown>): number {
  const raw = payload.qty ?? payload.quantity;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function parseColorNames(payload: Record<string, unknown>): string[] {
  const raw = String(payload.colors ?? payload.color ?? "").trim();
  if (!raw) return [];
  return raw
    .split(/[,;/]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build colorway rows from Mailroom `create_job` payload (`qty`, `colors`, etc.). */
export function colorwayRowsFromMailroomJobPayload(
  payload: Record<string, unknown>,
): JobColorwayRow[] | undefined {
  const qty = parsePayloadQty(payload);
  const colors = parseColorNames(payload);
  if (qty <= 0 && colors.length === 0) return undefined;

  if (colors.length > 0) {
    const basePerColor = colors.length > 1 ? Math.max(1, Math.floor(qty / colors.length)) : qty;
    return colors.map((name, index) => {
      const rowQty =
        colors.length > 1 && qty > 0
          ? index === colors.length - 1
            ? qty - basePerColor * (colors.length - 1)
            : basePerColor
          : qty || 1;
      return newColorwayRow({
        name,
        color_code: resolveColorCode(name),
        size_run: ["OSFA"],
        size_qty: { OSFA: rowQty },
      });
    });
  }

  return [
    newColorwayRow({
      size_run: ["OSFA"],
      size_qty: { OSFA: qty },
    }),
  ];
}

/** Merge Mailroom job fields (qty, colors, description) onto a new job seed. */
export function applyMailroomJobPayloadExtras(
  job: ProjectJob,
  payload: Record<string, unknown>,
): ProjectJob {
  const rows = colorwayRowsFromMailroomJobPayload(payload);
  let next: ProjectJob = { ...job };
  if (rows?.length) {
    next = { ...next, ...syncLegacyColorwayFields({ ...next, colorway_rows: rows }) };
  }
  const description = String(payload.description ?? payload.item_description ?? "").trim();
  if (description && !next.description?.trim()) {
    next.description = description;
  }
  return next;
}

/** Total units across job colorway rows (for vendor quotes). */
export function jobColorwayTotalQty(job: Pick<ProjectJob, "colorway_rows">): number {
  const rows = job.colorway_rows ?? [];
  if (rows.length === 0) return 0;
  let total = 0;
  for (const row of rows) {
    for (const size of row.size_run) {
      total += Number(row.size_qty[size]) || 0;
    }
  }
  return total;
}
