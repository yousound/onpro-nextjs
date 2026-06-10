import type { CalendarChatApiResponse } from "@/app/api/calendar/chat/route";
import type { CalendarEvent } from "@/lib/types/calendar";

export type CalendarChatResponse = CalendarChatApiResponse;

export async function sendCalendarChatViaApi(opts: {
  event: CalendarEvent;
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  pendingProposalTitles: string[];
}): Promise<CalendarChatResponse> {
  const res = await fetch("/api/calendar/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<CalendarChatResponse>;
}

export async function deleteCalendarEventViaApi(ev: CalendarEvent): Promise<void> {
  const externalId = ev.external_id?.trim();
  if (!externalId) {
    throw new Error("This event cannot be deleted from Google Calendar.");
  }
  const res = await fetch("/api/calendar/events", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      external_id: externalId,
      owner_user_id: ev.calendar_owner_user_id ?? undefined,
      owner_email: ev.calendar_owner_email ?? undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string; message?: string }).error ?? (err as { message?: string }).message ?? res.statusText);
  }
}
