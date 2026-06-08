import { googleEventNumericId } from "@/lib/calendar-google";
import type { CalendarEvent, CalendarEventType } from "@/lib/types/calendar";

type GoogleCalendarItem = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
};

function localYmdFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inferEventType(summary: string, description: string): CalendarEventType {
  const text = `${summary} ${description}`.toLowerCase();
  if (text.includes("ship") || text.includes("fedex") || text.includes("receiving")) return "shipping";
  if (text.includes("sample")) return "sample_review";
  if (text.includes("production") || text.includes("floor")) return "production";
  if (text.includes("deadline") || text.includes("due")) return "deadline";
  if (text.includes("meeting") || text.includes("standup") || text.includes("sync")) return "meeting";
  return "other";
}

export function mapGoogleEvent(
  raw: GoogleCalendarItem,
  owner?: { userId: string; email: string; name: string },
): CalendarEvent | null {
  const id = raw.id?.trim();
  const summary = raw.summary?.trim() || "(No title)";
  const allDayStart = raw.start?.date?.trim();
  const allDayEnd = raw.end?.date?.trim();
  const startIso =
    raw.start?.dateTime ??
    (allDayStart ? `${allDayStart}T08:00:00` : null);
  const endIso =
    raw.end?.dateTime ??
    (allDayEnd ? `${allDayEnd}T17:00:00` : allDayStart ? `${allDayStart}T17:00:00` : null);
  if (!id || !startIso) return null;

  const end = endIso ?? startIso;
  const description = [raw.description?.trim(), raw.location?.trim()].filter(Boolean).join("\n") || null;
  const dateYmd = allDayStart ?? localYmdFromIso(startIso);

  return {
    id: googleEventNumericId(id),
    name: summary,
    description,
    date: dateYmd,
    start_time: startIso,
    end_time: end,
    event_type: inferEventType(summary, description ?? ""),
    delivery_by: null,
    shipped_from: null,
    shipped_to: null,
    type_of_product: null,
    link_to_client: null,
    po: null,
    invoice: null,
    received_by: null,
    department: null,
    notes: raw.location?.trim() ? `Location: ${raw.location.trim()}` : "Google Calendar",
    receiving_options: null,
  };
}

/** Primary calendar events for a Google account (requires calendar.readonly scope). */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  owner?: { userId: string; email: string; name: string },
): Promise<CalendarEvent[]> {
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString();
  const timeMax = new Date(now.getFullYear(), now.getMonth() + 6, 0, 23, 59, 59).toISOString();

  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeMin,
    timeMax,
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar list failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as { items?: GoogleCalendarItem[] };
  const events: CalendarEvent[] = [];
  for (const item of json.items ?? []) {
    const mapped = mapGoogleEvent(item, owner);
    if (mapped) events.push(mapped);
  }
  return events;
}
