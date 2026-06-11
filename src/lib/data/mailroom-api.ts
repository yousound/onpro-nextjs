import { isSupabaseBackendEnabled } from "@/lib/config/backend";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
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
  nextPageToken?: string | null;
  hasMore?: boolean;
  pageSize?: number;
  resultSizeEstimate?: number | null;
  searchQuery?: string | null;
  source: "live" | "mock";
  connected?: boolean;
  email?: string | null;
  message?: string;
  error?: string;
};

export function mailroomApiEnabled(): boolean {
  return isSupabaseBackendEnabled() && isClientLiveBackend();
}

export class GmailStatusError extends Error {
  status: number;
  mode?: string;

  constructor(message: string, status: number, mode?: string) {
    super(message);
    this.name = "GmailStatusError";
    this.status = status;
    this.mode = mode;
  }
}

export const MAILROOM_FIRST_INBOX_PAGE_SIZE = 15;

export type MailroomBootstrapResponse = GmailStatusResponse & {
  threads: EmailThread[];
  nextPageToken?: string | null;
  hasMore?: boolean;
  resultSizeEstimate?: number | null;
  pageSize?: number;
  profilePicture?: string | null;
  inboxSource?: "cache" | "gmail";
  source?: "live" | "mock";
};

export async function fetchMailroomBootstrapViaApi(opts?: {
  maxResults?: number;
  fresh?: boolean;
}): Promise<MailroomBootstrapResponse> {
  const params = new URLSearchParams();
  if (opts?.maxResults != null) params.set("maxResults", String(opts.maxResults));
  if (opts?.fresh) params.set("fresh", "1");
  const qs = params.toString();
  const res = await fetch(`/api/mailroom/bootstrap${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as MailroomBootstrapResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new GmailStatusError(body.error ?? res.statusText, res.status, body.mode);
  }
  return body;
}

export async function fetchGmailStatusViaApi(): Promise<GmailStatusResponse> {
  const res = await fetch("/api/mailroom/gmail", { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as GmailStatusResponse & { error?: string };
  if (!res.ok) {
    throw new GmailStatusError(body.error ?? res.statusText, res.status, body.mode);
  }
  return body;
}

export async function fetchMailroomThreadsViaApi(opts?: {
  pageToken?: string;
  maxResults?: number;
  /** Gmail search query (same syntax as Gmail search bar). */
  q?: string;
  /** When true, fetches inline images (slow). List loads should leave this false. */
  resolveImages?: boolean;
}): Promise<MailroomThreadsResponse> {
  const params = new URLSearchParams();
  if (opts?.pageToken) params.set("pageToken", opts.pageToken);
  if (opts?.maxResults != null) params.set("maxResults", String(opts.maxResults));
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.resolveImages) params.set("resolveImages", "1");
  const qs = params.toString();
  const res = await fetch(`/api/mailroom/threads${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<MailroomThreadsResponse>;
}

export type MailroomThreadDetailResponse = {
  thread: EmailThread;
  source: "live";
  connected: boolean;
  email: string | null;
};

export async function fetchMailroomThreadDetailViaApi(
  threadId: string,
): Promise<MailroomThreadDetailResponse> {
  const res = await fetch(`/api/mailroom/threads/${encodeURIComponent(threadId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<MailroomThreadDetailResponse>;
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
