import { normalizeAssistantPrefs } from "@/lib/assistant/prefs";
import type { AssistantPrefs } from "@/lib/types/assistant-prefs";
import { DEFAULT_ASSISTANT_PREFS } from "@/lib/types/assistant-prefs";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchAssistantPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<AssistantPrefs> {
  const { data, error } = await supabase
    .from("profiles")
    .select("assistant_prefs")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return { ...DEFAULT_ASSISTANT_PREFS };
    }
    throw error;
  }

  return normalizeAssistantPrefs(
    (data as { assistant_prefs?: unknown } | null)?.assistant_prefs,
  );
}

export async function saveAssistantPrefs(
  supabase: SupabaseClient,
  userId: string,
  prefs: AssistantPrefs,
): Promise<void> {
  const normalized = normalizeAssistantPrefs(prefs);
  const { error } = await supabase
    .from("profiles")
    .update({ assistant_prefs: normalized })
    .eq("id", userId);

  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      console.warn(
        "[assistant-prefs] assistant_prefs column missing — run supabase/migrations/007_assistant_prefs.sql",
      );
      return;
    }
    throw error;
  }
}
