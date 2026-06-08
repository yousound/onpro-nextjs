import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { emailBodyPreview, normalizeEmailBody } from "@/lib/email-body";
import { enrichWorkflowProjectNaming, workflowToSuggestions } from "@/lib/mailroom/workflow-utils";
import { isOpenAiConfigured } from "@/lib/openai/env";
import { summarizeThreadWithOpenAi } from "@/lib/openai/summarize-thread";
import { suggestionsForThread, workflowForThread } from "@/lib/mock/email-threads";
import { mailroomThreadContextForPrompt } from "@/lib/server/assistant-prompt-trim";
import {
  deleteCachedMailroomSummarize,
  getCachedMailroomSummarize,
  setCachedMailroomSummarize,
} from "@/lib/server/mailroom-summarize-cache";
import { createClient } from "@/lib/supabase/server";
import type { EmailThread } from "@/lib/types/agent";

function normalizeThreadBodies(thread: EmailThread): EmailThread {
  return {
    ...thread,
    messages: thread.messages.map((m) => ({ ...m, body: normalizeEmailBody(m.body) })),
  };
}

function summarizeThreadMock(thread: EmailThread): string {
  const last = thread.messages[thread.messages.length - 1];
  const preview = last ? emailBodyPreview(last.body, 200) : "";
  return `Thread “${thread.subject}” — ${thread.messages.length} message(s). Latest: ${preview}`;
}

export async function POST(request: Request) {
  const live = await isLiveBackendEnabled();
  const supabase = live ? await createClient() : null;
  let userId = "local";

  if (live && supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  let body: { thread?: EmailThread; forceRegenerate?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const thread = body.thread;
  if (!thread?.id) {
    return NextResponse.json({ error: "Missing thread" }, { status: 400 });
  }

  const normalizedThread = normalizeThreadBodies(thread);
  const forceRegenerate = body.forceRegenerate === true;

  if (!forceRegenerate) {
    const cached = await getCachedMailroomSummarize(userId, normalizedThread, { live });
    if (cached) {
      return NextResponse.json({
        summary: cached.summary,
        suggestions: cached.suggestions,
        workflow: cached.workflow,
        project_id: cached.project_id,
        source: "openai",
        cached: true,
      });
    }
  }

  if (isOpenAiConfigured()) {
    try {
      const { summary, suggestions, workflow: rawWorkflow } =
        await summarizeThreadWithOpenAi(normalizedThread);
      const workflow = rawWorkflow
        ? enrichWorkflowProjectNaming(rawWorkflow, normalizedThread.subject, summary)
        : null;
      const scanContext = mailroomThreadContextForPrompt(normalizedThread);
      const payload = {
        summary,
        suggestions: workflow ? workflowToSuggestions(workflow) : suggestions,
        workflow,
        project_id: thread.related?.project_id ?? null,
        scanContext,
      };
      await setCachedMailroomSummarize(userId, normalizedThread, payload, { live });
      return NextResponse.json({
        ...payload,
        source: "openai",
      });
    } catch (e) {
      console.error("[api/mailroom/summarize] OpenAI failed", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "OpenAI request failed" },
        { status: 502 },
      );
    }
  }

  if (live) {
    return NextResponse.json({
      summary: summarizeThreadMock(normalizedThread),
      suggestions: [],
      workflow: null,
      project_id: normalizedThread.related?.project_id ?? null,
      source: "live",
    });
  }

  const summary = summarizeThreadMock(normalizedThread);
  const workflow = workflowForThread(normalizedThread);
  const suggestions = workflow ? workflowToSuggestions(workflow) : suggestionsForThread(normalizedThread);

  return NextResponse.json({
    summary,
    suggestions,
    workflow,
    project_id: thread.related?.project_id ?? null,
    source: "mock",
  });
}

export async function DELETE(request: Request) {
  const live = await isLiveBackendEnabled();
  let userId = "local";

  if (live) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  let body: { thread?: EmailThread };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const thread = body.thread;
  if (!thread?.id) {
    return NextResponse.json({ error: "Missing thread" }, { status: 400 });
  }

  await deleteCachedMailroomSummarize(userId, thread, { live });
  return NextResponse.json({ ok: true });
}
