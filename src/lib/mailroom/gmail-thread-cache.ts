import type { EmailThread } from "@/lib/types/agent";

export type MailroomGmailSyncMeta = {
  loadedCount: number;
  estimatedTotal: number | null;
  complete: boolean;
};

/** Session cache for paginated Gmail inbox threads (per browser tab). */
let threads: EmailThread[] = [];
let nextPageToken: string | null = null;
let estimatedTotal: number | null = null;
let syncComplete = false;
let cachedAt = 0;

const CACHE_TTL_MS = 30 * 60 * 1000;

function sortThreads(list: EmailThread[]): EmailThread[] {
  return [...list].sort((a, b) => {
    const atA = a.messages[a.messages.length - 1]?.at ?? "";
    const atB = b.messages[b.messages.length - 1]?.at ?? "";
    return atB.localeCompare(atA);
  });
}

export function getCachedMailroomGmailThreads(): {
  threads: EmailThread[];
  nextPageToken: string | null;
  fresh: boolean;
  sync: MailroomGmailSyncMeta;
} {
  const fresh = cachedAt > 0 && Date.now() - cachedAt < CACHE_TTL_MS;
  return {
    threads: fresh ? threads : [],
    nextPageToken: fresh ? nextPageToken : null,
    fresh,
    sync: {
      loadedCount: fresh ? threads.length : 0,
      estimatedTotal: fresh ? estimatedTotal : null,
      complete: fresh ? syncComplete && !nextPageToken : false,
    },
  };
}

export function mergeCachedMailroomGmailThreads(
  incoming: EmailThread[],
  pageToken: string | null,
  opts?: { estimatedTotal?: number | null; markComplete?: boolean },
): EmailThread[] {
  const byId = new Map(threads.map((t) => [t.id, t]));
  for (const t of incoming) byId.set(t.id, t);
  threads = sortThreads([...byId.values()]);
  nextPageToken = pageToken;
  if (opts?.estimatedTotal != null) estimatedTotal = opts.estimatedTotal;
  if (opts?.markComplete || !pageToken) syncComplete = !pageToken;
  cachedAt = Date.now();
  return threads;
}

export function getMailroomGmailSyncMeta(): MailroomGmailSyncMeta {
  return {
    loadedCount: threads.length,
    estimatedTotal,
    complete: syncComplete && !nextPageToken,
  };
}

export function clearMailroomGmailThreadCache(): void {
  threads = [];
  nextPageToken = null;
  estimatedTotal = null;
  syncComplete = false;
  cachedAt = 0;
}
