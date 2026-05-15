"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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
} from "@/lib/calendar-utils";
import { clientInitials, formatShortDate } from "@/lib/format";
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

export function CalendarDayView({ initialEvents }: { initialEvents: CalendarEvent[] }) {
  const defaultYmd = useMemo(() => {
    const demo = initialEvents.find((e) => e.date === "2026-05-14");
    if (demo) return "2026-05-14";
    const merged = initialEvents;
    const sorted = [...new Set(merged.map((e) => e.date))].sort();
    return sorted[0] ?? localYmd(new Date());
  }, [initialEvents]);

  const [ymd, setYmd] = useState(defaultYmd);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(0);
  const [extraEvents, setExtraEvents] = useState<CalendarEvent[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addType, setAddType] = useState<NonNullable<CalendarEvent["event_type"]>>("meeting");
  const [addDept, setAddDept] = useState("Receiving");
  const [addDate, setAddDate] = useState(defaultYmd);
  const [addStart, setAddStart] = useState("10:00");
  const [addEnd, setAddEnd] = useState("11:00");
  const [addDesc, setAddDesc] = useState("");
  const [addPo, setAddPo] = useState("");
  const [addBlock, setAddBlock] = useState(false);
  const [slotHover, setSlotHover] = useState<{ x: number; y: number; label: string } | null>(null);

  useEffect(() => {
    const saved = readMockLs<CalendarEvent[]>(MOCK_LS.calendarEvents);
    if (saved?.length) setExtraEvents(saved);
  }, []);

  const allEvents = useMemo(() => [...initialEvents, ...extraEvents], [initialEvents, extraEvents]);

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

  const selected = useMemo(
    () => dayEvents.find((e) => e.id === selectedId) ?? null,
    [dayEvents, selectedId],
  );

  useEffect(() => {
    if (selectedId != null && !dayEvents.some((e) => e.id === selectedId)) {
      setSelectedId(null);
    }
  }, [dayEvents, selectedId]);

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
      id: Date.now(),
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
              <p className="truncate text-sm font-semibold text-text-primary">{formatCalendarDayHeading(ymd)}</p>
              <p className="text-xs text-text-secondary">{formatShortDate(ymd)} · Operations lanes</p>
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

        <div className="sticky top-0 z-10 flex shrink-0 gap-2 overflow-x-auto border-b border-border-light bg-white px-3 py-2.5 sm:px-4 [scrollbar-width:thin]">
          {columns.map((col) => {
            const count = dayEvents.filter((e) => columnForEvent(e) === col).length;
            return (
              <div
                key={col}
                className="flex min-w-[7.5rem] max-w-[10rem] shrink-0 items-center gap-2 rounded-xl border border-border-light bg-white px-2.5 py-2 shadow-sm sm:min-w-[8.5rem]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {clientInitials(col)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{col}</p>
                  <p className="text-[11px] text-text-secondary">{count} slot{count === 1 ? "" : "s"}</p>
                </div>
              </div>
            );
          })}
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
                      {colEvents.map((ev) => {
                        const { top, height } = layoutEvent(ev);
                        const blocked = isBlocked(ev);
                        const isSel = selectedId === ev.id;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            title={`${formatShortDate(`${ev.date}T12:00:00`)} · ${formatTimeRange(ev.start_time, ev.end_time)} · ${ev.name}`}
                            onClick={() => setSelectedId(ev.id)}
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
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md p-1 text-text-secondary hover:bg-slate-100 hover:text-text-primary"
                aria-label="Close details"
              >
                ×
              </button>
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
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAddOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cal-add-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-light bg-white p-5 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="cal-add-title" className="text-lg font-semibold text-text-primary">
              Add event (mock)
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Click the schedule grid to prefill lane and time. Saved in this browser — {MOCK_LS.calendarEvents}
            </p>
            <form className="mt-4 space-y-3" onSubmit={handleAddSubmit}>
              <label className="block text-xs font-medium text-text-secondary">
                Title
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="e.g. TOP review — Void Star"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-text-secondary">
                  Type
                  <select
                    className="mt-1 w-full rounded-lg border border-border-light px-2 py-2 text-sm text-text-primary"
                    value={addType}
                    disabled={addBlock}
                    onChange={(e) => setAddType(e.target.value as NonNullable<CalendarEvent["event_type"]>)}
                  >
                    <option value="shipping">Shipping</option>
                    <option value="meeting">Meeting</option>
                    <option value="deadline">Deadline</option>
                    <option value="sample_review">Sample review</option>
                    <option value="production">Production</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-text-secondary">
                  Lane
                  <select
                    className="mt-1 w-full rounded-lg border border-border-light px-2 py-2 text-sm text-text-primary"
                    value={addDept}
                    onChange={(e) => setAddDept(e.target.value)}
                  >
                    {CALENDAR_COLUMN_ORDER.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-medium text-text-secondary">
                Day
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-medium text-text-secondary">
                  Start
                  <input
                    type="time"
                    required
                    className="mt-1 w-full rounded-lg border border-border-light px-2 py-2 text-sm text-text-primary"
                    value={addStart}
                    onChange={(e) => setAddStart(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium text-text-secondary">
                  End
                  <input
                    type="time"
                    required
                    className="mt-1 w-full rounded-lg border border-border-light px-2 py-2 text-sm text-text-primary"
                    value={addEnd}
                    onChange={(e) => setAddEnd(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-text-secondary">
                PO (optional)
                <input
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={addPo}
                  onChange={(e) => setAddPo(e.target.value)}
                  placeholder="PO-…"
                />
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                Description
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" checked={addBlock} onChange={(e) => setAddBlock(e.target.checked)} className="rounded border-border-light" />
                Blocked lane (striped)
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-slate-100" onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Save to calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
