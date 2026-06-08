import { fetchWorkspaceCalendarEvents } from "@/lib/server/fetch-workspace-calendar-events";
import type { CalendarEvent } from "@/lib/types/calendar";

/** Server-only: Google Calendar for workspace team (connected Gmail accounts). */
export async function fetchLiveCalendarEventsForUser(userId: string): Promise<CalendarEvent[]> {
  const { events } = await fetchWorkspaceCalendarEvents(userId);
  return events;
}
