import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import {
  applyPreferenceUpdatesFromMessage,
  prependAcknowledgment,
} from "@/lib/assistant/prefs";
import { isOpenAiConfigured } from "@/lib/openai/env";
import { assistantReplyWithOpenAi } from "@/lib/openai/assistant-reply";
import { invalidateBriefingCache } from "@/lib/server/assistant-briefing-cache";
import {
  getOrBuildAssistantOpsSnapshot,
  invalidateAssistantOpsSnapshotCache,
} from "@/lib/server/assistant-ops-snapshot-cache";
import { resolveAssistantUserName } from "@/lib/server/assistant-user-name";
import { mergeClientJobsIntoPromptContext } from "@/lib/assistant/client-jobs-overlay";
import { liveAssistantReply } from "@/lib/server/live-briefing";
import {
  persistAssistantPrefsIfLive,
  resolveAssistantPrefsForRequest,
} from "@/lib/server/resolve-assistant-prefs";
import {
  assistantReplyPlain,
  mockAssistantReply,
} from "@/lib/mock/overview-briefing";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const live = await isLiveBackendEnabled();
  const supabase = live ? await createClient() : null;
  let userId: string | undefined;

  if (live && supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = user.id;
  }

  let body: {
    message?: string;
    userName?: string;
    todayYmd?: string;
    history?: Array<{ role: "user" | "assistant"; text: string }>;
    assistantPrefs?: unknown;
    clientJobs?: Array<{
      id: string;
      project_id: number;
      project_name: string;
      name: string;
      job_number: string | null;
      style_number: string;
    }>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const userName =
    live && supabase
      ? await resolveAssistantUserName(supabase, body.userName)
      : body.userName?.trim() || "there";
  const todayYmd = body.todayYmd?.trim() || new Date().toISOString().slice(0, 10);
  const history = Array.isArray(body.history) ? body.history : [];

  let assistantPrefs = await resolveAssistantPrefsForRequest(
    supabase,
    userId,
    body.assistantPrefs,
  );

  const prefUpdate = applyPreferenceUpdatesFromMessage(message, assistantPrefs);
  assistantPrefs = prefUpdate.prefs;
  if (prefUpdate.changed) {
    await persistAssistantPrefsIfLive(supabase, userId, assistantPrefs);
    invalidateAssistantOpsSnapshotCache(userId, todayYmd, assistantPrefs);
    invalidateBriefingCache(userId, todayYmd, assistantPrefs);
  }

  const snapshot = await getOrBuildAssistantOpsSnapshot(
    userName,
    todayYmd,
    assistantPrefs,
    userId,
  );

  const clientJobs = Array.isArray(body.clientJobs) ? body.clientJobs : [];
  const snapshotForReply =
    clientJobs.length > 0
      ? {
          ...snapshot,
          promptContext: mergeClientJobsIntoPromptContext(snapshot.promptContext, clientJobs),
        }
      : snapshot;

  if (isOpenAiConfigured()) {
    try {
      const reply = await assistantReplyWithOpenAi(message, history, snapshotForReply);
      const text = prependAcknowledgment(assistantReplyPlain(reply), prefUpdate.acknowledgment);
      return NextResponse.json({
        reply,
        text,
        assistantPrefs,
        prefsUpdated: prefUpdate.changed,
        source: "openai",
      });
    } catch (e) {
      console.warn("[api/assistant/chat] OpenAI failed", e);
      if (live) {
        const reply = liveAssistantReply(message, snapshotForReply);
        const text = prependAcknowledgment(assistantReplyPlain(reply), prefUpdate.acknowledgment);
        return NextResponse.json({
          reply,
          text,
          assistantPrefs,
          prefsUpdated: prefUpdate.changed,
          source: "live",
          openaiError: e instanceof Error ? e.message : "OpenAI request failed",
        });
      }
    }
  }

  if (live) {
    const reply = liveAssistantReply(message, snapshotForReply);
    const text = prependAcknowledgment(assistantReplyPlain(reply), prefUpdate.acknowledgment);
    return NextResponse.json({
      reply,
      text,
      assistantPrefs,
      prefsUpdated: prefUpdate.changed,
      source: "live",
    });
  }

  const reply = mockAssistantReply(message, snapshotForReply);
  const text = prependAcknowledgment(assistantReplyPlain(reply), prefUpdate.acknowledgment);
  return NextResponse.json({
    reply,
    text,
    assistantPrefs,
    prefsUpdated: prefUpdate.changed,
    source: "mock",
  });
}
