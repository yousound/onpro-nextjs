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
  MailroomWorkflow,
  MailroomRfqIntake,
} from "@/lib/types/agent";
import { applyIntakeToWorkflow } from "@/lib/mailroom/rfq-intake";

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
    thread_summaries: {},
    promoted_threads: [],
    message_links: {},
    removed_suggestion_ids: [],
    workflows: {},
    rfq_intake: {},
    rfq_plan_panel_open: {},
    workflow_plan_panel_open: {},
    mailroom_fresh_summarize: {},
  };
}

export function isSuggestionRemoved(state: MailroomState, id: string): boolean {
  return (state.removed_suggestion_ids ?? []).includes(id);
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
    thread_summaries: state.thread_summaries ?? {},
    promoted_threads: state.promoted_threads ?? [],
    message_links: state.message_links ?? {},
    removed_suggestion_ids: state.removed_suggestion_ids ?? [],
    workflows: state.workflows ?? {},
    rfq_intake: state.rfq_intake ?? {},
    rfq_plan_panel_open: state.rfq_plan_panel_open ?? {},
    workflow_plan_panel_open: state.workflow_plan_panel_open ?? {},
    mailroom_fresh_summarize: state.mailroom_fresh_summarize ?? {},
  };
}

export function setRfqPlanPanelOpen(threadId: string, open: boolean): MailroomState {
  const state = loadMailroomState();
  state.rfq_plan_panel_open = { ...state.rfq_plan_panel_open, [threadId]: open };
  saveMailroomState(state);
  return state;
}

export function setWorkflowPlanPanelOpen(threadId: string, open: boolean): MailroomState {
  const state = loadMailroomState();
  state.workflow_plan_panel_open = { ...state.workflow_plan_panel_open, [threadId]: open };
  saveMailroomState(state);
  return state;
}

/** Permanently remove a suggestion from Mailroom UI (chat cards, counts, seeded re-list). */
export function removeSuggestion(id: string): MailroomState {
  const prev = loadMailroomState();
  const removedSet = new Set(prev.removed_suggestion_ids ?? []);
  removedSet.add(id);

  const suggestion_status = { ...prev.suggestion_status };
  delete suggestion_status[id];

  const custom_suggestions = prev.custom_suggestions.filter((s) => s.id !== id);

  const chat: MailroomState["chat"] = {};
  for (const [threadId, messages] of Object.entries(prev.chat)) {
    chat[threadId] = messages.map((m) => {
      if (!m.proposed_suggestion_ids?.includes(id)) return m;
      const proposed_suggestion_ids = m.proposed_suggestion_ids.filter((sid) => sid !== id);
      return {
        ...m,
        proposed_suggestion_ids:
          proposed_suggestion_ids.length > 0 ? proposed_suggestion_ids : undefined,
      };
    });
  }

  const state: MailroomState = {
    ...prev,
    removed_suggestion_ids: [...removedSet],
    suggestion_status,
    custom_suggestions,
    chat,
  };
  saveMailroomState(state);
  return state;
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
  const removed = new Set(state.removed_suggestion_ids ?? []);
  let changed = false;

  for (const [suggestionId, status] of Object.entries(state.suggestion_status)) {
    if (status === "dismissed") {
      removed.add(suggestionId);
      delete next[suggestionId];
      changed = true;
      continue;
    }
    if (status !== "applied") continue;
    const hasDirectLink = state.generated_items.some(
      (i) => i.source_suggestion_id === suggestionId,
    );
    if (hasDirectLink) continue;
    delete next[suggestionId];
    changed = true;
  }

  if (!changed && removed.size === (state.removed_suggestion_ids ?? []).length) return state;
  return {
    ...state,
    suggestion_status: next,
    removed_suggestion_ids: [...removed],
  };
}

export function projectIdFromMailroomDeepLink(deepLink?: string | null): number | undefined {
  if (!deepLink?.startsWith("/projects/")) return undefined;
  const m = /^\/projects\/(\d+)/.exec(deepLink);
  if (!m) return undefined;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : undefined;
}

function generatedItemReferencesDeletedProject(
  item: GeneratedItem,
  deleted: ReadonlySet<number>,
): boolean {
  const fromLink = projectIdFromMailroomDeepLink(item.deepLink);
  if (fromLink != null && deleted.has(fromLink)) return true;
  const raw = item.payload.project_id ?? item.payload.projectId;
  const payloadId =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw)
        ? Number(raw)
        : undefined;
  return payloadId != null && deleted.has(payloadId);
}

function collectWorkflowStepsToReset(
  workflow: MailroomWorkflow,
  deleted: ReadonlySet<number>,
): Set<string> {
  const toReset = new Set<string>();
  for (const step of workflow.steps) {
    if (step.applied_project_id != null && deleted.has(step.applied_project_id)) {
      toReset.add(step.step_id);
    }
  }
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const step of workflow.steps) {
      if (step.status !== "applied" || toReset.has(step.step_id)) continue;
      if (step.depends_on?.some((dep) => toReset.has(dep))) {
        toReset.add(step.step_id);
        expanded = true;
      }
    }
  }
  return toReset;
}

function resetWorkflowForDeletedProjects(
  workflow: MailroomWorkflow,
  deleted: ReadonlySet<number>,
): MailroomWorkflow {
  const toReset = collectWorkflowStepsToReset(workflow, deleted);
  const clearLink =
    workflow.link_existing_project_id != null &&
    deleted.has(workflow.link_existing_project_id);
  const clearMatch =
    workflow.project_match.project_id != null &&
    deleted.has(workflow.project_match.project_id);

  if (toReset.size === 0 && !clearLink && !clearMatch) return workflow;

  return {
    ...workflow,
    link_existing_project_id: clearLink ? null : workflow.link_existing_project_id,
    project_match: clearMatch
      ? { confidence: "none", reason: "" }
      : workflow.project_match,
    steps: workflow.steps.map((step) => {
      if (!toReset.has(step.step_id)) return step;
      return {
        ...step,
        status: "pending",
        applied_project_id: undefined,
        applied_job_id: undefined,
      };
    }),
  };
}

function notifyMailroomStateChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("onpro-mailroom-state-changed"));
  }
}

/** Drop drafts + rewind workflow steps when workspace projects are deleted. */
export function pruneMailroomStateForDeletedProjects(
  deletedProjectIds: number[],
): MailroomState {
  const deleted = new Set(deletedProjectIds.filter((id) => Number.isFinite(id)));
  if (deleted.size === 0) return loadMailroomState();

  const prev = loadMailroomState();
  const generated_items = prev.generated_items.filter(
    (item) => !generatedItemReferencesDeletedProject(item, deleted),
  );

  const suggestion_status = { ...prev.suggestion_status };
  const workflows: MailroomState["workflows"] = { ...prev.workflows };

  for (const [threadId, workflow] of Object.entries(workflows)) {
    const nextWorkflow = resetWorkflowForDeletedProjects(workflow, deleted);
    if (nextWorkflow === workflow) continue;
    workflows[threadId] = nextWorkflow;
    for (const step of nextWorkflow.steps) {
      const before = workflow.steps.find((s) => s.step_id === step.step_id);
      if (before?.status === "applied" && step.status === "pending") {
        delete suggestion_status[step.suggestion_id];
      }
    }
  }

  const state = reconcileSuggestionStatus({
    ...prev,
    generated_items,
    workflows,
    suggestion_status,
  });
  saveMailroomState(state);
  notifyMailroomStateChanged();
  return state;
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

/** Threads promoted from Messages (not Gmail inbox sync). */
export function isPromotedInAppThread(thread: EmailThread): boolean {
  return thread.channel === "in_app";
}

export function canRemoveThreadFromMailroom(
  thread: EmailThread,
  state?: MailroomState,
): boolean {
  const s = state ?? loadMailroomState();
  return s.promoted_threads.some((t) => t.id === thread.id);
}

/** Remove a promoted in-app thread and all local agent state for it. */
export function removePromotedThreadFromMailroom(threadId: string): MailroomState {
  const prev = loadMailroomState();
  if (!prev.promoted_threads.some((t) => t.id === threadId)) {
    return prev;
  }

  const message_links: Record<number, string> = {};
  for (const [key, value] of Object.entries(prev.message_links)) {
    if (value !== threadId) message_links[Number(key)] = value;
  }

  const { [threadId]: _chat, ...chat } = prev.chat;
  const { [threadId]: _out, ...outbox } = prev.outbox;
  const { [threadId]: _sum, ...summarized_threads } = prev.summarized_threads;
  const { [threadId]: _summary, ...thread_summaries } = prev.thread_summaries ?? {};
  const { [threadId]: _st, ...thread_status } = prev.thread_status;

  const removedSuggestionIds = new Set(
    prev.custom_suggestions.filter((s) => s.thread_id === threadId).map((s) => s.id),
  );

  const suggestion_status = { ...prev.suggestion_status };
  for (const id of Object.keys(suggestion_status)) {
    if (removedSuggestionIds.has(id)) delete suggestion_status[id];
  }

  const state: MailroomState = {
    ...prev,
    promoted_threads: prev.promoted_threads.filter((t) => t.id !== threadId),
    message_links,
    chat,
    outbox,
    summarized_threads,
    thread_summaries,
    thread_status,
    generated_items: prev.generated_items.filter((i) => i.thread_id !== threadId),
    custom_suggestions: prev.custom_suggestions.filter((s) => s.thread_id !== threadId),
    suggestion_status,
    workflows: Object.fromEntries(
      Object.entries(prev.workflows ?? {}).filter(([id]) => id !== threadId),
    ),
  };

  saveMailroomState(state);
  notifyMailroomStateChanged();
  return state;
}

export function markThreadSummarized(thread_id: string): MailroomState {
  const state = loadMailroomState();
  state.summarized_threads = { ...state.summarized_threads, [thread_id]: true };
  saveMailroomState(state);
  return state;
}

export function saveThreadSummary(thread_id: string, summary: string): MailroomState {
  const state = loadMailroomState();
  state.thread_summaries = { ...state.thread_summaries, [thread_id]: summary.trim() };
  saveMailroomState(state);
  return state;
}

/** Remove all AI artifacts for a thread (workflow, drafts, summary, RFQ) — start fresh. */
export function clearMailroomFreshSummarizeFlag(threadId: string): MailroomState {
  const state = loadMailroomState();
  if (!state.mailroom_fresh_summarize?.[threadId]) return state;
  const { [threadId]: _flag, ...mailroom_fresh_summarize } = state.mailroom_fresh_summarize;
  state.mailroom_fresh_summarize = mailroom_fresh_summarize;
  saveMailroomState(state);
  return state;
}

export function clearThreadMailroomAiResults(threadId: string): MailroomState {
  const prev = loadMailroomState();

  const removedSuggestionIds = new Set(
    prev.custom_suggestions.filter((s) => s.thread_id === threadId).map((s) => s.id),
  );
  for (const step of prev.workflows[threadId]?.steps ?? []) {
    removedSuggestionIds.add(step.suggestion_id);
  }

  const suggestion_status = { ...prev.suggestion_status };
  for (const id of removedSuggestionIds) {
    delete suggestion_status[id];
  }

  const { [threadId]: _chat, ...chat } = prev.chat;
  const { [threadId]: _sum, ...summarized_threads } = prev.summarized_threads;
  const { [threadId]: _summary, ...thread_summaries } = prev.thread_summaries ?? {};
  const { [threadId]: _rfq, ...rfq_intake } = prev.rfq_intake ?? {};
  const { [threadId]: _rfqOpen, ...rfq_plan_panel_open } = prev.rfq_plan_panel_open ?? {};
  const { [threadId]: _wfOpen, ...workflow_plan_panel_open } =
    prev.workflow_plan_panel_open ?? {};
  const { [threadId]: _workflow, ...workflows } = prev.workflows ?? {};

  const state: MailroomState = {
    ...prev,
    chat,
    summarized_threads,
    thread_summaries,
    rfq_intake,
    rfq_plan_panel_open,
    workflow_plan_panel_open,
    mailroom_fresh_summarize: {
      ...prev.mailroom_fresh_summarize,
      [threadId]: true,
    },
    workflows,
    generated_items: prev.generated_items.filter((i) => i.thread_id !== threadId),
    custom_suggestions: prev.custom_suggestions.filter((s) => s.thread_id !== threadId),
    suggestion_status,
  };

  saveMailroomState(state);
  notifyMailroomStateChanged();
  return state;
}

/** Clear workflow + agent suggestions before re-summarizing a thread. */
export function resetThreadSummarizeArtifacts(thread_id: string): MailroomState {
  const prev = loadMailroomState();
  const removedIds = new Set(
    prev.custom_suggestions.filter((s) => s.thread_id === thread_id).map((s) => s.id),
  );

  const suggestion_status = { ...prev.suggestion_status };
  for (const id of removedIds) {
    delete suggestion_status[id];
  }

  const { [thread_id]: _workflow, ...workflows } = prev.workflows ?? {};

  const state: MailroomState = {
    ...prev,
    custom_suggestions: prev.custom_suggestions.filter((s) => s.thread_id !== thread_id),
    suggestion_status,
    workflows,
  };
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

export function saveMailroomWorkflow(workflow: MailroomWorkflow): MailroomState {
  const state = loadMailroomState();
  let next = workflow;
  const intake = state.rfq_intake?.[workflow.thread_id];
  if (intake?.confirmed_at) {
    next = applyIntakeToWorkflow(workflow, intake);
  }
  state.workflows = { ...state.workflows, [workflow.thread_id]: next };
  saveMailroomState(state);
  return state;
}

export function saveRfqIntakeDraft(
  threadId: string,
  draft: MailroomRfqIntake,
): MailroomState {
  const state = loadMailroomState();
  state.rfq_intake = { ...state.rfq_intake, [threadId]: draft };
  saveMailroomState(state);
  return state;
}

export function confirmRfqIntake(
  threadId: string,
  draft: MailroomRfqIntake,
  confirmedAt: string,
): MailroomState {
  const state = loadMailroomState();
  const confirmed: MailroomRfqIntake = { ...draft, confirmed_at: confirmedAt };
  state.rfq_intake = { ...state.rfq_intake, [threadId]: confirmed };
  const workflow = state.workflows[threadId];
  if (workflow) {
    state.workflows = {
      ...state.workflows,
      [threadId]: applyIntakeToWorkflow(workflow, confirmed),
    };
  }
  saveMailroomState(state);
  return state;
}

export function clearRfqIntakeConfirmation(threadId: string): MailroomState {
  const state = loadMailroomState();
  const cur = state.rfq_intake?.[threadId];
  if (!cur) return state;
  state.rfq_intake = {
    ...state.rfq_intake,
    [threadId]: { ...cur, confirmed_at: null },
  };
  saveMailroomState(state);
  return state;
}

export function getMailroomWorkflow(threadId: string): MailroomWorkflow | undefined {
  return loadMailroomState().workflows[threadId];
}

export function updateMailroomWorkflow(
  threadId: string,
  updater: (workflow: MailroomWorkflow) => MailroomWorkflow,
): MailroomState {
  const state = loadMailroomState();
  const current = state.workflows[threadId];
  if (!current) return state;
  state.workflows = { ...state.workflows, [threadId]: updater(current) };
  saveMailroomState(state);
  return state;
}

/** Patch workflow on an in-memory mailroom state (avoids stale loadMailroomState). */
export function updateMailroomWorkflowInState(
  state: MailroomState,
  threadId: string,
  updater: (workflow: MailroomWorkflow) => MailroomWorkflow,
): MailroomState {
  const current = state.workflows[threadId];
  if (!current) return state;
  const next: MailroomState = {
    ...state,
    workflows: { ...state.workflows, [threadId]: updater(current) },
  };
  saveMailroomState(next);
  return next;
}

export function linkWorkflowToExistingProject(
  state: MailroomState,
  threadId: string,
  projectId: number,
): MailroomState {
  return updateMailroomWorkflowInState(state, threadId, (wf) => ({
    ...wf,
    link_existing_project_id: projectId,
    project_match: {
      project_id: projectId,
      confidence: "high",
      reason: wf.project_match.reason?.trim() || "Using existing workspace project.",
    },
    steps: wf.steps.map((step) =>
      step.kind === "create_project" && step.status === "pending"
        ? { ...step, status: "skipped" as const }
        : step,
    ),
  }));
}

export function unlinkWorkflowFromExistingProject(
  state: MailroomState,
  threadId: string,
): MailroomState {
  return updateMailroomWorkflowInState(state, threadId, (wf) => ({
    ...wf,
    link_existing_project_id: null,
    steps: wf.steps.map((step) =>
      step.kind === "create_project" &&
      step.status === "skipped" &&
      step.applied_project_id == null
        ? { ...step, status: "pending" as const }
        : step,
    ),
  }));
}

export function setWorkflowProjectLink(
  threadId: string,
  projectId: number | null,
): MailroomState {
  const state = loadMailroomState();
  if (projectId == null) {
    return unlinkWorkflowFromExistingProject(state, threadId);
  }
  return linkWorkflowToExistingProject(state, threadId, projectId);
}
