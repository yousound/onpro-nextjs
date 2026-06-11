import type { EmailThread } from "@/lib/types/agent";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const GMAIL_INBOX_CACHE_TTL_MS = 5 * 60 * 1000;

export type GmailSyncStateRow = {
  user_id: string;
  history_id: string | null;
  watch_expiration: string | null;
  last_inbox_sync_at: string | null;
  next_page_token: string | null;
  inbox_estimate: number | null;
  updated_at: string;
};

export function isMissingGmailInboxCacheError(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(
    error.message?.includes("gmail_inbox_threads") ||
      error.message?.includes("gmail_sync_state"),
  );
}

function lastMessageAt(thread: EmailThread): string {
  const at = thread.messages[thread.messages.length - 1]?.at;
  return at ?? new Date().toISOString();
}

function gmailIdFromThread(thread: EmailThread): string {
  return thread.id.startsWith("gmail-") ? thread.id.slice("gmail-".length) : thread.id;
}

export async function getGmailSyncState(userId: string): Promise<GmailSyncStateRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gmail_sync_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingGmailInboxCacheError(error)) return null;
    throw error;
  }
  return data as GmailSyncStateRow | null;
}

export async function getGmailSyncStateForService(
  userId: string,
): Promise<GmailSyncStateRow | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("gmail_sync_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingGmailInboxCacheError(error)) return null;
    throw error;
  }
  return data as GmailSyncStateRow | null;
}

export function isInboxCacheFresh(sync: GmailSyncStateRow | null): boolean {
  if (!sync?.last_inbox_sync_at) return false;
  return Date.now() - new Date(sync.last_inbox_sync_at).getTime() < GMAIL_INBOX_CACHE_TTL_MS;
}

export async function getCachedInboxThreads(
  userId: string,
  limit: number,
): Promise<EmailThread[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gmail_inbox_threads")
    .select("thread_data")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingGmailInboxCacheError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => row.thread_data as EmailThread);
}

export async function upsertInboxThreads(userId: string, threads: EmailThread[]): Promise<void> {
  if (threads.length === 0) return;
  const supabase = await createClient();
  const rows = threads.map((thread) => ({
    user_id: userId,
    gmail_thread_id: gmailIdFromThread(thread),
    thread_data: thread,
    last_message_at: lastMessageAt(thread),
    synced_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("gmail_inbox_threads").upsert(rows, {
    onConflict: "user_id,gmail_thread_id",
  });
  if (error && !isMissingGmailInboxCacheError(error)) throw error;
}

export async function upsertInboxThreadsForService(
  userId: string,
  threads: EmailThread[],
): Promise<void> {
  if (threads.length === 0) return;
  const supabase = createServiceClient();
  if (!supabase) return;
  const rows = threads.map((thread) => ({
    user_id: userId,
    gmail_thread_id: gmailIdFromThread(thread),
    thread_data: thread,
    last_message_at: lastMessageAt(thread),
    synced_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("gmail_inbox_threads").upsert(rows, {
    onConflict: "user_id,gmail_thread_id",
  });
  if (error && !isMissingGmailInboxCacheError(error)) throw error;
}

export async function updateGmailSyncState(
  userId: string,
  patch: Partial<
    Pick<
      GmailSyncStateRow,
      "history_id" | "watch_expiration" | "last_inbox_sync_at" | "next_page_token" | "inbox_estimate"
    >
  >,
  opts?: { service?: boolean },
): Promise<void> {
  const supabase = (opts?.service ? createServiceClient() : null) ?? (await createClient());
  const { error } = await supabase.from("gmail_sync_state").upsert(
    {
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error && !isMissingGmailInboxCacheError(error)) throw error;
}

export async function clearGmailInboxCache(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("gmail_inbox_threads").delete().eq("user_id", userId);
  await supabase.from("gmail_sync_state").delete().eq("user_id", userId);
}

export async function getUserIdByGmailEmail(email: string): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_gmail_connections")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();
  if (error) return null;
  return (data as { user_id: string } | null)?.user_id ?? null;
}
