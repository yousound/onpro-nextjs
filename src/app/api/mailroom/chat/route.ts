import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { normalizeEmailBody } from "@/lib/email-body";
import { detectMailroomChatIntent } from "@/lib/mailroom/chat-intent";
import { isOpenAiConfigured } from "@/lib/openai/env";
import { mailroomChatReplyWithOpenAi } from "@/lib/openai/mailroom-chat-reply";
import { getCachedMailroomSummarize } from "@/lib/server/mailroom-summarize-cache";
import { mailroomThreadContextForPrompt } from "@/lib/server/assistant-prompt-trim";
import {
  getLatestMailroomThreadScan,
  getMailroomThreadScan,
} from "@/lib/supabase/mailroom-thread-scans";
import type { AgentSuggestionKind, EmailThread } from "@/lib/types/agent";
import { createClient } from "@/lib/supabase/server";

export type MailroomChatApiResponse = {
  reply: string;
  propose_suggestion: {
    kind: AgentSuggestionKind;
    title: string;
    payload: Record<string, unknown>;
  } | null;
  apply_all?: boolean;
  source: "openai" | "fallback";
};

function normalizeThreadBodies(thread: EmailThread): EmailThread {
  return {
    ...thread,
    messages: thread.messages.map((m) => ({ ...m, body: normalizeEmailBody(m.body) })),
  };
}

const SUMMARIZE_FIRST_REPLY =
  "I haven't read this thread yet — or new emails arrived since the last scan. Tap **Regenerate summary** (or **Summarize this thread**) so I can read the latest messages, then ask me questions or request drafts.";

export async function POST(request: Request) {
  const live = await isLiveBackendEnabled();
  const supabase = live ? await createClient() : null;
  let userId = "local";

  if (live && supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;
  }

  let body: {
    thread?: EmailThread;
    message?: string;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
    pendingSuggestionTitles?: string[];
    /** UI-held summary when server scan cache missed (e.g. fingerprint drift). */
    scanSummary?: string;
    workspaceContext?: string;
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
  const thread = body.thread;
  if (!thread?.id) {
    return NextResponse.json({ error: "Missing thread" }, { status: 400 });
  }

  const normalizedThread = normalizeThreadBodies(thread);
  const history = Array.isArray(body.history) ? body.history : [];
  const pendingSuggestionTitles = Array.isArray(body.pendingSuggestionTitles)
    ? body.pendingSuggestionTitles.filter((t): t is string => typeof t === "string")
    : [];

  const clientSummary = body.scanSummary?.trim() ?? "";

  const cached = await getCachedMailroomSummarize(userId, normalizedThread, { live });
  let scanRow =
    !cached && live && userId !== "local"
      ? await getMailroomThreadScan(userId, normalizedThread)
      : null;
  if (!cached && !scanRow && live && userId !== "local") {
    scanRow = await getLatestMailroomThreadScan(userId, normalizedThread.id);
  }

  let scanSummary = cached?.summary ?? scanRow?.summary ?? clientSummary ?? "";
  let scanContext = cached?.scanContext ?? scanRow?.scan_context ?? "";

  if (!scanContext.trim()) {
    scanContext = mailroomThreadContextForPrompt(normalizedThread);
  }
  if (!scanSummary.trim() && scanContext.trim()) {
    scanSummary =
      "Thread was summarized in the workspace; use the email thread below for detail.";
  }

  if (!scanSummary.trim()) {
    const intent = detectMailroomChatIntent(message);
    const response: MailroomChatApiResponse = {
      reply: SUMMARIZE_FIRST_REPLY,
      propose_suggestion:
        intent.kind && !intent.applyAll
          ? {
              kind: intent.kind,
              title: suggestionTitleForKind(intent.kind, normalizedThread),
              payload: normalizedThread.related ?? {},
            }
          : null,
      apply_all: intent.applyAll,
      source: "fallback",
    };
    return NextResponse.json(response);
  }

  if (isOpenAiConfigured()) {
    try {
      const { reply, proposeSuggestion } = await mailroomChatReplyWithOpenAi({
        threadSubject: normalizedThread.subject,
        threadId: normalizedThread.id,
        scanSummary,
        scanContext,
        workspaceContext: body.workspaceContext?.trim(),
        message,
        history,
        pendingSuggestionTitles,
      });
      const response: MailroomChatApiResponse = {
        reply,
        propose_suggestion: proposeSuggestion,
        source: "openai",
      };
      return NextResponse.json(response);
    } catch (e) {
      console.warn("[api/mailroom/chat] OpenAI failed, using fallback", e);
    }
  }

  const intent = detectMailroomChatIntent(message);

  const response: MailroomChatApiResponse = {
    reply: intent.reply,
    propose_suggestion:
      intent.kind && !intent.applyAll
        ? {
            kind: intent.kind,
            title: suggestionTitleForKind(intent.kind, normalizedThread),
            payload: normalizedThread.related ?? {},
          }
        : null,
    apply_all: intent.applyAll,
    source: "fallback",
  };

  return NextResponse.json(response);
}

function suggestionTitleForKind(kind: AgentSuggestionKind, thread: EmailThread): string {
  const titles: Record<AgentSuggestionKind, string> = {
    create_project: `Create project from "${thread.subject}"`,
    update_project: "Update linked project name or details",
    create_order: "Create production order for this project",
    create_job: "Add a job draft to this project",
    add_vendor_quote: `Capture vendor quote from ${thread.related?.vendor ?? "vendor"}`,
    add_costing_line: "Add a costing line",
    generate_estimate: "Generate an estimate",
    create_invoice: "Draft an invoice",
    update_client_po: "Set client PO from this thread",
    update_sample_milestone: "Update a sample milestone",
    log_packing_list: "Update the packing list variant",
    team_note: "Add a task for the team",
  };
  return titles[kind];
}
