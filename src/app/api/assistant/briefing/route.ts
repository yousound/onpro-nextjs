import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { isOpenAiConfigured } from "@/lib/openai/env";
import { overnightBriefingWithOpenAi } from "@/lib/openai/assistant-briefing";
import {
  getCachedBriefing,
  setCachedBriefing,
} from "@/lib/server/assistant-briefing-cache";
import { getOrBuildAssistantOpsSnapshot } from "@/lib/server/assistant-ops-snapshot-cache";
import { resolveAssistantUserName } from "@/lib/server/assistant-user-name";
import { resolveAssistantPrefsForRequest } from "@/lib/server/resolve-assistant-prefs";
import { buildBriefingFromSnapshot } from "@/lib/server/live-briefing";
import { buildOvernightBriefing } from "@/lib/mock/overview-briefing";
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
    userName?: string;
    todayYmd?: string;
    assistantPrefs?: unknown;
    forceRefresh?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const userName =
    live && supabase
      ? await resolveAssistantUserName(supabase, body.userName)
      : body.userName?.trim() || "there";
  const todayYmd = body.todayYmd?.trim() || new Date().toISOString().slice(0, 10);
  const assistantPrefs = await resolveAssistantPrefsForRequest(
    supabase,
    userId,
    body.assistantPrefs,
  );
  const forceRefresh = body.forceRefresh === true;

  const cached = !forceRefresh ? getCachedBriefing(userId, todayYmd, assistantPrefs) : null;
  if (cached && cached.blocks.length > 0) {
    return NextResponse.json({
      blocks: cached.blocks,
      source: "openai",
      assistantPrefs,
      cached: true,
    });
  }

  const snapshot = await getOrBuildAssistantOpsSnapshot(
    userName,
    todayYmd,
    assistantPrefs,
    userId,
  );

  if (isOpenAiConfigured()) {
    try {
      const blocks = await overnightBriefingWithOpenAi(snapshot);
      if (blocks.length > 0) {
        setCachedBriefing(userId, todayYmd, assistantPrefs, blocks);
        return NextResponse.json({ blocks, source: "openai", assistantPrefs });
      }
    } catch (e) {
      console.warn("[api/assistant/briefing] OpenAI failed", e);
      if (live) {
        return NextResponse.json({
          blocks: buildBriefingFromSnapshot(snapshot),
          source: "live",
          assistantPrefs,
          openaiError: e instanceof Error ? e.message : "OpenAI request failed",
        });
      }
    }
  }

  if (live) {
    return NextResponse.json({
      blocks: buildBriefingFromSnapshot(snapshot),
      source: "live",
      assistantPrefs,
    });
  }

  return NextResponse.json({
    blocks: buildOvernightBriefing(userName, todayYmd, assistantPrefs),
    source: "mock",
    assistantPrefs,
  });
}
