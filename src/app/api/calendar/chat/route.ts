import { NextResponse } from "next/server";
import { buildCalendarEventContext } from "@/lib/calendar-event-snapshot";
import { calendarChatFallbackReply } from "@/lib/calendar-chat-intent";
import { findLinkedProject } from "@/lib/calendar-project-match";
import { fetchJobsForProject } from "@/lib/data/jobs";
import { fetchProjects } from "@/lib/data/projects";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { isOpenAiConfigured } from "@/lib/openai/env";
import { calendarChatReplyWithOpenAi } from "@/lib/openai/calendar-chat-reply";
import type { CalendarEvent } from "@/lib/types/calendar";
import { createClient } from "@/lib/supabase/server";

export type CalendarChatApiResponse = {
  reply: string;
  propose_update: {
    title: string;
    event_patch?: Record<string, unknown>;
    project_patch?: Record<string, unknown>;
    project_id?: number;
  } | null;
  linked_project_id: number | null;
  link_reason: string | null;
  source: "openai" | "fallback";
};

export async function POST(request: Request) {
  const live = await isLiveBackendEnabled();
  if (live) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    event?: CalendarEvent;
    message?: string;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
    pendingProposalTitles?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  const event = body.event;
  if (!event?.id) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const pendingProposalTitles = Array.isArray(body.pendingProposalTitles)
    ? body.pendingProposalTitles.filter((t): t is string => typeof t === "string")
    : [];

  const projects = await fetchProjects();
  const link = findLinkedProject(event, projects);
  const jobs =
    link != null ? await fetchJobsForProject(link.project.id, link.project) : [];
  const context = buildCalendarEventContext(
    event,
    link?.project ?? null,
    jobs,
    link?.reason ?? null,
  );

  if (isOpenAiConfigured()) {
    try {
      const result = await calendarChatReplyWithOpenAi({
        context,
        message,
        history,
        pendingProposalTitles,
      });
      const res: CalendarChatApiResponse = {
        reply: result.reply,
        propose_update: result.proposeUpdate,
        linked_project_id: link?.project.id ?? null,
        link_reason: link?.reason ?? null,
        source: "openai",
      };
      return NextResponse.json(res);
    } catch (e) {
      console.error("[api/calendar/chat] openai", e);
    }
  }

  const fallback = calendarChatFallbackReply(message, context);
  const res: CalendarChatApiResponse = {
    reply: fallback.reply,
    propose_update: fallback.proposeUpdate,
    linked_project_id: link?.project.id ?? null,
    link_reason: link?.reason ?? null,
    source: "fallback",
  };
  return NextResponse.json(res);
}
