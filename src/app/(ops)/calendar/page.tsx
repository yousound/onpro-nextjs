import { CalendarPageContent } from "@/components/calendar-page-content";
import { calendarTodayYmd, dedupeCalendarEvents } from "@/lib/calendar-google";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { getCalendarEvents } from "@/lib/mock/calendar-events";
import { fetchLiveCalendarEventsForUser } from "@/lib/server/fetch-live-calendar-events";
import { getGmailConnectionForUser } from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";

export default async function CalendarPage() {
  const live = await isLiveBackendEnabled();
  const initialYmd = calendarTodayYmd();

  if (!live) {
    return (
      <CalendarPageContent initialEvents={getCalendarEvents()} initialYmd={initialYmd} />
    );
  }

  let events: Awaited<ReturnType<typeof fetchLiveCalendarEventsForUser>> = [];
  let gmailConnected = false;
  let gmailEmail: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const connection = await getGmailConnectionForUser(user.id);
      gmailConnected = Boolean(connection);
      gmailEmail = connection?.email ?? null;
      if (connection) {
        events = await fetchLiveCalendarEventsForUser(user.id);
      }
    }
  } catch (e) {
    console.error("[calendar/page]", e);
  }

  return (
    <CalendarPageContent
      initialEvents={dedupeCalendarEvents(events)}
      initialYmd={initialYmd}
      gmailConnected={gmailConnected}
      gmailEmail={gmailEmail}
    />
  );
}
