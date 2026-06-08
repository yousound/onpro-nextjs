import type { AssistantPrefs } from "@/lib/types/assistant-prefs";
import { assistantPrefsCacheKey } from "@/lib/server/assistant-prefs-cache-key";
import {
  buildAssistantOpsSnapshot,
  type AssistantOpsSnapshot,
} from "@/lib/server/assistant-ops-snapshot";

const SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 64;

type Entry = { snapshot: AssistantOpsSnapshot; expiresAt: number };

const cache = new Map<string, Entry>();

function snapshotKey(
  userId: string | undefined,
  todayYmd: string,
  assistantPrefs: AssistantPrefs,
): string {
  return `snap:${userId ?? "local"}:${todayYmd}:${assistantPrefsCacheKey(assistantPrefs)}`;
}

function prune(): void {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k);
  }
  if (cache.size <= MAX_ENTRIES) return;
  const sorted = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  for (let i = 0; i < sorted.length - MAX_ENTRIES; i++) {
    cache.delete(sorted[i][0]);
  }
}

export async function getOrBuildAssistantOpsSnapshot(
  userName: string,
  todayYmd: string,
  assistantPrefs: AssistantPrefs,
  userId?: string,
): Promise<AssistantOpsSnapshot> {
  const key = snapshotKey(userId, todayYmd, assistantPrefs);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.snapshot;

  const snapshot = await buildAssistantOpsSnapshot(userName, todayYmd, assistantPrefs, userId);
  cache.set(key, { snapshot, expiresAt: Date.now() + SNAPSHOT_TTL_MS });
  prune();
  return snapshot;
}

/** Drop cached workspace snapshot after prefs change so the next chat sees updates. */
export function invalidateAssistantOpsSnapshotCache(
  userId: string | undefined,
  todayYmd: string,
  assistantPrefs: AssistantPrefs,
): void {
  cache.delete(snapshotKey(userId, todayYmd, assistantPrefs));
}
