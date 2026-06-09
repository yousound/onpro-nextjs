import type { EmailThread } from "@/lib/types/agent";

/** Session cache for paginated Gmail inbox threads (per browser tab). */
let threads: EmailThread[] = [];
let nextPageToken: string | null = null;
let cachedAt = 0;

const CACHE_TTL_MS = 10 * 60 * 1000;

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
} {
  const fresh = cachedAt > 0 && Date.now() - cachedAt < CACHE_TTL_MS;
  return {
    threads: fresh ? threads : [],
    nextPageToken: fresh ? nextPageToken : null,
    fresh,
  };
}

export function mergeCachedMailroomGmailThreads(
  incoming: EmailThread[],
  pageToken: string | null,
): EmailThread[] {
  const byId = new Map(threads.map((t) => [t.id, t]));
  for (const t of incoming) byId.set(t.id, t);
  threads = sortThreads([...byId.values()]);
  nextPageToken = pageToken;
  cachedAt = Date.now();
  return threads;
}

export function clearMailroomGmailThreadCache(): void {
  threads = [];
  nextPageToken = null;
  cachedAt = 0;
}
