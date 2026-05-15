export function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = i === 0 ? 0 : v < 10 ? 1 : v < 100 ? 1 : 0;
  return `${v.toFixed(digits)} ${u[i]}`;
}

/** `yyyy-MM-dd` for `<input type="date">` from an ISO string (local calendar day). */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Midday UTC for date-only fields (matches mock project JSON style). */
export function dateInputToIso(ymd: string): string | null {
  const s = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return `${s}T12:00:00.000Z`;
}

export function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Compact timeline SLA: `1` → `1d`, `2-3` → `2-3d`; keeps values that already end with `d`. */
export function normalizeDurationShort(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/d$/i.test(t)) return t;
  return `${t}d`;
}

/** Pill label for saved durations (fixes legacy `1` without suffix). */
export function displayDurationShort(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  return normalizeDurationShort(value);
}

export function formatCellValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return formatShortDate(value);
  }
  return String(value);
}
