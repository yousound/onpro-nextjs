"use client";

import {
  generatedKindFromSuggestion,
  suggestionKindFromGeneratedKind,
} from "@/lib/agent-apply";
import { suggestionsForThread } from "@/lib/mock/email-threads";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import type {
  AgentChatMessage,
  AgentSuggestion,
  AgentSuggestionStatus,
  EmailMessage,
  EmailThread,
  EmailThreadStatus,
  GeneratedItem,
  MailroomState,
} from "@/lib/types/agent";

export function titlesLikelyMatch(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y) return true;
  if (x === y) return true;
  const probe = x.length <= y.length ? x : y;
  const hay = x.length <= y.length ? y : x;
  return hay.includes(probe.slice(0, Math.min(28, probe.length)));
}

/** Find agent suggestions that should reopen when a generated doc is removed. */
function suggestionIdsToResetForRemovedItem(
  state: MailroomState,
  item: GeneratedItem,
): string[] {
  const ids = new Set<string>();
  if (item.source_suggestion_id) ids.add(item.source_suggestion_id);

  const matchKind = suggestionKindFromGeneratedKind(item.kind);
  const threadStub = { id: item.thread_id } as EmailThread;
  const candidates = [
    ...suggestionsForThread(threadStub),
    ...state.custom_suggestions.filter((s) => s.thread_id === item.thread_id),
  ];

  const appliedOnThread = candidates.filter((s) => {
    const status = state.suggestion_status[s.id] ?? s.status;
    if (status !== "applied") return false;
    if (matchKind && s.kind !== matchKind) return false;
    return true;
  });

  for (const s of appliedOnThread) {
    if (item.title && !titlesLikelyMatch(item.title, s.title)) continue;
    ids.add(s.id);
  }

  if (ids.size === 0 && appliedOnThread.length === 1) {
    ids.add(appliedOnThread[0].id);
  }

  return [...ids];
}

function defaultState(): MailroomState {
  return {
    oauth_connected: false,
    connected_email: null,
    suggestion_status: {},
    thread_status: {},
    generated_items: [],
    chat: {},
    custom_suggestions: [],
    outbox: {},
    summarized_threads: {},
    promoted_threads: [],
    message_links: {},
  };
}

/** Backfill new fields onto legacy persisted state. */
function ensureShape(state: MailroomState | null): MailroomState {
  if (!state) return defaultState();
  return {
    ...defaultState(),
    ...state,
    suggestion_status: state.suggestion_status ?? {},
    thread_status: state.thread_status ?? {},
    generated_items: state.generated_items ?? [],
    chat: state.chat ?? {},
    custom_suggestions: state.custom_suggestions ?? [],
    outbox: state.outbox ?? {},
    summarized_threads: state.summarized_threads ?? {},
    promoted_threads: state.promoted_threads ?? [],
    message_links: state.message_links ?? {},
  };
}

/** Applied only sticks while a generated item still exists for that suggestion. */
export function resolveSuggestionStatus(
  suggestion: AgentSuggestion,
  suggestionStatus: Record<string, AgentSuggestionStatus>,
  generatedItems: GeneratedItem[],
): AgentSuggestionStatus {
  const stored = suggestionStatus[suggestion.id] ?? suggestion.status;
  if (stored !== "applied") return stored;

  const generatedKind = generatedKindFromSuggestion(suggestion.kind);
  const hasLinkedItem = generatedItems.some((item) => {
    if (item.thread_id !== suggestion.thread_id) return false;
    if (item.source_suggestion_id === suggestion.id) return true;
    if (item.kind !== generatedKind) return false;
    return titlesLikelyMatch(item.title, suggestion.title);
  });

  return hasLinkedItem ? "applied" : "pending";
}

/** Drop stale "applied" flags left in localStorage after generated docs were removed. */
function reconcileSuggestionStatus(state: MailroomState): MailroomState {
  const next = { ...state.suggestion_status };
  let changed = false;

  for (const [suggestionId, status] of Object.entries(state.suggestion_status)) {
    if (status !== "applied") continue;
    const hasDirectLink = state.generated_items.some(
      (i) => i.source_suggestion_id === suggestionId,
    );
    if (hasDirectLink) continue;
    delete next[suggestionId];
    changed = true;
  }

  if (!changed) return state;
  return { ...state, suggestion_status: next };
}

export function loadMailroomState(): MailroomState {
  const shaped = ensureShape(readMockLs<MailroomState>(MOCK_LS.mailroomState));
  return reconcileSuggestionStatus(shaped);
}

export function saveMailroomState(state: MailroomState): void {
  writeMockLs(MOCK_LS.mailroomState, state);
}

export function connectMockGmail(email: string): MailroomState {
  const state = { ...loadMailroomState(), oauth_connected: true, connected_email: email };
  saveMailroomState(state);
  return state;
}

export function disconnectMockGmail(): MailroomState {
  const state = { ...loadMailroomState(), oauth_connected: false, connected_email: null };
  saveMailroomState(state);
  return state;
}

export function setSuggestionStatus(id: string, status: AgentSuggestionStatus): MailroomState {
  const state = loadMailroomState();
  state.suggestion_status = { ...state.suggestion_status, [id]: status };
  saveMailroomState(state);
  return state;
}

export function setThreadStatus(id: string, status: EmailThreadStatus): MailroomState {
  const state = loadMailroomState();
  state.thread_status = { ...state.thread_status, [id]: status };
  saveMailroomState(state);
  return state;
}

export function addGeneratedItem(item: GeneratedItem): MailroomState {
  const state = loadMailroomState();
  state.generated_items = [...state.generated_items, item];
  saveMailroomState(state);
  return state;
}

export function removeGeneratedItem(id: string): MailroomState {
  const prev = loadMailroomState();
  const removed = prev.generated_items.find((i) => i.id === id);
  if (!removed) return prev;

  const generated_items = prev.generated_items.filter((i) => i.id !== id);

  const nextOutbox: MailroomState["outbox"] = {};
  for (const [threadId, messages] of Object.entries(prev.outbox)) {
    nextOutbox[threadId] = messages.map((msg) => {
      if (!msg.attachments?.some((a) => a.source_id === id)) return msg;
      const attachments = msg.attachments.filter((a) => a.source_id !== id);
      return attachments.length > 0 ? { ...msg, attachments } : { ...msg, attachments: undefined };
    });
  }

  const suggestionIds = suggestionIdsToResetForRemovedItem(prev, removed);
  const nextSuggestionStatus = { ...prev.suggestion_status };
  for (const suggestionId of suggestionIds) {
    const stillHasSibling = generated_items.some(
      (i) => i.source_suggestion_id === suggestionId,
    );
    if (!stillHasSibling) {
      delete nextSuggestionStatus[suggestionId];
    }
  }

  const state: MailroomState = {
    ...prev,
    generated_items,
    outbox: nextOutbox,
    suggestion_status: nextSuggestionStatus,
  };

  saveMailroomState(state);
  return state;
}

export function appendChat(msg: AgentChatMessage): MailroomState {
  const state = loadMailroomState();
  const list = state.chat[msg.thread_id] ?? [];
  state.chat = { ...state.chat, [msg.thread_id]: [...list, msg] };
  saveMailroomState(state);
  return state;
}

export function addCustomSuggestion(s: AgentSuggestion): MailroomState {
  const state = loadMailroomState();
  state.custom_suggestions = [...state.custom_suggestions, s];
  saveMailroomState(state);
  return state;
}

export function addPromotedThread(
  thread: EmailThread,
  sourceConversationId?: number,
): MailroomState {
  const state = loadMailroomState();
  state.promoted_threads = [...state.promoted_threads, thread];
  if (sourceConversationId != null) {
    state.message_links = { ...state.message_links, [sourceConversationId]: thread.id };
  }
  saveMailroomState(state);
  return state;
}

export function getPromotedMailroomIdForConversation(conversationId: number): string | null {
  const state = loadMailroomState();
  return state.message_links[conversationId] ?? null;
}

export function markThreadSummarized(thread_id: string): MailroomState {
  const state = loadMailroomState();
  state.summarized_threads = { ...state.summarized_threads, [thread_id]: true };
  saveMailroomState(state);
  return state;
}

export function appendOutboundReply(thread_id: string, msg: EmailMessage): MailroomState {
  const state = loadMailroomState();
  const list = state.outbox[thread_id] ?? [];
  state.outbox = { ...state.outbox, [thread_id]: [...list, msg] };
  saveMailroomState(state);
  return state;
}
