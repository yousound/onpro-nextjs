import {
  enrichThreadsWithGoogleProfile,
  fetchGmailInboxThreadPage,
  fetchGoogleUserProfile,
  GMAIL_INBOX_FIRST_PAGE_SIZE,
  GMAIL_INBOX_PAGE_SIZE,
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
import { startGmailWatch, watchNeedsRenewal } from "@/lib/gmail/watch";
import type { EmailThread } from "@/lib/types/agent";

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
  const [page, profile] = await Promise.all([
    fetchGmailInboxThreadPage(accessToken, {
      pageToken: opts.pageToken,
      maxResults: opts.maxResults,
      q: opts.q,
      format: "metadata",
      resolveInlineImages: false,
    }),
    fetchGoogleUserProfile(accessToken).catch(() => null),
  ]);

  const enriched = profile
    ? enrichThreadsWithGoogleProfile(page.threads, profile)
    : page.threads;

  if (!opts.q?.trim()) {
    void upsertInboxThreads(userId, enriched).catch((e) =>
      console.warn("[mailroom] inbox cache upsert failed", e),
    );
    void updateGmailSyncState(userId, {
      last_inbox_sync_at: new Date().toISOString(),
      next_page_token: page.nextPageToken,
      inbox_estimate: page.resultSizeEstimate,
    }).catch(() => undefined);

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

  return fetchInboxPageFromGmail(userId, connection, {
    pageToken: pageToken ?? undefined,
    maxResults,
    q: q ?? undefined,
  });
}
