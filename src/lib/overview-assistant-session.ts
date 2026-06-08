import type { WorkspaceProposal } from "@/lib/assistant/workspace-split-jobs";
import type { BriefingPart } from "@/lib/mock/overview-briefing";

export type OverviewChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  parts?: BriefingPart[];
  /** Action card the user can confirm (create project, move jobs, etc.). */
  workspaceProposal?: WorkspaceProposal;
};

const CHAT_STORAGE_KEY = "onpro-assistant-chat";
const CHAT_TTL_MS = 24 * 60 * 60 * 1000;

type StoredChat = {
  savedAt: string;
  messages: OverviewChatMessage[];
};

/** Resets on full page refresh; survives client-side route changes. */
let briefingAnimatedThisPageLoad = false;

let chatCache: OverviewChatMessage[] = [];
let chatHydratedFromStorage = false;

const typedAssistantMessageIds = new Set<string>();

export function hasBriefingAnimatedThisPageLoad(): boolean {
  return briefingAnimatedThisPageLoad;
}

export function markBriefingAnimatedThisPageLoad(): void {
  briefingAnimatedThisPageLoad = true;
}

/** Allows briefing typewriter to run again (e.g. “Update me” without browser refresh). */
export function clearBriefingAnimatedThisPageLoad(): void {
  briefingAnimatedThisPageLoad = false;
}

function readStoredChat(): OverviewChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChat;
    if (!parsed.savedAt || !Array.isArray(parsed.messages)) return null;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (!Number.isFinite(age) || age > CHAT_TTL_MS) {
      window.localStorage.removeItem(CHAT_STORAGE_KEY);
      return null;
    }
    return parsed.messages;
  } catch {
    return null;
  }
}

function writeStoredChat(messages: OverviewChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredChat = {
      savedAt: new Date().toISOString(),
      messages,
    };
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

/** Hydrate from localStorage once per tab (24h retention). */
export function hydrateOverviewChatFromStorage(): OverviewChatMessage[] {
  if (chatHydratedFromStorage) return [...chatCache];
  chatHydratedFromStorage = true;
  const stored = readStoredChat();
  if (stored) {
    chatCache = stored;
    for (const m of chatCache) {
      if (m.role === "assistant") typedAssistantMessageIds.add(m.id);
    }
  }
  return [...chatCache];
}

export function loadOverviewChatCache(): OverviewChatMessage[] {
  for (const m of chatCache) {
    if (m.role === "assistant") typedAssistantMessageIds.add(m.id);
  }
  return [...chatCache];
}

export function saveOverviewChatCache(messages: OverviewChatMessage[]): void {
  chatCache = messages;
  writeStoredChat(messages);
}

export function shouldAnimateAssistantMessage(id: string): boolean {
  return !typedAssistantMessageIds.has(id);
}

export function markAssistantMessageAnimated(id: string): void {
  typedAssistantMessageIds.add(id);
}
