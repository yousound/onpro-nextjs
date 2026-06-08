import { isSupabaseBackendEnabled } from "@/lib/config/backend";
import { clientBackendMode } from "@/lib/config/backend-mode";
import type { AgentApplyResult } from "@/lib/agent-apply-core";
import type {
  AgentSuggestion,
  AgentSuggestionKind,
  EmailThread,
  GeneratedItem,
  MailroomWorkflow,
} from "@/lib/types/agent";

export type SummarizeThreadResponse = {
  summary: string;
  suggestions: AgentSuggestion[];
  workflow: MailroomWorkflow | null;
  project_id: number | null;
  source: "openai" | "mock" | "live";
  /** Server returned a cached summarize result (no new OpenAI call). */
  cached?: boolean;
};

export type GmailStatusResponse = {
  connected: boolean;
  email: string | null;
  mode: string;
  oauthConfigured?: boolean;
  message?: string;
};

export type MailroomThreadsResponse = {
  threads: EmailThread[];
  source: "live" | "mock";
  connected?: boolean;
  email?: string | null;
  message?: string;
  error?: string;
};

export function mailroomApiEnabled(): boolean {
  return isSupabaseBackendEnabled(clientBackendMode());
}

export async function fetchGmailStatusViaApi(): Promise<GmailStatusResponse> {
  const res = await fetch("/api/mailroom/gmail", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<GmailStatusResponse>;
}

export async function fetchMailroomThreadsViaApi(): Promise<MailroomThreadsResponse> {
  const res = await fetch("/api/mailroom/threads", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<MailroomThreadsResponse>;
}

export async function disconnectGmailViaApi(): Promise<void> {
  const res = await fetch("/api/mailroom/gmail", { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
}

export type MailroomChatResponse = {
  reply: string;
  propose_suggestion: {
    kind: AgentSuggestionKind;
    title: string;
    payload: Record<string, unknown>;
  } | null;
  apply_all?: boolean;
  source: "openai" | "fallback";
};

export async function sendMailroomChatViaApi(opts: {
  thread: EmailThread;
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  pendingSuggestionTitles: string[];
  scanSummary?: string;
  workspaceContext?: string;
}): Promise<MailroomChatResponse> {
  const res = await fetch("/api/mailroom/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<MailroomChatResponse>;
}

export async function summarizeThreadViaApi(
  thread: EmailThread,
  opts?: { forceRegenerate?: boolean },
): Promise<SummarizeThreadResponse> {
  const res = await fetch("/api/mailroom/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      thread,
      forceRegenerate: opts?.forceRegenerate === true,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<SummarizeThreadResponse>;
}

/** Drop server summarize cache so the next Summarize rebuilds workflow from scratch. */
export async function invalidateMailroomSummarizeCache(thread: EmailThread): Promise<void> {
  try {
    const res = await fetch("/api/mailroom/summarize", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread }),
    });
    if (!res.ok && res.status !== 401) {
      console.warn("[mailroom] invalidate summarize cache failed", res.status);
    }
  } catch (e) {
    console.warn("[mailroom] invalidate summarize cache", e);
  }
}

export async function applySuggestionViaApi(
  suggestion: AgentSuggestion,
  opts?: {
    context?: { project_id?: number; job_id?: string };
    title?: string;
    payload?: Record<string, unknown>;
  },
): Promise<{ result: AgentApplyResult; item: GeneratedItem } | null> {
  if (!mailroomApiEnabled()) return null;

  const res = await fetch("/api/mailroom/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      suggestion,
      context: opts?.context,
      title: opts?.title,
      payload: opts?.payload,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<{ result: AgentApplyResult; item: GeneratedItem }>;
}
