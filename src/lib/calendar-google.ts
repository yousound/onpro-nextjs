import type { CalendarEvent } from "@/lib/types/calendar";

/** Stable numeric id from a Google Calendar event id (avoids hash collisions). */
export function googleEventNumericId(googleId: string): number {
  let h = 2166136261;
  for (let i = 0; i < googleId.length; i++) {
    h ^= googleId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) + 1_000_000_000;
}

export function dedupeCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set<string>();
  const out: CalendarEvent[] = [];
  for (const ev of events) {
    const key = `${ev.calendar_owner_email ?? ""}|${ev.external_id ?? ""}|${ev.date}|${ev.start_time}|${ev.end_time}|${ev.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ev);
  }
  return out;
}

/** React list key — unique even when numeric ids collide. */
export function calendarEventReactKey(ev: CalendarEvent, index: number): string {
  return `${ev.calendar_owner_email ?? ""}-${ev.external_id ?? ev.id}-${ev.start_time}-${index}`;
}

/** Events on a given local day (ymd), sorted by start. */
export function calendarEventsForDay(events: CalendarEvent[], ymd: string): CalendarEvent[] {
  return events
    .filter((e) => e.date === ymd)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

export function calendarTodayYmd(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
