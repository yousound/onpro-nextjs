import type { CalendarEvent } from "@/lib/types/calendar";

/** Stable column order for operations lanes (inspired by staff columns; OnPro = dept / lane). */
export const CALENDAR_COLUMN_ORDER = [
  "Receiving",
  "Product",
  "Production",
  "Logistics",
  "QC",
] as const;

export function eventsForDate(events: CalendarEvent[], ymd: string): CalendarEvent[] {
  return events.filter((e) => e.date === ymd);
}

/** Next N events from now (inclusive), sorted by start time — for quick jump navigation. */
export function upcomingCalendarEvents(
  events: CalendarEvent[],
  limit = 6,
  now: Date = new Date(),
): CalendarEvent[] {
  const nowMs = now.getTime();
  return [...events]
    .filter((e) => {
      const start = new Date(e.start_time).getTime();
      return Number.isFinite(start) && start >= nowMs;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, limit);
}

export function calendarColumnsForDay(events: CalendarEvent[]): string[] {
  const set = new Set<string>([...CALENDAR_COLUMN_ORDER]);
  for (const e of events) {
    if (e.department?.trim()) set.add(e.department.trim());
  }
  const order = [...CALENDAR_COLUMN_ORDER] as string[];
  const ordered = order.filter((d) => set.has(d));
  const rest = [...set].filter((d) => !order.includes(d)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

export function columnForEvent(ev: CalendarEvent): string {
  const d = ev.department?.trim();
  if (d) return d;
  if (ev.event_type === "shipping") return "Logistics";
  if (ev.event_type === "meeting" || ev.event_type === "sample_review") return "Product";
  if (ev.event_type === "deadline" || ev.event_type === "production") return "Production";
  return "Receiving";
}

/** Minutes from midnight local for an ISO datetime string */
export function minutesFromMidnight(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

export function durationMinutes(startIso: string, endIso: string): number {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 30;
  return Math.round((b - a) / 60000);
}

export function formatCalendarDayHeading(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeRange(startIso: string, endIso: string): string {
  const o = { hour: "numeric", minute: "2-digit" } as const;
  return `${new Date(startIso).toLocaleTimeString(undefined, o)} – ${new Date(endIso).toLocaleTimeString(undefined, o)}`;
}

export function addDaysYmd(ymd: string, delta: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build UTC ISO from calendar day + `HH:mm` in **local** timezone. */
export function localDayAndTimeToIso(ymd: string, hm: string): string {
  const [y, mo, day] = ymd.split("-").map(Number);
  const [hh, mm] = hm.split(":").map((x) => Number(x));
  return new Date(y, (mo || 1) - 1, day || 1, hh || 0, mm || 0, 0, 0).toISOString();
}
