"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AddCalendarEventModal, type CalendarEventDraft } from "@/components/add-calendar-event-modal";
import { CalendarEventAssistantModal } from "@/components/calendar-event-assistant-modal";
import type { CalendarEvent } from "@/lib/types/calendar";
import {
  CALENDAR_COLUMN_ORDER,
  addDaysYmd,
  calendarColumnsForDay,
  columnForEvent,
  durationMinutes,
  eventsForDate,
  formatCalendarDayHeading,
  formatTimeRange,
  localDayAndTimeToIso,
  minutesFromMidnight,
  upcomingCalendarEvents,
} from "@/lib/calendar-utils";
import { calendarEventReactKey } from "@/lib/calendar-google";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { clientInitials, formatShortDate } from "@/lib/format";
import {
  filterDeletedCalendarEvents,
  readExtraCalendarEvents,
  removeCalendarEvent,
} from "@/lib/calendar-events-store";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";

const VIEW_START_HOUR = 7;
const VIEW_END_HOUR = 19;
const SLOT_MINUTES = 30;
const ROW_PX = 28;

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBlocked(ev: CalendarEvent): boolean {
  const n = ev.notes?.trim().toLowerCase();
  if (n === "block") return true;
  return ev.name.toLowerCase().includes("blocked");
}

function eventTypeLabel(t: CalendarEvent["event_type"]): string {
  if (!t) return "Event";
  return t.replace(/_/g, " ");
}

export function CalendarDayView({
  initialEvents,
  initialYmd,
  openAddSignal = 0,
  onRefreshGoogle,
  refreshingGoogle = false,
}: {
  initialEvents: CalendarEvent[];
  /** SSR snapshot of “today” so server and client agree on the first paint. */
  initialYmd: string;
  openAddSignal?: number;
  onRefreshGoogle?: () => void;
  refreshingGoogle?: boolean;
}) {
  const [ymd, setYmd] = useState(initialYmd);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [assistantEvent, setAssistantEvent] = useState<CalendarEvent | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [extraEvents, setExtraEvents] = useState<CalendarEvent[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addType, setAddType] = useState<NonNullable<CalendarEvent["event_type"]>>("meeting");
  const [addDept, setAddDept] = useState("Receiving");
  const [addDate, setAddDate] = useState(initialYmd);
  const [addStart, setAddStart] = useState("10:00");
  const [addEnd, setAddEnd] = useState("11:00");
  const [addDesc, setAddDesc] = useState("");
  const [addPo, setAddPo] = useState("");
  const [addBlock, setAddBlock] = useState(false);
  const [slotHover, setSlotHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [hiddenTick, setHiddenTick] = useState(0);

  useEffect(() => {
    const saved = readExtraCalendarEvents();
    if (saved.length) setExtraEvents(saved);
  }, []);

  useEffect(() => {
    if (openAddSignal > 0) setAddOpen(true);
  }, [openAddSignal]);

  const allEvents = useMemo(
    () => filterDeletedCalendarEvents([...initialEvents, ...extraEvents]),
    [initialEvents, extraEvents, hiddenTick],
  );

  const seedEventIds = useMemo(
    () => new Set(initialEvents.map((e) => e.id)),
    [initialEvents],
  );

  function openEventAssistant(ev: CalendarEvent) {
    setSelectedId(ev.id);
    setYmd(ev.date);
    setAssistantEvent(ev);
    setDeleteConfirm(false);
    setDeleteError(null);
  }

  async function handleDeleteSelected() {
    if (!selected || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await removeCalendarEvent(selected, {
        live: isClientLiveBackend(),
        onRefreshGoogle,
      });
      setExtraEvents(readExtraCalendarEvents());
      setSelectedId(null);
      setAssistantEvent(null);
      setDeleteConfirm(false);
      setHiddenTick((t) => t + 1);
      window.dispatchEvent(new Event("onpro-calendar-changed"));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete event");
    } finally {
      setDeleting(false);
    }
  }

  function handleAssistantEventUpdated(updated: CalendarEvent) {
    setAssistantEvent(updated);
    setExtraEvents(readExtraCalendarEvents());
    if (isClientLiveBackend()) onRefreshGoogle?.();
  }

  function persistExtras(next: CalendarEvent[]) {
    setExtraEvents(next);
    writeMockLs(MOCK_LS.calendarEvents, next);
  }

  useEffect(() => {
    if (addOpen) setAddDate(ymd);
  }, [addOpen, ymd]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((x) => x + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const dayEvents = useMemo(() => eventsForDate(allEvents, ymd), [allEvents, ymd]);
  const columns = useMemo(() => calendarColumnsForDay(dayEvents), [dayEvents]);

  const todayYmd = useMemo(() => localYmd(new Date()), [nowTick]);
  const upcoming = useMemo(
    () => upcomingCalendarEvents(allEvents, 6),
    [allEvents, nowTick],
  );
  const showOwnerOnUpcoming = useMemo(() => {
    const owners = new Set(
      allEvents.map((e) => e.calendar_owner_email).filter(Boolean) as string[],
    );
    return owners.size > 1;
  }, [allEvents]);

  const selected = useMemo(
    () => dayEvents.find((e) => e.id === selectedId) ?? null,
    [dayEvents, selectedId],
  );

  useEffect(() => {
    if (selectedId != null && !dayEvents.some((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
  }, [dayEvents, selectedId]);

  useEffect(() => {
    setDeleteConfirm(false);
    setDeleteError(null);
  }, [selectedId]);

  const patchAddDraft = useCallback((patch: Partial<CalendarEventDraft>) => {
    if (patch.title !== undefined) setAddTitle(patch.title);
    if (patch.type !== undefined) setAddType(patch.type);
    if (patch.dept !== undefined) setAddDept(patch.dept);
    if (patch.date !== undefined) setAddDate(patch.date);
    if (patch.start !== undefined) setAddStart(patch.start);
    if (patch.end !== undefined) setAddEnd(patch.end);
    if (patch.desc !== undefined) setAddDesc(patch.desc);
    if (patch.po !== undefined) setAddPo(patch.po);
    if (patch.block !== undefined) setAddBlock(patch.block);
  }, []);

  const addDraft = useMemo<CalendarEventDraft>(
    () => ({
      title: addTitle,
      type: addType,
      dept: addDept,
      date: addDate,
      start: addStart,
      end: addEnd,
      desc: addDesc,
      po: addPo,
      block: addBlock,
    }),
    [addTitle, addType, addDept, addDate, addStart, addEnd, addDesc, addPo, addBlock],
  );

  const slots = ((VIEW_END_HOUR - VIEW_START_HOUR) * 60) / SLOT_MINUTES;
  const gridHeight = slots * ROW_PX;

  const viewStartMin = VIEW_START_HOUR * 60;
  const viewEndMin = VIEW_END_HOUR * 60;

  const fmtHM = useCallback((totalMin: number) => {
    const h = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }, []);

  const clockLabel = useCallback((totalMin: number) => {
    const h = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return new Date(2000, 0, 1, h, mm).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }, []);

  const computeSlotRangeAtOffset = useCallback(
    (offsetYInGrid: number) => {
      const rel = Math.max(0, Math.min(gridHeight - 1, offsetYInGrid));
      const raw = viewStartMin + (rel / ROW_PX) * SLOT_MINUTES;
      const rounded = Math.round(raw / SLOT_MINUTES) * SLOT_MINUTES;
      const startM = Math.max(viewStartMin, Math.min(rounded, viewEndMin - SLOT_MINUTES));
      const endM = Math.min(startM + 60, viewEndMin);
      return { startM, endM };
    },
    [gridHeight, viewStartMin, viewEndMin],
  );

  const slotHoverLabel = useCallback(
    (colName: string, offsetYInGrid: number) => {
      const { startM, endM } = computeSlotRangeAtOffset(offsetYInGrid);
      const datePart = formatShortDate(`${ymd}T12:00:00`);
      return `${datePart} · ${colName} · ${clockLabel(startM)}–${clockLabel(endM)}`;
    },
    [ymd, computeSlotRangeAtOffset, clockLabel],
  );

  const openAddModalAt = useCallback(
    (colName: string, offsetYInGrid: number) => {
      const { startM, endM } = computeSlotRangeAtOffset(offsetYInGrid);
      setAddDept(colName);
      setAddDate(ymd);
      setAddStart(fmtHM(startM));
      setAddEnd(fmtHM(endM));
      setAddOpen(true);
      setSelectedId(null);
    },
    [ymd, computeSlotRangeAtOffset, fmtHM],
  );

  const layoutEvent = useCallback(
    (ev: CalendarEvent) => {
      const start = minutesFromMidnight(ev.start_time);
      const end = minutesFromMidnight(ev.end_time);
      const dur = Math.max(SLOT_MINUTES, durationMinutes(ev.start_time, ev.end_time));
      const topMin = Math.max(0, start - viewStartMin);
      const bottomMin = Math.min(viewEndMin - viewStartMin, end - viewStartMin);
      const heightMin = Math.max(SLOT_MINUTES, bottomMin - topMin || dur);
      const top = (topMin / SLOT_MINUTES) * ROW_PX;
      const height = (heightMin / SLOT_MINUTES) * ROW_PX;
      return { top, height: Math.max(ROW_PX * 1.25, height) };
    },
    [viewStartMin, viewEndMin],
  );

  const nowLine = useMemo(() => {
    void nowTick;
    if (ymd !== localYmd(new Date())) return null;
    const n = new Date();
    const m = n.getHours() * 60 + n.getMinutes();
    if (m < viewStartMin || m > viewEndMin) return null;
    const top = ((m - viewStartMin) / SLOT_MINUTES) * ROW_PX;
    const label = n.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return { top, label };
  }, [ymd, nowTick, viewStartMin, viewEndMin]);

  const hourLabels = useMemo(() => {
    const out: { hour: number; top: number }[] = [];
    for (let h = VIEW_START_HOUR; h < VIEW_END_HOUR; h++) {
      const top = ((h * 60 - viewStartMin) / SLOT_MINUTES) * ROW_PX;
      out.push({ hour: h, top });
    }
    return out;
  }, [viewStartMin]);

  function handleAddSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const title = addTitle.trim();
    if (!title) return;
    const startIso = localDayAndTimeToIso(addDate, addStart);
    const endIso = localDayAndTimeToIso(addDate, addEnd);
    const ev: CalendarEvent = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: addBlock ? `Blocked — ${title}` : title,
      description: addDesc.trim() || null,
      date: addDate,
      start_time: startIso,
      end_time: endIso,
      event_type: addBlock ? "other" : addType,
      delivery_by: null,
      shipped_from: null,
      shipped_to: null,
      type_of_product: null,
      link_to_client: null,
      po: addPo.trim() || null,
      invoice: null,
      received_by: null,
      department: addDept,
      notes: addBlock ? "Block" : null,
      receiving_options: null,
    };
    persistExtras([...extraEvents, ev]);
    setAddOpen(false);
    setAddTitle("");
    setAddDesc("");
    setAddPo("");
    setAddBlock(false);
    setYmd(addDate);
    setSelectedId(ev.id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 min-h-0 flex-col bg-white px-4 pb-4 pt-3 sm:px-6">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-light bg-white px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setYmd((d) => addDaysYmd(d, -1))}
              className="rounded-lg border border-border-light bg-white px-2.5 py-1.5 text-sm font-medium text-text-primary hover:bg-slate-50"
              aria-label="Previous day"
            >
              ←
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary" suppressHydrationWarning>
                {formatCalendarDayHeading(ymd)}
              </p>
              <p className="text-xs text-text-secondary">{formatShortDate(ymd)} · Day schedule</p>
            </div>
            <button
              type="button"
              onClick={() => setYmd((d) => addDaysYmd(d, 1))}
              className="rounded-lg border border-border-light bg-white px-2.5 py-1.5 text-sm font-medium text-text-primary hover:bg-slate-50"
              aria-label="Next day"
            >
              →
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setYmd(localYmd(new Date()))}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Today
            </button>
            {onRefreshGoogle ? (
              <button
                type="button"
                onClick={onRefreshGoogle}
                disabled={refreshingGoogle}
                className="rounded-lg border border-border-light bg-white px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-slate-50 disabled:opacity-50"
              >
                {refreshingGoogle ? "Syncing…" : "Sync Google"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setAddDept(columns[0] ?? "Receiving");
                setAddDate(ymd);
                setAddStart("10:00");
                setAddEnd("11:00");
                setAddOpen(true);
              }}
              className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Add event
            </button>
          </div>
        </div>

        <div className="sticky top-0 z-10 shrink-0 border-b border-border-light bg-white px-3 py-2.5 sm:px-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
            Upcoming — jump to day
          </p>
          {upcoming.length === 0 ? (
            <p className="pb-1 text-sm text-text-secondary">No upcoming events in this calendar.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
              {upcoming.map((ev, index) => {
                const onViewedDay = ev.date === ymd;
                const dayLabel =
                  ev.date === todayYmd
                    ? "Today"
                    : ev.date === addDaysYmd(todayYmd, 1)
                      ? "Tomorrow"
                      : formatShortDate(`${ev.date}T12:00:00`);
                return (
                  <button
                    key={calendarEventReactKey(ev, index)}
                    type="button"
                    onClick={() => openEventAssistant(ev)}
                    className={`flex min-w-[10.5rem] max-w-[14rem] shrink-0 flex-col rounded-xl border px-3 py-2 text-left shadow-sm transition ${
                      onViewedDay
                        ? "border-accent/40 bg-violet-50 ring-1 ring-accent/25"
                        : "border-border-light bg-white hover:border-accent/30 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide text-accent">
                      {dayLabel}
                    </span>
                    <span className="mt-0.5 truncate text-sm font-semibold text-text-primary">
                      {ev.name}
                    </span>
                    <span className="mt-0.5 text-[11px] text-text-secondary">
                      {formatTimeRange(ev.start_time, ev.end_time)}
                      {showOwnerOnUpcoming && ev.calendar_owner_name
                        ? ` · ${ev.calendar_owner_name}`
                        : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 gap-0 bg-white lg:gap-0">
          <div className="min-h-[420px] min-w-0 flex-1 overflow-auto rounded-b-xl border border-t-0 border-border-light bg-white lg:rounded-br-none">
            <div className="relative flex min-w-[640px]">
              {nowLine ? (
                <div
                  className="pointer-events-none absolute right-0 z-20 flex items-center"
                  style={{ left: 52, top: nowLine.top + 24 }}
                >
                  <span className="z-30 -translate-x-1 rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                    {nowLine.label}
                  </span>
                  <div className="h-px min-w-0 flex-1 bg-blue-600" />
                </div>
              ) : null}
              <div
                className="relative shrink-0 border-r border-border-light bg-white"
                style={{ width: 52, height: gridHeight + 24 }}
              >
                <div className="h-6" aria-hidden />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Add event — pick time; lane defaults to first column"
                  className="absolute left-0 right-0 z-0 cursor-crosshair border-0 bg-transparent hover:bg-blue-500/[0.06]"
                  style={{ top: 24, height: gridHeight }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    setSlotHover({
                      x: e.clientX,
                      y: e.clientY,
                      label: slotHoverLabel(columns[0] ?? "Receiving", y),
                    });
                  }}
                  onMouseLeave={() => setSlotHover(null)}
                  onClick={(e) => {
                    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                    setSlotHover(null);
                    openAddModalAt(columns[0] ?? "Receiving", y);
                  }}
                />
                {hourLabels.map(({ hour, top }) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute right-1.5 -translate-y-1/2 text-right text-[11px] font-medium tabular-nums text-text-secondary"
                    style={{ top: top + 24 }}
                  >
                    {new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                ))}
              </div>

              <div
                className="relative grid min-w-0 flex-1"
                style={{
                  gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`,
                  height: gridHeight + 24,
                }}
              >
                <div className="pointer-events-none absolute left-0 right-0 top-6 h-px bg-border-light" />
                {columns.map((colName) => {
                  const colEvents = dayEvents.filter((e) => columnForEvent(e) === colName);
                  return (
                    <div
                      key={colName}
                      className="relative border-r border-border-light last:border-r-0"
                      style={{ minHeight: gridHeight + 24 }}
                    >
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Add event in ${colName}`}
                        className="absolute left-0 right-0 z-0 cursor-crosshair border-0 bg-transparent hover:bg-blue-500/[0.06]"
                        style={{ top: 24, height: gridHeight }}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          setSlotHover({
                            x: e.clientX,
                            y: e.clientY,
                            label: slotHoverLabel(colName, y),
                          });
                        }}
                        onMouseLeave={() => setSlotHover(null)}
                        onClick={(e) => {
                          const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                          setSlotHover(null);
                          openAddModalAt(colName, y);
                        }}
                      />
                      {hourLabels.map(({ top }) => (
                        <div
                          key={top}
                          className="pointer-events-none absolute left-0 right-0 border-t border-slate-100"
                          style={{ top: top + 24 }}
                        />
                      ))}
                      {colEvents.map((ev, evIndex) => {
                        const { top, height } = layoutEvent(ev);
                        const blocked = isBlocked(ev);
                        const isSel = selectedId === ev.id;
                        return (
                          <button
                            key={calendarEventReactKey(ev, evIndex)}
                            type="button"
                            title={`${formatShortDate(`${ev.date}T12:00:00`)} · ${formatTimeRange(ev.start_time, ev.end_time)} · ${ev.name}`}
                            onClick={() => openEventAssistant(ev)}
                            className={`absolute left-1 right-1 z-[1] flex min-h-[3.25rem] flex-col overflow-hidden rounded-lg border text-left shadow-sm transition-[box-shadow,border-color] ${
                              blocked
                                ? "border-slate-200 bg-[repeating-linear-gradient(-45deg,#f8fafc,#f8fafc_6px,#eef2f7_6px,#eef2f7_12px)]"
                                : "border-slate-200 bg-white hover:border-blue-300"
                            } ${isSel ? "z-10 border-2 border-blue-600 ring-1 ring-blue-600/20" : "border"}`}
                            style={{
                              top: top + 24,
                              height,
                              minHeight: ROW_PX * 2.25,
                            }}
                          >
                            <div className="flex h-full min-h-0 flex-col p-2">
                              {blocked ? (
                                <p className="flex flex-1 items-center justify-center text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Block
                                </p>
                              ) : (
                                <>
                                  <p className="line-clamp-2 text-xs font-semibold leading-tight text-text-primary">{ev.name}</p>
                                  <p className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">{eventTypeLabel(ev.event_type)}</p>
                                  <div className="mt-auto flex items-end justify-between gap-1 pt-1 text-blue-600">
                                    <span className="text-[10px] font-semibold" aria-hidden>
                                      {ev.po || ev.invoice ? "$" : ""}
                                    </span>
                                    <span className="text-[10px]" aria-hidden>
                                      {ev.received_by ? "●" : ""}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="hidden w-[min(100%,380px)] shrink-0 flex-col border-border-light bg-white lg:flex lg:border lg:border-l-0 lg:border-t-0">
            <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
              <h2 className="text-sm font-semibold text-text-primary">Event details</h2>
              <div className="flex items-center gap-1">
                {selected ? (
                  <button
                    type="button"
                    onClick={() => openEventAssistant(selected)}
                    className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    OnPro AI
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-md p-1 text-text-secondary hover:bg-slate-100 hover:text-text-primary"
                  aria-label="Close details"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {selected ? (
                <div className="space-y-5 text-sm">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Title</p>
                    <p className="mt-1 font-semibold text-text-primary">{selected.name}</p>
                    <p className="mt-1 text-xs text-text-secondary">{formatTimeRange(selected.start_time, selected.end_time)}</p>
                  </div>
                  <div className="rounded-xl border border-border-light bg-slate-50/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Lane</p>
                    <p className="mt-1 font-medium text-text-primary">{columnForEvent(selected)}</p>
                    <p className="mt-2 text-xs text-text-secondary">Type</p>
                    <p className="font-medium capitalize text-text-primary">{eventTypeLabel(selected.event_type)}</p>
                  </div>
                  {selected.description ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Notes</p>
                      <p className="mt-1 text-text-primary">{selected.description}</p>
                    </div>
                  ) : null}
                  <div className="space-y-2 border-t border-border-light pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Shipping & receiving</p>
                    <dl className="grid grid-cols-[8rem_1fr] gap-x-2 gap-y-1.5 text-xs">
                      <dt className="text-text-secondary">Carrier</dt>
                      <dd className="text-text-primary">{selected.delivery_by ?? "—"}</dd>
                      <dt className="text-text-secondary">Shipped from</dt>
                      <dd className="text-text-primary">{selected.shipped_from ?? "—"}</dd>
                      <dt className="text-text-secondary">Shipped to</dt>
                      <dd className="text-text-primary">{selected.shipped_to ?? "—"}</dd>
                      <dt className="text-text-secondary">Product</dt>
                      <dd className="text-text-primary">{selected.type_of_product ?? "—"}</dd>
                      <dt className="text-text-secondary">PO</dt>
                      <dd className="text-text-primary">{selected.po ?? "—"}</dd>
                      <dt className="text-text-secondary">Invoice</dt>
                      <dd className="text-text-primary">{selected.invoice ?? "—"}</dd>
                    </dl>
                  </div>
                  {selected.received_by ? (
                    <div className="rounded-xl border border-border-light p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Owner</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">
                          {clientInitials(selected.received_by.name)}
                        </span>
                        <div>
                          <p className="font-medium text-text-primary">{selected.received_by.name}</p>
                          <p className="text-xs text-text-secondary">{selected.received_by.company_name ?? selected.received_by.email}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {selected.notes && !isBlocked(selected) ? (
                    <p className="text-xs text-text-secondary">
                      <span className="font-semibold text-text-primary">Internal: </span>
                      {selected.notes}
                    </p>
                  ) : null}
                  <div className="border-t border-border-light pt-4">
                    {deleteError ? (
                      <p className="mb-2 text-xs font-medium text-red-600" role="alert">
                        {deleteError}
                      </p>
                    ) : null}
                    {deleteConfirm ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-text-secondary">Delete this event?</p>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => void handleDeleteSelected()}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {deleting ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => setDeleteConfirm(false)}
                          className="rounded-lg border border-border-light px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Delete event
                      </button>
                    )}
                    {selected.external_id ? (
                      <p className="mt-2 text-[11px] text-text-secondary">
                        Removes from Google Calendar for {selected.calendar_owner_name ?? selected.calendar_owner_email ?? "this account"}.
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-text-secondary">
                        Removes this event from your calendar in this browser.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">Select a block on the grid to see shipping, deadlines, and meeting context.</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {slotHover ? (
        <div
          className="pointer-events-none fixed z-[190] max-w-[min(calc(100vw-2rem),18rem)] rounded-lg bg-slate-900 px-2.5 py-2 text-xs font-medium leading-snug text-white shadow-xl ring-1 ring-white/10"
          style={{ left: slotHover.x + 14, top: slotHover.y + 14 }}
          role="tooltip"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/70">New event slot</span>
          <span className="mt-0.5 block">{slotHover.label}</span>
          <span className="mt-1 block text-[10px] font-normal text-white/75">Click to create</span>
        </div>
      ) : null}

      {addOpen ? (
        <AddCalendarEventModal
          draft={addDraft}
          onChange={patchAddDraft}
          onSubmit={handleAddSubmit}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {assistantEvent ? (
        <CalendarEventAssistantModal
          event={assistantEvent}
          seedIds={seedEventIds}
          onClose={() => setAssistantEvent(null)}
          onEventUpdated={handleAssistantEventUpdated}
          onRefreshGoogle={onRefreshGoogle}
          onEventDeleted={() => {
            setAssistantEvent(null);
            setSelectedId(null);
            setExtraEvents(readExtraCalendarEvents());
            setHiddenTick((t) => t + 1);
          }}
        />
      ) : null}
    </div>
  );
}
