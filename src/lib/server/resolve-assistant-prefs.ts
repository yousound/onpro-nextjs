import { mergeAssistantPrefs, normalizeAssistantPrefs } from "@/lib/assistant/prefs";
import { fetchAssistantPrefs, saveAssistantPrefs } from "@/lib/supabase/assistant-prefs";
import type { AssistantPrefs } from "@/lib/types/assistant-prefs";
import { DEFAULT_ASSISTANT_PREFS } from "@/lib/types/assistant-prefs";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveAssistantPrefsForRequest(
  supabase: SupabaseClient | null,
  userId: string | undefined,
  bodyPrefs: unknown,
): Promise<AssistantPrefs> {
  const fromBody = bodyPrefs !== undefined ? normalizeAssistantPrefs(bodyPrefs) : null;

  if (supabase && userId) {
    const fromDb = await fetchAssistantPrefs(supabase, userId);
    if (fromBody) return mergeAssistantPrefs(fromDb, fromBody);
    return fromDb;
  }

  if (fromBody) return fromBody;
  return { ...DEFAULT_ASSISTANT_PREFS };
}

export async function persistAssistantPrefsIfLive(
  supabase: SupabaseClient | null,
  userId: string | undefined,
  prefs: AssistantPrefs,
): Promise<void> {
  if (!supabase || !userId) return;
  await saveAssistantPrefs(supabase, userId, prefs);
}
