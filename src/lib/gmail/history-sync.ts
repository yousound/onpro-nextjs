import {
  fetchGmailThreadById,
  gmailApiThreadIdFromEmailThreadId,
} from "@/lib/gmail/fetch-threads";
import {
  getGmailSyncStateForService,
  updateGmailSyncState,
  upsertInboxThreadsForService,
} from "@/lib/supabase/gmail-inbox-cache";
import type { EmailThread } from "@/lib/types/agent";

type HistoryListResponse = {
  history?: Array<{
    id?: string;
    messagesAdded?: Array<{ message?: { id?: string; threadId?: string } }>;
    messagesDeleted?: Array<{ message?: { id?: string; threadId?: string } }>;
    labelsAdded?: Array<{ message?: { threadId?: string } }>;
    labelsRemoved?: Array<{ message?: { threadId?: string } }>;
  }>;
  historyId?: string | number;
};

async function fetchHistoryPage(
  accessToken: string,
  startHistoryId: string,
  pageToken?: string,
): Promise<HistoryListResponse> {
  const params = new URLSearchParams({
    startHistoryId,
    historyTypes: "messageAdded",
    labelId: "INBOX",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/history?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail history.list failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<HistoryListResponse>;
}

/** Incremental inbox sync from Gmail historyId (Pub/Sub or manual). */
export async function syncGmailHistoryForUser(
  userId: string,
  accessToken: string,
  startHistoryId: string,
): Promise<{ historyId: string; threadsUpdated: number }> {
  const threadIds = new Set<string>();
  let pageToken: string | undefined;
  let latestHistoryId = startHistoryId;

  do {
    const page = await fetchHistoryPage(accessToken, startHistoryId, pageToken);
    if (page.historyId != null) latestHistoryId = String(page.historyId);
    for (const record of page.history ?? []) {
      for (const item of record.messagesAdded ?? []) {
        if (item.message?.threadId) threadIds.add(item.message.threadId);
      }
      for (const item of record.labelsAdded ?? []) {
        if (item.message?.threadId) threadIds.add(item.message.threadId);
      }
    }
    pageToken = (page as { nextPageToken?: string }).nextPageToken;
  } while (pageToken);

  const threads: EmailThread[] = [];
  for (const gmailId of threadIds) {
    const thread = await fetchGmailThreadById(accessToken, gmailId, { format: "metadata" });
    if (thread) threads.push(thread);
  }

  if (threads.length > 0) {
    await upsertInboxThreadsForService(userId, threads);
  }

  await updateGmailSyncState(
    userId,
    {
      history_id: latestHistoryId,
      last_inbox_sync_at: new Date().toISOString(),
    },
    { service: true },
  );

  return { historyId: latestHistoryId, threadsUpdated: threads.length };
}

/** Refresh one thread in cache (detail open or manual). */
export async function refreshCachedGmailThread(
  userId: string,
  accessToken: string,
  threadId: string,
): Promise<EmailThread | null> {
  const gmailId = gmailApiThreadIdFromEmailThreadId(threadId);
  if (!gmailId) return null;
  const thread = await fetchGmailThreadById(accessToken, gmailId, {
    format: "full",
    resolveInlineImages: true,
  });
  if (thread) await upsertInboxThreadsForService(userId, [thread]);
  return thread;
}

export async function resolveHistoryStartId(
  userId: string,
  notificationHistoryId: string,
): Promise<string | null> {
  const sync = await getGmailSyncStateForService(userId);
  if (sync?.history_id) return sync.history_id;
  return notificationHistoryId;
}
