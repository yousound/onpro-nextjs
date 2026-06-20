"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AssistantQuickOpenButton,
  PAGE_HEADER_ASSISTANT_CLASS,
} from "@/components/assistant-quick-open-button";
import { NotificationsPopover } from "@/components/notifications-popover";
import { calendarEventsForDay, dedupeCalendarEvents } from "@/lib/calendar-google";
import { mockCalendarEvents } from "@/lib/mock/calendar-events";
import { mockDocuments } from "@/lib/mock/documents";
import { OverviewAssistant } from "@/components/overview-assistant";
import { useCurrentUser } from "@/components/profile-provider";
import { migrateProjectStatus } from "@/lib/project-status";
import { isClientLiveBackend, isClientMockBackend } from "@/lib/config/backend-mode";
import { buildOverviewDigest, type OverviewFocusItem } from "@/lib/mock/overview-digest";
import type { CalendarEvent } from "@/lib/types/calendar";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import { YourTeamsSection } from "@/components/your-teams-section";

const MOCK_FIRST_NAME = "Jerry";

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatAgendaTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function focusCardStyle(tone: OverviewFocusItem["tone"]): { shell: string; pill: string; pillText: string } {
  if (tone === "warn") {
    return {
      shell: "border-amber-200/90 bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100/80",
      pill: "bg-amber-100 text-amber-950 ring-1 ring-amber-300/60",
      pillText: "Due date passed",
    };
  }
  if (tone === "accent") {
    return {
      shell: "border-violet-200/90 bg-gradient-to-br from-violet-50 to-white ring-1 ring-violet-100/90",
      pill: "bg-violet-100 text-violet-950 ring-1 ring-violet-300/50",
      pillText: "Approval needed",
    };
  }
  return {
    shell: "border-border-light bg-surface-card ring-1 ring-border-light/80",
    pill: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
    pillText: "Action",
  };
}

const IN_PROGRESS_CARDS: {
  kind: "Project" | "Job";
  title: string;
  subtitle: string;
  pct: number;
  next: string;
  href: string;
}[] = [
  {
    kind: "Project",
    title: "Homeward Capsule",
    subtitle: "Fillio Product Design",
    pct: 75,
    next: "Strike-off sign-off",
    href: "/projects/4",
  },
  {
    kind: "Job",
    title: "LNQ + Connect Dots",
    subtitle: "Production lane",
    pct: 40,
    next: "Factory TOP window",
    href: "/production",
  },
  {
    kind: "Project",
    title: "Void Star Tee",
    subtitle: "Void Star Fabrics",
    pct: 60,
    next: "Costing refresh",
    href: "/projects/5",
  },
  {
    kind: "Job",
    title: "Glo Gang — Olive capsule",
    subtitle: "Print / decoration",
    pct: 20,
    next: "Strike-off approvals",
    href: "/projects/1",
  },
];

type InProgressCard = {
  kind: "Project" | "Job";
  title: string;
  subtitle: string;
  pct: number;
  next: string;
  href: string;
};

function liveInProgressCards(
  projects: Project[],
  jobsByProject: Record<number, ProjectJob[]>,
): InProgressCard[] {
  const cards: InProgressCard[] = [];
  for (const p of projects
    .filter((x) => {
      const status = migrateProjectStatus(x.status);
      return status === "Production" || status === "Intake" || status === "Development";
    })
    .slice(0, 4)) {
    const status = migrateProjectStatus(p.status);
    cards.push({
      kind: "Project",
      title: p.name,
      subtitle: p.client.name,
      pct: status === "Production" ? 50 : status === "Development" ? 40 : 25,
      next: p.status_overview?.trim() || "Review milestones",
      href: `/projects/${p.id}`,
    });
  }
  for (const p of projects) {
    const jobs = jobsByProject[p.id] ?? [];
    for (const j of jobs.filter((x) => x.status === "In progress").slice(0, 2)) {
      if (cards.length >= 4) return cards;
      cards.push({
        kind: "Job",
        title: j.name,
        subtitle: p.name,
        pct: 40,
        next: j.subtitle || "Open job",
        href: `/projects/${p.id}?inspectJob=${p.id}:${j.id}`,
      });
    }
  }
  return cards;
}

export function OverviewView({
  liveMode = false,
  projects = [],
  jobsByProject = {},
  calendarEvents: initialCalendarEvents = [],
  todayYmd: initialTodayYmd,
}: {
  liveMode?: boolean;
  projects?: Project[];
  jobsByProject?: Record<number, ProjectJob[]>;
  calendarEvents?: CalendarEvent[];
  todayYmd?: string;
}) {
  const fallbackTodayYmd = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayYmd = initialTodayYmd ?? fallbackTodayYmd;
  const [calendarEvents, setCalendarEvents] = useState(initialCalendarEvents);
  const calendarSeedKeyRef = useRef("");

  useEffect(() => {
    const seedKey = initialCalendarEvents
      .map((e) => `${e.calendar_owner_email ?? ""}:${e.external_id ?? e.id}:${e.start_time}`)
      .join("|");
    if (seedKey === calendarSeedKeyRef.current) return;
    calendarSeedKeyRef.current = seedKey;
    setCalendarEvents(initialCalendarEvents);
  }, [initialCalendarEvents]);

  const refreshCalendar = useCallback(async () => {
    if (!isClientLiveBackend()) return;
    const res = await fetch("/api/calendar/events", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { events?: CalendarEvent[] };
    if (json.events) setCalendarEvents(dedupeCalendarEvents(json.events));
  }, []);

  const didMountRefreshRef = useRef(false);
  useEffect(() => {
    if (!liveMode) return;
    if (!didMountRefreshRef.current) {
      didMountRefreshRef.current = true;
      void refreshCalendar();
    }
    const onFocus = () => void refreshCalendar();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [liveMode, refreshCalendar]);

  const digest = useMemo(() => {
    if (liveMode) {
      const overdue = projects.filter(
        (p) =>
          p.due_date &&
          p.due_date < todayYmd &&
          migrateProjectStatus(p.status) !== "Completed",
      );
      const focusItems: OverviewFocusItem[] = overdue.map((p) => ({
        id: `live-overdue-${p.id}`,
        area: "Projects",
        title: p.name,
        subtitle: p.client.name,
        href: `/projects/${p.id}`,
        tone: "warn",
      }));
      return {
        focusItems,
        overdueProjectCount: overdue.length,
        projectsInFlight: projects.length,
        totalUnreadMessages: 0,
        pendingInvites: 0,
        totalJobs: Object.values(jobsByProject).reduce((n, j) => n + j.length, 0),
        documentsCount: 0,
        calendarNext7d: calendarEvents.filter((e) => e.date >= todayYmd).length,
        jobsInProgressCount: Object.values(jobsByProject)
          .flat()
          .filter((j) => j.status === "In progress").length,
      };
    }
    return buildOverviewDigest(todayYmd);
  }, [liveMode, projects, jobsByProject, todayYmd, calendarEvents]);

  const inProgressCards = useMemo(
    () => (liveMode ? liveInProgressCards(projects, jobsByProject) : IN_PROGRESS_CARDS),
    [liveMode, projects, jobsByProject],
  );

  const { user: profileUser } = useCurrentUser();
  const firstName = isClientMockBackend()
    ? MOCK_FIRST_NAME
    : (profileUser?.firstName ?? "there");

  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const needYou = digest.focusItems.filter((f) => f.tone === "warn" || f.tone === "accent").length;
  const headlineCount = needYou > 0 ? needYou : digest.focusItems.length;

  const showOwnerOnAgenda = useMemo(() => {
    const owners = new Set(
      calendarEvents.map((e) => e.calendar_owner_email).filter(Boolean) as string[],
    );
    return owners.size > 1;
  }, [calendarEvents]);

  const agenda = useMemo(() => {
    if (liveMode) {
      return calendarEventsForDay(calendarEvents, todayYmd).slice(0, 6);
    }
    return [...mockCalendarEvents]
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 4);
  }, [liveMode, calendarEvents, todayYmd]);

  const activity = useMemo(() => {
    if (liveMode) return [];
    return [...mockDocuments]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 3);
  }, [liveMode]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-white">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border-light px-6 py-6 lg:px-10">
          <div className="mx-auto flex max-w-[880px] flex-col gap-6 lg:max-w-none lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {greeting}, {firstName}
              </h1>
              <p className="mt-2 text-base text-text-secondary">Here&apos;s what&apos;s most important today.</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:shrink-0">
              <label className="relative min-w-0 flex-1 sm:max-w-[14rem] lg:max-w-[16rem]">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                  <SearchGlyph />
                </span>
                <input
                  type="search"
                  placeholder="Search…"
                  className="h-10 w-full rounded-xl border border-border-light bg-surface-body/60 py-2 pl-9 pr-3 text-sm text-text-primary outline-none ring-accent/20 placeholder:text-text-secondary/70 focus:border-accent focus:ring-2"
                  aria-label="Search"
                />
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <AssistantQuickOpenButton buttonClassName={PAGE_HEADER_ASSISTANT_CLASS} />
                <NotificationsPopover buttonClassName="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border-light bg-white text-text-secondary shadow-sm transition hover:bg-surface-body" />
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-8 lg:max-w-none lg:flex-row lg:gap-10 lg:px-10 lg:pb-10">
            <div className="min-w-0 flex-1 space-y-8 lg:max-w-[880px]">
              <OverviewAssistant />

              <section>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-text-primary">
                    {headlineCount === 0 ? "Nothing needs you today" : `${headlineCount} things need you today`}
                  </h2>
                  {headlineCount > 0 ? (
                    <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-bold text-accent">{headlineCount}</span>
                  ) : null}
                </div>
                <ul className="mt-4 space-y-4">
                  {digest.focusItems.length === 0 ? (
                    <li className="rounded-2xl border border-dashed border-border-light bg-surface-body/30 px-4 py-8 text-center text-sm text-text-secondary">
                      {liveMode
                        ? "Nothing overdue in your live projects."
                        : "Nothing queued in the mock digest."}
                    </li>
                  ) : (
                    digest.focusItems.map((f) => {
                      const st = focusCardStyle(f.tone);
                      const dueLabel =
                        f.tone === "warn" ? "Overdue — review milestones" : f.tone === "accent" ? "Due today" : "Open";
                      return (
                        <li key={f.id}>
                          <div className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${st.shell}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-3">
                                <span
                                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${
                                    f.tone === "warn" ? "bg-amber-200/80 text-amber-950" : "bg-violet-200/80 text-violet-900"
                                  }`}
                                  aria-hidden
                                >
                                  {f.tone === "warn" ? "!" : "✓"}
                                </span>
                                <div className="min-w-0">
                                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.pill}`}>
                                    {st.pillText}
                                  </span>
                                  <p className="mt-2 font-semibold text-text-primary">{f.title}</p>
                                  <p className="mt-0.5 text-sm text-text-secondary">{f.subtitle}</p>
                                  <p className="mt-1 text-xs font-medium text-text-secondary">{dueLabel}</p>
                                </div>
                              </div>
                              <Link
                                href={f.href}
                                className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                              >
                                Open
                              </Link>
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>

              <section>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-text-primary">In progress</h2>
                  <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                    {inProgressCards.length}
                  </span>
                </div>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {inProgressCards.length === 0 ? (
                    <li className="col-span-full rounded-2xl border border-dashed border-border-light bg-surface-body/30 px-4 py-8 text-center text-sm text-text-secondary">
                      {liveMode ? "No in-progress projects or jobs in live data." : null}
                    </li>
                  ) : null}
                  {inProgressCards.map((c) => (
                    <li key={c.title}>
                      <Link
                        href={c.href}
                        className="flex h-full flex-col rounded-2xl border border-border-light bg-surface-card p-4 shadow-sm transition hover:border-accent/25 hover:shadow-md"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">{c.kind}</span>
                        <p className="mt-1 font-semibold text-text-primary">{c.title}</p>
                        <p className="text-xs text-text-secondary">{c.subtitle}</p>
                        <div className="mt-3">
                          <div className="flex justify-between text-[11px] font-medium text-text-secondary">
                            <span>Progress</span>
                            <span className="tabular-nums text-text-primary">{c.pct}%</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-accent"
                              style={{ width: `${c.pct}%` }}
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-text-secondary">
                          Next: <span className="font-medium text-text-primary">{c.next}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>

              {liveMode ? <YourTeamsSection variant="overview" /> : null}
            </div>

            <aside className="shrink-0 space-y-8 border-t border-border-light pt-8 lg:w-[min(100%,320px)] lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <section>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">Today&apos;s agenda</h3>
                  <div className="flex items-center gap-2">
                    {liveMode ? (
                      <button
                        type="button"
                        onClick={() => void refreshCalendar()}
                        className="text-xs font-semibold text-text-secondary hover:text-accent"
                      >
                        Sync
                      </button>
                    ) : null}
                    <Link href="/calendar" className="text-xs font-semibold text-accent hover:underline">
                      View calendar
                    </Link>
                  </div>
                </div>
                {liveMode && agenda.length === 0 ? (
                  <p className="mt-3 text-sm text-text-secondary">
                    No events today. Team calendars sync when each person connects Gmail in Mailroom.
                  </p>
                ) : null}
                <ol className="relative mt-4 space-y-0 border-l border-slate-200 pl-5">
                  {agenda.map((ev, index) => (
                    <li key={`${ev.calendar_owner_email ?? ""}-${ev.external_id ?? ev.id}-${index}`} className="relative pb-6 last:pb-0">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-accent shadow ring-1 ring-slate-200" />
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        {formatAgendaTime(ev.start_time)}
                        {showOwnerOnAgenda && ev.calendar_owner_name ? (
                          <span className="normal-case text-accent"> · {ev.calendar_owner_name}</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-text-primary">{ev.name}</p>
                    </li>
                  ))}
                </ol>
                <Link href="/calendar" className="mt-2 inline-block text-xs font-semibold text-accent hover:underline">
                  See full day →
                </Link>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-text-primary">Recent activity</h3>
                <ul className="mt-3 space-y-3">
                  {activity.map((doc) => (
                    <li key={doc.id} className="text-sm">
                      <Link href="/documents" className="font-medium text-accent hover:underline">
                        {doc.name}
                      </Link>
                      <p className="text-xs text-text-secondary">
                        {doc.kind} · {doc.project_name}
                      </p>
                    </li>
                  ))}
                </ul>
                <Link href="/documents" className="mt-3 inline-block text-xs font-semibold text-accent hover:underline">
                  View all activity →
                </Link>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

