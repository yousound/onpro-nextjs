import {
  enrichThreadsWithGoogleProfile,
  fetchGmailInboxThreadPage,
  fetchGmailSentThreadPage,
  fetchGoogleUserProfile,
  GMAIL_INBOX_FIRST_PAGE_SIZE,
  GMAIL_INBOX_PAGE_SIZE,
  GMAIL_SENT_SYNC_SIZE,
} from "@/lib/gmail/fetch-threads";
import type { GmailConnectionRow } from "@/lib/supabase/gmail-connection";
import { getValidGmailAccessToken } from "@/lib/supabase/gmail-connection";
import {
  getCachedInboxThreads,
  getGmailSyncState,
  isInboxCacheFresh,
  updateGmailSyncState,
  upsertInboxThreads,
} from "@/lib/supabase/gmail-inbox-cache";
import { syncGmailHistoryForUser } from "@/lib/gmail/history-sync";
import { startGmailWatch, watchNeedsRenewal } from "@/lib/gmail/watch";
import type { EmailThread } from "@/lib/types/agent";

function threadLatestAt(thread: EmailThread): string {
  return thread.messages[thread.messages.length - 1]?.at ?? "";
}

function sortInboxThreads(list: EmailThread[]): EmailThread[] {
  return [...list].sort((a, b) => threadLatestAt(b).localeCompare(threadLatestAt(a)));
}

function mergeInboxThreadsPreferNewer(...lists: EmailThread[][]): EmailThread[] {
  const byId = new Map<string, EmailThread>();
  for (const list of lists) {
    for (const t of list) {
      const prev = byId.get(t.id);
      if (!prev || threadLatestAt(t) >= threadLatestAt(prev)) byId.set(t.id, t);
    }
  }
  return sortInboxThreads([...byId.values()]);
}

async function syncRecentGmailHistory(
  userId: string,
  connection: GmailConnectionRow,
): Promise<void> {
  const sync = await getGmailSyncState(userId);
  if (!sync?.history_id) return;
  try {
    const { accessToken } = await getValidGmailAccessToken(connection);
    await syncGmailHistoryForUser(userId, accessToken, sync.history_id);
  } catch (e) {
    console.warn("[mailroom] history sync on fresh load failed", e);
  }
}

export type MailroomInboxPageResult = {
  threads: EmailThread[];
  nextPageToken: string | null;
  resultSizeEstimate: number | null;
  pageSize: number;
  source: "cache" | "gmail";
  profilePicture: string | null;
};

async function readCachedInboxPage(
  userId: string,
  maxResults: number,
): Promise<MailroomInboxPageResult | null> {
  const sync = await getGmailSyncState(userId);
  if (!isInboxCacheFresh(sync)) return null;
  const threads = await getCachedInboxThreads(userId, maxResults);
  if (threads.length === 0) return null;
  return {
    threads,
    nextPageToken: sync?.next_page_token ?? null,
    resultSizeEstimate: sync?.inbox_estimate ?? null,
    pageSize: maxResults,
    source: "cache",
    profilePicture: null,
  };
}

async function fetchInboxPageFromGmail(
  userId: string,
  connection: GmailConnectionRow,
  opts: {
    pageToken?: string;
    maxResults: number;
    q?: string;
  },
): Promise<MailroomInboxPageResult> {
  const { accessToken } = await getValidGmailAccessToken(connection);
  const [page, sentThreads, profile] = await Promise.all([
    fetchGmailInboxThreadPage(accessToken, {
      pageToken: opts.pageToken,
      maxResults: opts.maxResults,
      q: opts.q,
      format: "metadata",
      resolveInlineImages: false,
    }),
    !opts.pageToken && !opts.q?.trim()
      ? fetchGmailSentThreadPage(accessToken, { maxResults: GMAIL_SENT_SYNC_SIZE })
      : Promise.resolve([]),
    fetchGoogleUserProfile(accessToken).catch(() => null),
  ]);

  const mergedThreads = mergeInboxThreadsPreferNewer(page.threads, sentThreads);
  const enriched = profile
    ? enrichThreadsWithGoogleProfile(mergedThreads, profile)
    : mergedThreads;

  if (!opts.q?.trim()) {
    if (enriched.length > 0) {
      void upsertInboxThreads(userId, enriched).catch((e) =>
        console.warn("[mailroom] inbox cache upsert failed", e),
      );
      void updateGmailSyncState(userId, {
        last_inbox_sync_at: new Date().toISOString(),
        next_page_token: page.nextPageToken,
        inbox_estimate: page.resultSizeEstimate,
      }).catch(() => undefined);
    } else if (page.resultSizeEstimate && page.resultSizeEstimate > 0) {
      console.warn(
        "[mailroom] Gmail inbox estimate",
        page.resultSizeEstimate,
        "but 0 threads parsed — skipping cache update",
      );
    }

    const sync = await getGmailSyncState(userId);
    if (watchNeedsRenewal(sync?.watch_expiration)) {
      void startGmailWatch(accessToken, userId).catch((e) =>
        console.warn("[mailroom] watch renew failed", e),
      );
    }
  }

  return {
    threads: enriched,
    nextPageToken: page.nextPageToken,
    resultSizeEstimate: page.resultSizeEstimate,
    pageSize: opts.maxResults,
    source: "gmail",
    profilePicture: profile?.picture ?? null,
  };
}

export async function loadMailroomInboxPage(
  userId: string,
  connection: GmailConnectionRow,
  opts?: {
    pageToken?: string;
    maxResults?: number;
    q?: string;
    skipCache?: boolean;
  },
): Promise<MailroomInboxPageResult> {
  const maxResults = Math.min(
    GMAIL_INBOX_PAGE_SIZE,
    Math.max(1, opts?.maxResults ?? GMAIL_INBOX_FIRST_PAGE_SIZE),
  );
  const pageToken = opts?.pageToken?.trim() || null;
  const q = opts?.q?.trim() || null;

  if (!opts?.skipCache && !pageToken && !q) {
    const cached = await readCachedInboxPage(userId, maxResults);
    if (cached) return cached;
  }

  if (opts?.skipCache && !pageToken && !q) {
    await syncRecentGmailHistory(userId, connection);
  }

  const page = await fetchInboxPageFromGmail(userId, connection, {
    pageToken: pageToken ?? undefined,
    maxResults,
    q: q ?? undefined,
  });

  if (opts?.skipCache && !pageToken && !q) {
    const dbRecent = await getCachedInboxThreads(userId, maxResults);
    if (dbRecent.length > 0) {
      return {
        ...page,
        threads: mergeInboxThreadsPreferNewer(page.threads, dbRecent).slice(0, maxResults),
      };
    }
  }

  return page;
}
