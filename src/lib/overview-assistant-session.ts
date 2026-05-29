import type { BriefingPart } from "@/lib/mock/overview-briefing";

export type OverviewChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  parts?: BriefingPart[];
};

/** Resets on full page refresh; survives client-side route changes. */
let briefingAnimatedThisPageLoad = false;

let chatCache: OverviewChatMessage[] = [];

const typedAssistantMessageIds = new Set<string>();

export function hasBriefingAnimatedThisPageLoad(): boolean {
  return briefingAnimatedThisPageLoad;
}

export function markBriefingAnimatedThisPageLoad(): void {
  briefingAnimatedThisPageLoad = true;
}

export function loadOverviewChatCache(): OverviewChatMessage[] {
  for (const m of chatCache) {
    if (m.role === "assistant") typedAssistantMessageIds.add(m.id);
  }
  return [...chatCache];
}

export function saveOverviewChatCache(messages: OverviewChatMessage[]): void {
  chatCache = messages;
}

export function shouldAnimateAssistantMessage(id: string): boolean {
  return !typedAssistantMessageIds.has(id);
}

export function markAssistantMessageAnimated(id: string): void {
  typedAssistantMessageIds.add(id);
}
