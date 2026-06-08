import type { AssistantPrefs } from "@/lib/types/assistant-prefs";

/** Stable cache key fragment for assistant prefs (briefing sections + rules). */
export function assistantPrefsCacheKey(prefs: AssistantPrefs): string {
  return JSON.stringify({
    briefing: prefs.briefing ?? {},
    rules: prefs.rules ?? [],
  });
}
