import type { ClientJobOverlayRow } from "@/lib/assistant/client-jobs-overlay";
import type { AssistantReply, BriefingBlock } from "@/lib/mock/overview-briefing";
import type { AssistantPrefs } from "@/lib/types/assistant-prefs";

export type AssistantChatResponse = {
  reply: AssistantReply;
  text: string;
  source: "openai" | "mock" | "live";
  assistantPrefs?: AssistantPrefs;
  prefsUpdated?: boolean;
};

export type AssistantBriefingResponse = {
  blocks: BriefingBlock[];
  source: "openai" | "mock" | "live";
  assistantPrefs?: AssistantPrefs;
};

export async function fetchAssistantBriefingViaApi(
  userName: string,
  todayYmd: string,
  assistantPrefs?: AssistantPrefs,
  opts?: { forceRefresh?: boolean },
): Promise<AssistantBriefingResponse> {
  const res = await fetch("/api/assistant/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName,
      todayYmd,
      assistantPrefs,
      forceRefresh: opts?.forceRefresh === true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<AssistantBriefingResponse>;
}

export async function sendAssistantMessageViaApi(opts: {
  message: string;
  userName: string;
  todayYmd: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  assistantPrefs?: AssistantPrefs;
  clientJobs?: ClientJobOverlayRow[];
}): Promise<AssistantChatResponse> {
  const res = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<AssistantChatResponse>;
}
