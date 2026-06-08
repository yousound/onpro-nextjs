import type { BriefingBlock } from "@/lib/mock/overview-briefing";
import type { AssistantPrefs } from "@/lib/types/assistant-prefs";
import { assistantPrefsCacheKey } from "@/lib/server/assistant-prefs-cache-key";

const MAX_ENTRIES = 48;

export type CachedBriefing = {
  blocks: BriefingBlock[];
  source: "openai";
  expiresAt: number;
};

const cache = new Map<string, CachedBriefing>();

function briefingKey(
  userId: string | undefined,
  todayYmd: string,
  assistantPrefs: AssistantPrefs,
): string {
  return `brief:${userId ?? "local"}:${todayYmd}:${assistantPrefsCacheKey(assistantPrefs)}`;
}

function expiresAtForDay(todayYmd: string): number {
  const end = new Date(`${todayYmd}T23:59:59.999Z`).getTime();
  if (Number.isNaN(end)) return Date.now() + 6 * 60 * 60 * 1000;
  return Math.max(end, Date.now() + 60_000);
}

export function getCachedBriefing(
  userId: string | undefined,
  todayYmd: string,
  assistantPrefs: AssistantPrefs,
): CachedBriefing | null {
  const hit = cache.get(briefingKey(userId, todayYmd, assistantPrefs));
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit;
}

export function setCachedBriefing(
  userId: string | undefined,
  todayYmd: string,
  assistantPrefs: AssistantPrefs,
  blocks: BriefingBlock[],
): void {
  const key = briefingKey(userId, todayYmd, assistantPrefs);
  cache.set(key, {
    blocks,
    source: "openai",
    expiresAt: expiresAtForDay(todayYmd),
  });
  if (cache.size > MAX_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
}

export function invalidateBriefingCache(
  userId: string | undefined,
  todayYmd: string,
  assistantPrefs: AssistantPrefs,
): void {
  cache.delete(briefingKey(userId, todayYmd, assistantPrefs));
}
