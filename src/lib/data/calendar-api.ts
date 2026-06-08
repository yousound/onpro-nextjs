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
