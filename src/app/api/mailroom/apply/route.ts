import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { createClient } from "@/lib/supabase/server";
import { applySuggestionWithContext } from "@/lib/server/apply-suggestion";
import { generatedItemFromSuggestion } from "@/lib/agent-apply-core";
import type { AgentSuggestion } from "@/lib/types/agent";

export async function POST(request: Request) {
  const live = await isLiveBackendEnabled();

  let user: { id: string } | null = null;
  if (live) {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    user = authUser;
  }

  let body: {
    suggestion?: AgentSuggestion;
    context?: { project_id?: number; job_id?: string };
    title?: string;
    payload?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const suggestion = body.suggestion;
  if (!suggestion?.id || !suggestion.kind) {
    return NextResponse.json({ error: "Missing suggestion" }, { status: 400 });
  }

  const effective: AgentSuggestion = {
    ...suggestion,
    title: body.title?.trim() || suggestion.title,
    payload: body.payload ?? suggestion.payload,
  };

  const result = await applySuggestionWithContext(effective, body.context);
  if (!result.ok) {
    return NextResponse.json(result, { status: 422 });
  }

  const item = generatedItemFromSuggestion(effective, result);

  if (live && user) {
    const supabase = await createClient();
    const { error: insertError } = await supabase.from("mailroom_generated_items").insert({
      id: item.id,
      thread_id: item.thread_id,
      user_id: user.id,
      kind: item.kind,
      title: item.title,
      summary: item.summary ?? null,
      payload: item.payload,
      deep_link: item.deepLink ?? null,
      source_suggestion_id: item.source_suggestion_id ?? null,
      created_at: item.created_at,
    });

    if (insertError && insertError.code !== "42P01") {
      console.warn("[api/mailroom/apply] persist skipped", insertError.message);
    }
  }

  return NextResponse.json({ result, item, source: live ? "live" : "mock" });
}
