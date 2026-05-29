"use client";

import Link from "next/link";
import { useMemo } from "react";
import { NotificationsPopover } from "@/components/notifications-popover";
import { mockCalendarEvents } from "@/lib/mock/calendar-events";
import { mockDocuments } from "@/lib/mock/documents";
import { OverviewAssistant } from "@/components/overview-assistant";
import { buildOverviewDigest, type OverviewFocusItem } from "@/lib/mock/overview-digest";

const MOCK_USER = {
  firstName: "Jerry",
  displayName: "Jerry M",
  org: "Fillio Design",
  avatarSrc: "/user-avatar-demo.png",
};

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

export function OverviewView() {
  const digest = useMemo(() => {
    const ymd = new Date().toISOString().slice(0, 10);
    return buildOverviewDigest(ymd);
  }, []);

  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const needYou = digest.focusItems.filter((f) => f.tone === "warn" || f.tone === "accent").length;
  const headlineCount = needYou > 0 ? needYou : digest.focusItems.length;

  const agenda = useMemo(() => {
    return [...mockCalendarEvents]
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 4);
  }, []);

  const activity = useMemo(() => {
    return [...mockDocuments]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 3);
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-white">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border-light px-6 py-6 lg:px-10">
          <div className="mx-auto flex max-w-[880px] flex-col gap-6 lg:max-w-none lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
                {greeting}, {MOCK_USER.firstName}
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
                      Nothing queued in the mock digest.
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
                    {IN_PROGRESS_CARDS.length}
                  </span>
                </div>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {IN_PROGRESS_CARDS.map((c) => (
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
            </div>

            <aside className="shrink-0 space-y-8 border-t border-border-light pt-8 lg:w-[min(100%,320px)] lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <section>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">Today&apos;s agenda</h3>
                  <Link href="/calendar" className="text-xs font-semibold text-accent hover:underline">
                    View calendar
                  </Link>
                </div>
                <ol className="relative mt-4 space-y-0 border-l border-slate-200 pl-5">
                  {agenda.map((ev) => (
                    <li key={ev.id} className="relative pb-6 last:pb-0">
                      <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-white bg-accent shadow ring-1 ring-slate-200" />
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        {formatAgendaTime(ev.start_time)}
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

