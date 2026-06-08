"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { CalendarDayView } from "@/components/calendar-day-view";
import { CalendarConnectHero } from "@/components/calendar-connect-hero";
import { dedupeCalendarEvents } from "@/lib/calendar-google";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { sectionCoverHref, shouldShowSectionCover } from "@/lib/section-cover";
import { useStripSectionCoverWhenPopulated } from "@/lib/section-cover-hooks";
import { readExtraCalendarEvents } from "@/lib/calendar-events-store";
import { MOCK_LS, readMockLs } from "@/lib/mock-local";
import type { CalendarEvent } from "@/lib/types/calendar";

async function fetchGoogleCalendarEvents(): Promise<CalendarEvent[]> {
  const res = await fetch("/api/calendar/events", { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json()) as { events?: CalendarEvent[] };
  return json.events ?? [];
}

function CalendarPageInner({
  initialEvents,
  initialYmd,
  gmailConnected = false,
  gmailEmail = null,
}: {
  initialEvents: CalendarEvent[];
  initialYmd: string;
  gmailConnected?: boolean;
  gmailEmail?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCoverPage = searchParams.get("cover") === "1";
  const [forceBoard, setForceBoard] = useState(false);
  const [addOpenSignal, setAddOpenSignal] = useState(0);
  const live = isClientLiveBackend();

  const [liveEvents, setLiveEvents] = useState(() => dedupeCalendarEvents(initialEvents));
  const [refreshing, setRefreshing] = useState(false);

  const mockExtras = useMemo(() => {
    const overlays = readExtraCalendarEvents();
    if (live) return overlays;
    return readMockLs<CalendarEvent[]>(MOCK_LS.calendarEvents) ?? overlays;
  }, [live]);

  const boardEvents = useMemo(
    () => dedupeCalendarEvents([...liveEvents, ...mockExtras]),
    [liveEvents, mockExtras],
  );

  const eventCount = boardEvents.length;
  const effectiveCount = forceBoard ? Math.max(eventCount, 1) : eventCount;
  const showHero = shouldShowSectionCover(showCoverPage, effectiveCount);
  useStripSectionCoverWhenPopulated("/calendar", searchParams, eventCount);

  const refreshGoogle = useCallback(async () => {
    if (!live) return;
    setRefreshing(true);
    try {
      const events = await fetchGoogleCalendarEvents();
      setLiveEvents(dedupeCalendarEvents(events));
    } finally {
      setRefreshing(false);
    }
  }, [live]);

  useEffect(() => {
    setLiveEvents(dedupeCalendarEvents(initialEvents));
  }, [initialEvents]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;

    const run = async () => {
      const events = await fetchGoogleCalendarEvents();
      if (!cancelled) setLiveEvents(dedupeCalendarEvents(events));
    };

    void run();
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [live]);

  const calendarHref = (cover: boolean) => sectionCoverHref("/calendar", searchParams, cover);
  const openCoverPage = () => router.push(calendarHref(true));
  const openCalendar = () => router.push(calendarHref(false));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Calendar"
          onInfoClick={openCoverPage}
          infoLabel="About Calendar"
        />
      </div>
      {showHero ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <CalendarConnectHero
            onAddEvent={() => {
              setForceBoard(true);
              openCalendar();
              setAddOpenSignal((n) => n + 1);
            }}
            gmailConnected={gmailConnected}
            gmailEmail={gmailEmail}
          />
          {live && !gmailConnected ? (
            <p className="px-6 pb-8 text-center text-sm text-text-secondary">
              <Link href="/mailroom" className="font-semibold text-accent hover:underline">
                Connect Gmail in Mailroom
              </Link>{" "}
              to import your Google Calendar here.
            </p>
          ) : null}
        </div>
      ) : (
        <CalendarDayView
          initialEvents={boardEvents}
          initialYmd={initialYmd}
          openAddSignal={addOpenSignal}
          onRefreshGoogle={live && gmailConnected ? () => void refreshGoogle() : undefined}
          refreshingGoogle={refreshing}
        />
      )}
    </div>
  );
}

export function CalendarPageContent({
  initialEvents,
  initialYmd,
  gmailConnected,
  gmailEmail,
}: {
  initialEvents: CalendarEvent[];
  initialYmd: string;
  gmailConnected?: boolean;
  gmailEmail?: string | null;
}) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading calendar…</div>}>
      <CalendarPageInner
        initialEvents={initialEvents}
        initialYmd={initialYmd}
        gmailConnected={gmailConnected}
        gmailEmail={gmailEmail}
      />
    </Suspense>
  );
}
