import { normalizeAssistantPrefs } from "@/lib/assistant/prefs";
import type { AssistantPrefs } from "@/lib/types/assistant-prefs";
import { DEFAULT_ASSISTANT_PREFS } from "@/lib/types/assistant-prefs";

const STORAGE_KEY = "onpro-assistant-prefs";

export function loadAssistantPrefsFromSession(): AssistantPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_ASSISTANT_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ASSISTANT_PREFS };
    return normalizeAssistantPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ASSISTANT_PREFS };
  }
}

export function saveAssistantPrefsToSession(prefs: AssistantPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeAssistantPrefs(prefs)));
  } catch {
    /* ignore quota */
  }
}
