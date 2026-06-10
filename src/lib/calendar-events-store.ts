import { calendarEventTombstoneKey } from "@/lib/calendar-google";
import { formatTimeRange, localDayAndTimeToIso } from "@/lib/calendar-utils";
import type { AttachmentComposerDraft } from "@/lib/attachment-composer-draft";
import { formatShortDate } from "@/lib/format";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import type { CalendarEvent, CalendarEventType } from "@/lib/types/calendar";

export function readDeletedCalendarTombstones(): Set<string> {
  const list = readMockLs<string[]>(MOCK_LS.deletedCalendarEvents) ?? [];
  return new Set(list);
}

export function tombstoneCalendarEvent(ev: CalendarEvent): void {
  const key = calendarEventTombstoneKey(ev);
  const set = readDeletedCalendarTombstones();
  set.add(key);
  writeMockLs(MOCK_LS.deletedCalendarEvents, [...set]);
}

export function filterDeletedCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  const hidden = readDeletedCalendarTombstones();
  if (hidden.size === 0) return events;
  return events.filter((ev) => !hidden.has(calendarEventTombstoneKey(ev)));
}

export function readExtraCalendarEvents(): CalendarEvent[] {
  return readMockLs<CalendarEvent[]>(MOCK_LS.calendarEvents) ?? [];
}

export function writeExtraCalendarEvents(events: CalendarEvent[]): void {
  writeMockLs(MOCK_LS.calendarEvents, events);
}

export function loadAllCalendarEvents(seed: CalendarEvent[]): CalendarEvent[] {
  const extras = readExtraCalendarEvents();
  const byId = new Map<number, CalendarEvent>();
  for (const e of seed) byId.set(e.id, e);
  for (const e of extras) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.start_time.localeCompare(b.start_time);
  });
}

function hmFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "10:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function calendarEventWhenLabel(ev: Pick<CalendarEvent, "date" | "start_time" | "end_time">): string {
  const day = formatShortDate(`${ev.date}T12:00:00`);
  return `${day} · ${formatTimeRange(ev.start_time, ev.end_time)}`;
}

export function calendarEventSourceLabel(ev: CalendarEvent): string {
  return calendarEventWhenLabel(ev);
}

export function draftFromCalendarEvent(
  ev: CalendarEvent,
  base: AttachmentComposerDraft,
): AttachmentComposerDraft {
  return {
    ...base,
    kind: "calendar_event",
    selectedSourceId: `calendar:${ev.id}`,
    calTitle: ev.name,
    calDate: ev.date,
    calStart: hmFromIso(ev.start_time),
    calEnd: hmFromIso(ev.end_time),
    calType: ev.event_type ?? "meeting",
    calDesc: ev.description ?? "",
    calWhere: ev.notes?.trim() && ev.notes !== "Block" ? ev.notes : "",
    calWhen: calendarEventWhenLabel(ev),
    projectName: ev.link_to_client?.trim() || base.projectName,
  };
}

export function blankCalendarComposerFields(
  roomTitle: string,
  clientName?: string | null,
): Pick<
  AttachmentComposerDraft,
  | "calTitle"
  | "calDate"
  | "calStart"
  | "calEnd"
  | "calType"
  | "calDesc"
  | "calWhere"
  | "calWhen"
  | "selectedSourceId"
  | "projectName"
> {
  const today = new Date().toISOString().slice(0, 10);
  return {
    selectedSourceId: "",
    calTitle: "",
    calDate: today,
    calStart: "10:00",
    calEnd: "11:00",
    calType: "meeting",
    calDesc: "",
    calWhere: "",
    calWhen: "",
    projectName: clientName?.trim() || roomTitle,
  };
}

export function calendarWhenFromDraft(
  date: string,
  start: string,
  end: string,
): string {
  const startIso = localDayAndTimeToIso(date, start);
  const endIso = localDayAndTimeToIso(date, end);
  const day = formatShortDate(`${date}T12:00:00`);
  return `${day} · ${formatTimeRange(startIso, endIso)}`;
}

export type CalendarComposerFields = {
  calTitle: string;
  calDate: string;
  calStart: string;
  calEnd: string;
  calType: CalendarEventType;
  calDesc: string;
  calWhere: string;
  linkToClient: string | null;
  existingId: number | null;
};

export function buildCalendarEventFromComposer(fields: CalendarComposerFields): CalendarEvent {
  const startIso = localDayAndTimeToIso(fields.calDate, fields.calStart);
  const endIso = localDayAndTimeToIso(fields.calDate, fields.calEnd);
  return {
    id: fields.existingId ?? Date.now(),
    name: fields.calTitle.trim() || "Untitled event",
    description: fields.calDesc.trim() || null,
    date: fields.calDate,
    start_time: startIso,
    end_time: endIso,
    event_type: fields.calType,
    delivery_by: null,
    shipped_from: null,
    shipped_to: null,
    type_of_product: null,
    link_to_client: fields.linkToClient,
    po: null,
    invoice: null,
    received_by: null,
    department: fields.calType === "shipping" ? "Logistics" : "Product",
    notes: fields.calWhere.trim() || null,
    receiving_options: null,
  };
}

/** Persist to browser extras; seed-only ids are copied with a new id. */
export function upsertCalendarEvent(
  ev: CalendarEvent,
  seedIds: ReadonlySet<number>,
): CalendarEvent {
  const extras = readExtraCalendarEvents();
  const isSeedOnly = seedIds.has(ev.id) && !extras.some((e) => e.id === ev.id);
  if (isSeedOnly) {
    const created = { ...ev, id: Date.now() };
    writeExtraCalendarEvents([...extras, created]);
    return created;
  }
  const idx = extras.findIndex((e) => e.id === ev.id);
  if (idx >= 0) {
    const next = [...extras];
    next[idx] = ev;
    writeExtraCalendarEvents(next);
    return ev;
  }
  writeExtraCalendarEvents([...extras, ev]);
  return ev;
}

export function parseCalendarSourceId(sourceId: string): number | null {
  if (!sourceId.startsWith("calendar:")) return null;
  const id = parseInt(sourceId.slice("calendar:".length), 10);
  return Number.isFinite(id) ? id : null;
}

/** Delete locally or on Google Calendar (Live). */
export async function removeCalendarEvent(
  ev: CalendarEvent,
  opts: { live: boolean; onRefreshGoogle?: () => void },
): Promise<void> {
  if (ev.external_id?.trim() && opts.live) {
    const { deleteCalendarEventViaApi } = await import("@/lib/data/calendar-api");
    await deleteCalendarEventViaApi(ev);
    tombstoneCalendarEvent(ev);
    opts.onRefreshGoogle?.();
    return;
  }
  deleteLocalCalendarEvent(ev);
}

/** Remove from browser extras or tombstone seed/Google-overlay events. */
export function deleteLocalCalendarEvent(ev: CalendarEvent): void {
  const extras = readExtraCalendarEvents();
  const inExtras = extras.some((e) => e.id === ev.id);
  if (inExtras) {
    writeExtraCalendarEvents(extras.filter((e) => e.id !== ev.id));
    return;
  }
  tombstoneCalendarEvent(ev);
}
