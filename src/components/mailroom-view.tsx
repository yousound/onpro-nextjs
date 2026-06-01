"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type {
  AgentChatMessage,
  AgentSuggestion,
  AgentSuggestionKind,
  EmailAttachment,
  EmailMessage,
  EmailThread,
  GeneratedItem,
  GeneratedItemKind,
  MailroomState,
} from "@/lib/types/agent";
import {
  MOCK_EMAIL_THREADS,
  suggestionsForThread,
} from "@/lib/mock/email-threads";
import {
  addCustomSuggestion,
  addGeneratedItem,
  appendChat,
  appendOutboundReply,
  connectMockGmail,
  disconnectMockGmail,
  loadMailroomState,
  markThreadSummarized,
  removeGeneratedItem,
  resolveSuggestionStatus,
  setSuggestionStatus,
  setThreadStatus,
} from "@/lib/mailroom-state";
import { applySuggestion, generatedItemFromSuggestion, generatedKindFromSuggestion } from "@/lib/agent-apply";

const CATEGORY_DOT: Record<NonNullable<EmailThread["category"]>, string> = {
  vendor_quote: "bg-violet-500",
  client: "bg-emerald-500",
  shipping: "bg-amber-500",
  internal: "bg-slate-500",
  other: "bg-blue-400",
};

const CATEGORY_LABEL: Record<NonNullable<EmailThread["category"]>, string> = {
  vendor_quote: "Vendor",
  client: "Client",
  shipping: "Shipping",
  internal: "Internal",
  other: "Other",
};

const GENERATED_SECTIONS: ReadonlyArray<{ kind: GeneratedItemKind; label: string }> = [
  { kind: "project", label: "Projects" },
  { kind: "job", label: "Jobs" },
  { kind: "estimate", label: "Estimates" },
  { kind: "invoice", label: "Invoices" },
  { kind: "vendor_quote", label: "Vendor quotes" },
  { kind: "costing_line", label: "Costing lines" },
  { kind: "client_po", label: "Client POs" },
  { kind: "sample", label: "Sample milestones" },
  { kind: "packing_list", label: "Packing lists" },
  { kind: "task", label: "Tasks" },
];

const SECTION_BADGE: Record<GeneratedItemKind, string> = {
  project: "bg-emerald-100 text-emerald-800",
  job: "bg-violet-100 text-violet-800",
  estimate: "bg-indigo-100 text-indigo-800",
  invoice: "bg-amber-100 text-amber-900",
  vendor_quote: "bg-sky-100 text-sky-800",
  costing_line: "bg-pink-100 text-pink-800",
  client_po: "bg-fuchsia-100 text-fuchsia-800",
  sample: "bg-cyan-100 text-cyan-800",
  packing_list: "bg-teal-100 text-teal-800",
  task: "bg-slate-100 text-slate-700",
};

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / (60 * 1000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(ms / (60 * 60 * 1000));
  if (h < 24) return `${h}h`;
  const d = Math.round(ms / (24 * 60 * 60 * 1000));
  return `${d}d`;
}

function markdownLite(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}

function summarize(thread: EmailThread): string {
  const last = thread.messages[thread.messages.length - 1];
  if (!last) return "";
  const flat = last.body.replace(/\n/g, " ").replace(/\*\*/g, "");
  return flat.length > 220 ? `${flat.slice(0, 220)}…` : flat;
}

function detectEntities(thread: EmailThread): string[] {
  const text = thread.messages.map((m) => m.body).join("\n");
  const found = new Set<string>();
  for (const match of text.matchAll(/\$([0-9]+(?:\.[0-9]+)?)(?:\/ea)?/g)) {
    found.add(`Price $${match[1]}`);
  }
  for (const match of text.matchAll(/\b([A-Z]{2,4}-?\d{2,5}(?:-?\d{2,5})?)\b/g)) {
    found.add(`Ref ${match[1]}`);
  }
  for (const match of text.matchAll(/\b(\d{2,3})\s*ea\b/gi)) {
    found.add(`Qty ${match[1]}`);
  }
  if (/tracking|DHL|FedEx|UPS/i.test(text)) found.add("Tracking");
  if (/PO\s*[#:]?\s*[A-Z0-9-]+/i.test(text)) found.add("PO");
  if (/sample/i.test(text)) found.add("Sample milestone");
  return [...found].slice(0, 8);
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeAgentChat(thread_id: string, text: string, proposed?: string[]): AgentChatMessage {
  return {
    id: makeId("chat"),
    thread_id,
    role: "agent",
    text,
    at: nowIso(),
    proposed_suggestion_ids: proposed,
  };
}

function makeUserChat(thread_id: string, text: string): AgentChatMessage {
  return { id: makeId("chat"), thread_id, role: "user", text, at: nowIso() };
}

function detectChatIntent(text: string): {
  kind: AgentSuggestionKind | null;
  reply: string;
  applyAll?: boolean;
} {
  const t = text.toLowerCase();
  if (/(^|\W)(go ahead|apply|do it|generate (?:them|all)|yes|sounds good)(\W|$)/.test(t)) {
    return { kind: null, reply: "On it — applying the pending suggestions on the right.", applyAll: true };
  }
  if (/project/.test(t)) return { kind: "create_project", reply: "I'll draft a project for this thread. See the right panel." };
  if (/estimate/.test(t)) return { kind: "generate_estimate", reply: "Drafting an estimate based on the latest costing." };
  if (/invoice/.test(t)) return { kind: "create_invoice", reply: "Queueing an invoice draft." };
  if (/\bjob\b/.test(t)) return { kind: "create_job", reply: "I'll add a job draft to the project." };
  if (/quote|cost(?:ing)?/.test(t)) return { kind: "add_vendor_quote", reply: "Got it — I'll capture the vendor quote." };
  if (/p(?:urchase)? ?o(?:rder)?|client po/.test(t)) return { kind: "update_client_po", reply: "I'll set the client PO on the relevant job." };
  if (/sample|strike[- ]off/.test(t)) return { kind: "update_sample_milestone", reply: "I'll mark the sample milestone for you." };
  if (/packing/.test(t)) return { kind: "log_packing_list", reply: "I'll adjust the packing list variant." };
  if (/task|todo|remind/.test(t)) return { kind: "team_note", reply: "Adding a task for the team." };
  return { kind: null, reply: "Got it. Want me to apply the pending suggestions on the right?" };
}

function suggestionForKind(thread: EmailThread, kind: AgentSuggestionKind): AgentSuggestion {
  const baseTitle = {
    create_project: `Create project from "${thread.subject}"`,
    create_job: "Add a job draft to this project",
    add_vendor_quote: `Capture vendor quote from ${thread.related?.vendor ?? "vendor"}`,
    add_costing_line: "Add a costing line",
    generate_estimate: "Generate an estimate",
    create_invoice: "Draft an invoice",
    update_client_po: "Set client PO from this thread",
    update_sample_milestone: "Update a sample milestone",
    log_packing_list: "Update the packing list variant",
    team_note: "Add a task for the team",
  }[kind];
  return {
    id: makeId("sug"),
    thread_id: thread.id,
    kind,
    title: baseTitle,
    payload: thread.related ?? {},
    status: "pending",
    created_at: nowIso(),
  };
}

export function MailroomView() {
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("thread");
  const [state, setState] = useState<MailroomState | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    requestedThreadId ?? MOCK_EMAIL_THREADS[0]?.id ?? null,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<GeneratedItem | null>(null);
  const [showAllThreads, setShowAllThreads] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<EmailAttachment[]>([]);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);
  const [pane, setPane] = useState<"chat" | "emails">("chat");
  const [previewSuggestion, setPreviewSuggestion] = useState<AgentSuggestion | null>(null);

  function attachmentFromItem(i: GeneratedItem): EmailAttachment {
    return {
      id: makeId("att"),
      kind: i.kind,
      source_id: i.id,
      label: i.title,
      deepLink: i.deepLink,
    };
  }

  function attachToReply(i: GeneratedItem, opts?: { switchToEmails?: boolean }) {
    setPendingAttachments((prev) => {
      if (prev.some((a) => a.source_id === i.id)) return prev;
      return [...prev, attachmentFromItem(i)];
    });
    if (opts?.switchToEmails !== false) setPane("emails");
    setToast(`Attached "${i.title}" to reply.`);
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleRemoveGeneratedItem(item: GeneratedItem) {
    setState(() => removeGeneratedItem(item.id));
    setPendingAttachments((prev) => prev.filter((a) => a.source_id !== item.id));
    setToast(
      item.source_suggestion_id
        ? `Removed. You can generate “${item.title}” again from the agent chat.`
        : "Removed.",
    );
  }

  // Reset pending attachments + pane state when switching threads.
  useEffect(() => {
    setPendingAttachments([]);
    setAttachPickerOpen(false);
    setPreviewSuggestion(null);
    setPane("chat");
  }, [selectedThreadId]);

  useEffect(() => {
    const loaded = loadMailroomState();
    setState(loaded);
    // If we landed here via ?thread=… and the thread is a promoted one, select it once state hydrates.
    if (requestedThreadId) {
      const knownIds = new Set([
        ...MOCK_EMAIL_THREADS.map((t) => t.id),
        ...loaded.promoted_threads.map((t) => t.id),
      ]);
      if (knownIds.has(requestedThreadId)) setSelectedThreadId(requestedThreadId);
    }
  }, [requestedThreadId]);

  const threads = useMemo(() => {
    const seed = state ? state.promoted_threads : [];
    const merged = [...seed, ...MOCK_EMAIL_THREADS];
    if (!state) return merged;
    return merged.map((t) => ({
      ...t,
      status: state.thread_status[t.id] ?? t.status,
    }));
  }, [state]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? threads[0] ?? null,
    [threads, selectedThreadId],
  );

  const allSuggestionsForThread = useMemo<AgentSuggestion[]>(() => {
    if (!selectedThread) return [];
    const seeded = suggestionsForThread(selectedThread);
    const custom = state?.custom_suggestions?.filter((s) => s.thread_id === selectedThread.id) ?? [];
    const merged = [...seeded, ...custom];
    if (!state) return merged;
    return merged.map((s) => ({
      ...s,
      status: resolveSuggestionStatus(s, state.suggestion_status, state.generated_items),
    }));
  }, [selectedThread, state]);

  const pendingSuggestions = useMemo(
    () => allSuggestionsForThread.filter((s) => s.status === "pending"),
    [allSuggestionsForThread],
  );

  const pendingTotal = useMemo(() => {
    if (!state) return 0;
    let n = 0;
    for (const t of threads) {
      if (!state.summarized_threads?.[t.id]) continue;
      const all = [
        ...suggestionsForThread(t),
        ...(state.custom_suggestions?.filter((s) => s.thread_id === t.id) ?? []),
      ];
      for (const s of all) {
        if (
          resolveSuggestionStatus(s, state.suggestion_status, state.generated_items) === "pending"
        ) {
          n += 1;
        }
      }
    }
    return n;
  }, [threads, state]);

  const summarized = selectedThread
    ? Boolean(state?.summarized_threads?.[selectedThread.id])
    : false;

  function handleSummarize() {
    if (!selectedThread) return;
    const seeded = suggestionsForThread(selectedThread);
    const intro = `Here's what I'm seeing in this thread: ${summarize(selectedThread)}${
      seeded.length > 0
        ? ` I have ${seeded.length} suggested action${seeded.length === 1 ? "" : "s"} ready — review them in chat, or tell me what to do.`
        : " Tell me what you'd like to do."
    }`;
    markThreadSummarized(selectedThread.id);
    const msg = makeAgentChat(
      selectedThread.id,
      intro,
      seeded.map((s) => s.id),
    );
    setState(appendChat(msg));
  }

  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-secondary">
        Loading mailroom…
      </div>
    );
  }

  if (!state.oauth_connected) {
    return (
      <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
        <p className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
          Beta · Front-end mock
        </p>
        <h2 className="text-2xl font-bold text-text-primary">Connect your inbox</h2>
        <p className="text-sm text-text-secondary">
          The mailroom agent reads vendor quotes, client POs, sample updates, and shipping
          notifications, then drafts OnPro entries for you to review.
        </p>
        <button
          type="button"
          onClick={() => setState(connectMockGmail("ric@connectdots.la"))}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Connect Gmail (mock)
        </button>
        <p className="text-[11px] text-text-secondary">
          No real OAuth in this mock — we&apos;ll persist a fake session locally.
        </p>
      </div>
    );
  }

  function handleSelectThread(t: EmailThread) {
    setSelectedThreadId(t.id);
    if (t.status === "unread") {
      setState(setThreadStatus(t.id, "read"));
    }
  }

  function applyOneWith(
    s: AgentSuggestion,
    override?: { title?: string; payload?: Record<string, unknown> },
  ): GeneratedItem | null {
    const effective: AgentSuggestion = {
      ...s,
      title: override?.title ?? s.title,
      payload: override?.payload ?? s.payload,
    };
    const result = applySuggestion(effective);
    if (!result.ok) {
      setToast(result.message);
      return null;
    }
    let next = setSuggestionStatus(s.id, "applied");
    const item = generatedItemFromSuggestion(effective, result);
    next = addGeneratedItem(item);
    const ack = makeAgentChat(
      s.thread_id,
      `Created **${labelForKind(item.kind)}** — “${item.title}”. Open it on the right.`,
    );
    next = appendChat(ack);
    setState(next);
    setToast(result.message);
    return item;
  }

  function applyOne(s: AgentSuggestion) {
    applyOneWith(s);
  }

  function dismissOne(s: AgentSuggestion) {
    setState(setSuggestionStatus(s.id, "dismissed"));
  }

  function handleSendMessage(text: string) {
    if (!selectedThread) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setState(appendChat(makeUserChat(selectedThread.id, trimmed)));
    const intent = detectChatIntent(trimmed);

    if (intent.applyAll) {
      // Apply all currently pending suggestions in this thread.
      const toApply = pendingSuggestions;
      if (toApply.length === 0) {
        setState(appendChat(makeAgentChat(selectedThread.id, "Nothing pending right now.")));
        return;
      }
      // Apply sequentially, batching updates by re-reading state.
      for (const s of toApply) {
        const result = applySuggestion(s);
        if (!result.ok) continue;
        setSuggestionStatus(s.id, "applied");
        addGeneratedItem(generatedItemFromSuggestion(s, result));
      }
      const next = appendChat(makeAgentChat(
        selectedThread.id,
        `Applied ${toApply.length} suggestion${toApply.length === 1 ? "" : "s"}. They're on the right.`,
      ));
      setState(next);
      return;
    }

    if (intent.kind) {
      const newSug = suggestionForKind(selectedThread, intent.kind);
      addCustomSuggestion(newSug);
      const next = appendChat(makeAgentChat(selectedThread.id, intent.reply, [newSug.id]));
      setState(next);
      return;
    }

    setState(appendChat(makeAgentChat(selectedThread.id, intent.reply)));
  }

  const chatMessages = state.chat[selectedThread?.id ?? ""] ?? [];
  const generatedForThread = selectedThread
    ? state.generated_items.filter((i) => i.thread_id === selectedThread.id)
    : [];
  const generatedToShow = showAllThreads ? state.generated_items : generatedForThread;
  const suggestionById = new Map(allSuggestionsForThread.map((s) => [s.id, s]));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-light bg-surface-body/40 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            Mailroom is listening — {state.connected_email}
          </span>
          {pendingTotal > 0 ? (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
              {pendingTotal} pending suggestion{pendingTotal === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setState(disconnectMockGmail())}
          className="text-[11px] font-semibold text-text-secondary hover:text-accent hover:underline"
        >
          Disconnect
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)] divide-x divide-border-light">
        <ThreadList
          threads={threads}
          selectedId={selectedThread?.id ?? null}
          onSelect={handleSelectThread}
          suggestionCounts={suggestionCountsByThread(threads, state)}
        />
        <ConversationPane
          thread={selectedThread}
          chat={chatMessages}
          outbox={selectedThread ? state.outbox[selectedThread.id] ?? [] : []}
          suggestionById={suggestionById}
          connectedEmail={state.connected_email ?? "you@onpro.app"}
          pendingAttachments={pendingAttachments}
          onRemoveAttachment={removeAttachment}
          onOpenAttachmentPicker={() => setAttachPickerOpen(true)}
          summarized={summarized}
          onSummarize={handleSummarize}
          pane={pane}
          onPaneChange={setPane}
          onPreview={(s) => setPreviewSuggestion(s)}
          onApply={applyOne}
          onDismiss={dismissOne}
          onSend={handleSendMessage}
          onReply={(body) => {
            if (!selectedThread) return;
            const fromEmail = state.connected_email ?? "you@onpro.app";
            const msg: EmailMessage = {
              id: makeId("out"),
              from: { name: "You", email: fromEmail },
              at: nowIso(),
              body,
              attachments: pendingAttachments.length > 0 ? pendingAttachments : undefined,
            };
            const next = appendOutboundReply(selectedThread.id, msg);
            setState(next);
            setPendingAttachments([]);
            setToast(
              pendingAttachments.length > 0
                ? `Reply sent with ${pendingAttachments.length} attachment${pendingAttachments.length === 1 ? "" : "s"} (mock).`
                : "Reply sent (mock).",
            );
          }}
        />
        <GeneratedItemsPanel
          items={generatedToShow}
          showAllThreads={showAllThreads}
          onToggleScope={() => setShowAllThreads((v) => !v)}
          onOpenItem={(i) => {
            if (i.deepLink) window.location.assign(i.deepLink);
            else setViewItem(i);
          }}
          onRemove={handleRemoveGeneratedItem}
          onAttach={selectedThread ? (i) => attachToReply(i, { switchToEmails: true }) : undefined}
          attachedSourceIds={new Set(pendingAttachments.map((a) => a.source_id))}
        />
      </div>

      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-text-primary px-4 py-2 text-xs font-semibold text-white shadow-xl">
            {toast}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded px-2 py-0.5 text-[10px] uppercase ring-1 ring-white/30 hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {viewItem ? (
        <GeneratedItemDetailModal item={viewItem} onClose={() => setViewItem(null)} />
      ) : null}

      {previewSuggestion ? (
        <DocPreviewModal
          suggestion={previewSuggestion}
          onClose={() => setPreviewSuggestion(null)}
          onSave={(title, payload) => {
            applyOneWith(previewSuggestion, { title, payload });
            setPreviewSuggestion(null);
          }}
          onSaveAndAttach={(title, payload) => {
            const item = applyOneWith(previewSuggestion, { title, payload });
            if (item) attachToReply(item, { switchToEmails: true });
            setPreviewSuggestion(null);
          }}
        />
      ) : null}

      {attachPickerOpen && selectedThread ? (
        <AttachmentPickerModal
          allItems={state.generated_items}
          currentThreadId={selectedThread.id}
          attachedSourceIds={new Set(pendingAttachments.map((a) => a.source_id))}
          onClose={() => setAttachPickerOpen(false)}
          onConfirm={(picked) => {
            setPendingAttachments((prev) => {
              const existing = new Set(prev.map((a) => a.source_id));
              const additions = picked
                .filter((i) => !existing.has(i.id))
                .map(attachmentFromItem);
              if (additions.length === 0) return prev;
              setToast(`Attached ${additions.length} item${additions.length === 1 ? "" : "s"} to reply.`);
              return [...prev, ...additions];
            });
            setAttachPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function suggestionCountsByThread(
  threads: EmailThread[],
  state: MailroomState,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of threads) {
    if (!state.summarized_threads?.[t.id]) {
      out[t.id] = 0;
      continue;
    }
    const all = [
      ...suggestionsForThread(t),
      ...(state.custom_suggestions?.filter((s) => s.thread_id === t.id) ?? []),
    ];
    const pending = all.filter(
      (s) =>
        resolveSuggestionStatus(s, state.suggestion_status, state.generated_items) === "pending",
    ).length;
    out[t.id] = pending;
  }
  return out;
}

function ThreadList({
  threads,
  selectedId,
  onSelect,
  suggestionCounts,
}: {
  threads: EmailThread[];
  selectedId: string | null;
  onSelect: (t: EmailThread) => void;
  suggestionCounts: Record<string, number>;
}) {
  return (
    <ul className="min-h-0 overflow-y-auto">
      {threads.map((t) => {
        const lastMsg = t.messages[t.messages.length - 1];
        const sender = lastMsg?.from.name ?? "Unknown";
        const active = t.id === selectedId;
        const unread = t.status === "unread";
        const sugCount = suggestionCounts[t.id] ?? 0;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t)}
              className={`block w-full border-b border-border-light/70 px-3 py-2.5 text-left transition ${
                active
                  ? "bg-violet-50 ring-1 ring-inset ring-accent/30"
                  : "hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {t.category ? (
                    <span
                      className={`size-2 shrink-0 rounded-full ${CATEGORY_DOT[t.category]}`}
                      title={CATEGORY_LABEL[t.category]}
                    />
                  ) : null}
                  <p
                    className={`truncate text-xs ${
                      unread ? "font-bold text-text-primary" : "font-semibold text-text-secondary"
                    }`}
                  >
                    {sender}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] text-text-secondary">
                  {lastMsg?.at ? relativeTime(lastMsg.at) : ""}
                </span>
              </div>
              <p
                className={`mt-0.5 flex items-center gap-1.5 truncate text-[13px] ${
                  unread ? "font-semibold text-text-primary" : "text-text-secondary"
                }`}
              >
                {t.channel === "in_app" ? (
                  <span
                    title="Promoted from in-app message"
                    className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700"
                  >
                    💬 In-app
                  </span>
                ) : null}
                <span className="truncate">{t.subject}</span>
              </p>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-text-secondary">
                {lastMsg ? lastMsg.body.replace(/\*/g, "").replace(/\n/g, " ") : ""}
              </p>
              {sugCount > 0 ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  {sugCount} pending
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ConversationPane({
  thread,
  chat,
  outbox,
  suggestionById,
  connectedEmail,
  pendingAttachments,
  onRemoveAttachment,
  onOpenAttachmentPicker,
  summarized,
  onSummarize,
  pane,
  onPaneChange,
  onPreview,
  onApply,
  onDismiss,
  onSend,
  onReply,
}: {
  thread: EmailThread | null;
  chat: AgentChatMessage[];
  outbox: EmailMessage[];
  suggestionById: Map<string, AgentSuggestion>;
  connectedEmail: string;
  pendingAttachments: EmailAttachment[];
  onRemoveAttachment: (id: string) => void;
  onOpenAttachmentPicker: () => void;
  summarized: boolean;
  onSummarize: () => void;
  pane: "chat" | "emails";
  onPaneChange: (p: "chat" | "emails") => void;
  onPreview: (s: AgentSuggestion) => void;
  onApply: (s: AgentSuggestion) => void;
  onDismiss: (s: AgentSuggestion) => void;
  onSend: (text: string) => void;
  onReply: (body: string) => void;
}) {
  const [input, setInput] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.length, thread?.id]);

  // Reset thread-scoped UI when changing threads.
  useEffect(() => {
    setReplyBody("");
  }, [thread?.id]);

  if (!thread) {
    return (
      <div className="flex items-center justify-center text-text-secondary">
        Select a thread.
      </div>
    );
  }

  const entities = detectEntities(thread);
  const fullThreadMessages: Array<EmailMessage & { __outbound?: boolean }> = [
    ...thread.messages.map((m) => ({ ...m })),
    ...outbox.map((m) => ({ ...m, __outbound: true })),
  ].sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime());
  const lastInboundReply = [...thread.messages].reverse().find((m) => m.from.email !== connectedEmail);
  const replyTo = lastInboundReply?.from.email ?? thread.participants[0]?.email ?? "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  }

  function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    const body = replyBody.trim();
    if (!body && pendingAttachments.length === 0) return;
    onReply(body);
    setReplyBody("");
  }

  return (
    <div className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border-light px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {thread.channel === "in_app" ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
              💬 Promoted from In-app
            </span>
          ) : null}
          <h2 className="text-lg font-bold text-text-primary">{thread.subject}</h2>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          {thread.participants.map((p) => p.name).join(", ")}
        </p>
        {thread.linked_message_conversation_id != null ? (
          <Link
            href={`/messages?conversation=${thread.linked_message_conversation_id}`}
            className="mt-1 inline-block text-[11px] font-semibold text-accent hover:underline"
          >
            ← Open in Messages
          </Link>
        ) : null}
      </div>

      {summarized ? (
        <div className="shrink-0 border-b border-violet-200 bg-violet-50 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-accent">AI summary</p>
          <p className="mt-1 text-sm text-text-primary">{summarize(thread)}</p>
          {entities.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {entities.map((e) => (
                <span
                  key={e}
                  className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/30"
                >
                  {e}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="shrink-0 border-b border-border-light bg-surface-body/40 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Agent · idle</p>
              <p className="mt-0.5 text-sm text-text-primary">
                The agent hasn&apos;t read this thread yet. Click <strong>Summarize</strong> to analyze it and surface suggested actions.
              </p>
            </div>
            <button
              type="button"
              onClick={onSummarize}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
            >
              <span aria-hidden>✨</span> Summarize this thread
            </button>
          </div>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Conversation view"
        className="shrink-0 border-b border-border-light bg-white px-5 py-2.5"
      >
        <div className="inline-flex rounded-full bg-slate-100 p-0.5 ring-1 ring-border-light">
          <button
            type="button"
            role="tab"
            aria-selected={pane === "chat"}
            onClick={() => onPaneChange("chat")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              pane === "chat"
                ? "bg-accent text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Chat with agent
            {chat.length > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  pane === "chat" ? "bg-white/25 text-white" : "bg-white text-text-secondary"
                }`}
              >
                {chat.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pane === "emails"}
            onClick={() => onPaneChange("emails")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              pane === "emails"
                ? "bg-accent text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Original emails
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                pane === "emails" ? "bg-white/25 text-white" : "bg-white text-text-secondary"
              }`}
            >
              {fullThreadMessages.length}
            </span>
            {outbox.length > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  pane === "emails" ? "bg-white/25 text-white" : "bg-accent/15 text-accent"
                }`}
              >
                {outbox.length} sent
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {pane === "chat" ? (
        <>
          <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {chat.length === 0 ? (
              <p className="text-xs text-text-secondary">
                {summarized
                  ? "Say hi to the agent or ask it to draft something."
                  : "Tap Summarize above to have the agent read this thread and propose actions — or send the agent a question."}
              </p>
            ) : null}
            {chat.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                suggestionById={suggestionById}
                onApply={onApply}
                onDismiss={onDismiss}
                onPreview={onPreview}
              />
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-border-light bg-surface-body/40 px-5 py-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Tell the agent what to do — e.g. “draft an invoice” or “go ahead”"
                rows={2}
                className="min-h-0 flex-1 resize-none rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Send
              </button>
            </div>
            <p className="mt-1 text-[10px] text-text-secondary">
              Tip: type “go ahead” to apply all pending suggestions, or mention <em>project</em>, <em>estimate</em>, <em>invoice</em>, etc. to surface a new one.
            </p>
          </form>
        </>
      ) : (
        <>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-surface-body/30 px-5 py-3">
            {fullThreadMessages.map((m) => (
              <EmailRow key={m.id} message={m} outbound={Boolean(m.__outbound)} />
            ))}
          </ul>

          <form
            onSubmit={handleSendReply}
            className="shrink-0 border-t border-border-light bg-surface-body/40 px-5 py-3"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                Reply to {replyTo || "thread"}
              </p>
              <button
                type="button"
                onClick={onOpenAttachmentPicker}
                className="inline-flex items-center gap-1 rounded-md border border-accent/40 px-2 py-0.5 text-[10px] font-semibold text-accent hover:bg-violet-50"
              >
                <span aria-hidden>📎</span> Add attachment
              </button>
            </div>
            {pendingAttachments.length > 0 ? (
              <ul className="mb-2 flex flex-wrap gap-1">
                {pendingAttachments.map((a) => (
                  <li key={a.id}>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${SECTION_BADGE[a.kind]} ring-current/20`}>
                      <span aria-hidden>📎</span>
                      <span className="max-w-[14rem] truncate">{a.label}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveAttachment(a.id)}
                        aria-label={`Remove attachment ${a.label}`}
                        className="ml-0.5 rounded px-1 text-[10px] font-bold hover:bg-white/40"
                      >
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSendReply(e);
                  }
                }}
                rows={2}
                placeholder="Type your reply… (⌘+Enter to send)"
                className="min-h-0 flex-1 resize-none rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit"
                disabled={!replyBody.trim() && pendingAttachments.length === 0}
                className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                Send reply
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function EmailRow({ message, outbound }: { message: EmailMessage; outbound?: boolean }) {
  const [open, setOpen] = useState(false);
  const preview = message.body.replace(/\*/g, "").replace(/\n/g, " ");
  return (
    <li
      className={`rounded-lg border ${
        outbound ? "border-accent/30 bg-violet-50/60" : "border-border-light bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[12px] font-semibold text-text-primary">
            {message.from.name}
            {outbound ? (
              <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                Sent
              </span>
            ) : null}
          </p>
          {open ? null : (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-text-secondary">{preview}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-text-secondary">
          {message.at ? new Date(message.at).toLocaleString() : ""}
        </span>
      </button>
      {open ? (
        <div className="border-t border-border-light px-3 py-2 text-[13px] text-text-primary">
          <div dangerouslySetInnerHTML={{ __html: markdownLite(message.body) }} />
          {message.attachments && message.attachments.length > 0 ? (
            <div className="mt-2 border-t border-border-light pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                {message.attachments.length} attachment
                {message.attachments.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {message.attachments.map((a) => {
                  const chip = (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-current/15 ${SECTION_BADGE[a.kind]}`}
                    >
                      <span aria-hidden>📎</span>
                      <span className="max-w-[16rem] truncate">{a.label}</span>
                    </span>
                  );
                  return (
                    <li key={a.id}>
                      {a.deepLink ? (
                        <Link href={a.deepLink} className="hover:opacity-80">
                          {chip}
                        </Link>
                      ) : (
                        chip
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ChatBubble({
  message,
  suggestionById,
  onApply,
  onDismiss,
  onPreview,
}: {
  message: AgentChatMessage;
  suggestionById: Map<string, AgentSuggestion>;
  onApply: (s: AgentSuggestion) => void;
  onDismiss: (s: AgentSuggestion) => void;
  onPreview: (s: AgentSuggestion) => void;
}) {
  const isAgent = message.role === "agent";
  const proposed = (message.proposed_suggestion_ids ?? [])
    .map((id) => suggestionById.get(id))
    .filter((s): s is AgentSuggestion => Boolean(s));

  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[88%] space-y-2 ${isAgent ? "" : "items-end"}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
            isAgent
              ? "bg-white text-text-primary ring-1 ring-border-light"
              : "bg-accent text-white"
          }`}
          dangerouslySetInnerHTML={{ __html: markdownLite(message.text) }}
        />
        {proposed.length > 0 ? (
          <div className="space-y-2">
            {proposed.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onApply={onApply}
                onDismiss={onDismiss}
                onPreview={onPreview}
              />
            ))}
          </div>
        ) : null}
        <p className={`text-[10px] text-text-secondary ${isAgent ? "" : "text-right"}`}>
          {relativeTime(message.at)}
        </p>
      </div>
    </div>
  );
}

function SuggestionCard({
  s,
  onApply,
  onDismiss,
  onPreview,
}: {
  s: AgentSuggestion;
  onApply: (s: AgentSuggestion) => void;
  onDismiss: (s: AgentSuggestion) => void;
  onPreview: (s: AgentSuggestion) => void;
}) {
  const applied = s.status === "applied";
  const dismissed = s.status === "dismissed";
  const kind = generatedKindFromSuggestion(s.kind);
  const badge = SECTION_BADGE[kind];
  return (
    <button
      type="button"
      onClick={() => !applied && !dismissed && onPreview(s)}
      disabled={applied || dismissed}
      className={`block w-full rounded-xl border px-3 py-2 text-left text-[12px] shadow-sm transition ${
        applied
          ? "cursor-default border-emerald-200 bg-emerald-50"
          : dismissed
          ? "cursor-default border-border-light bg-slate-50 opacity-70"
          : "border-accent/30 bg-white hover:border-accent/60 hover:shadow"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>
          <span aria-hidden>📄</span>
          {labelForKind(kind)}
        </span>
        {!applied && !dismissed ? (
          <span className="text-[10px] font-semibold text-accent">Preview →</span>
        ) : null}
      </div>
      <p className="mt-1.5 font-semibold text-text-primary">{s.title}</p>
      <PayloadList payload={s.payload} />
      <div
        className="mt-2 flex flex-wrap items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {!applied && !dismissed ? (
          <>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onPreview(s);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPreview(s);
                }
              }}
              className="cursor-pointer rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
            >
              Preview & edit
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onApply(s);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onApply(s);
                }
              }}
              className="cursor-pointer rounded-lg border border-border-light px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-slate-50"
            >
              Quick generate
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(s);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDismiss(s);
                }
              }}
              className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-slate-100"
            >
              Dismiss
            </span>
          </>
        ) : applied ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            Applied
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
            Dismissed
          </span>
        )}
      </div>
    </button>
  );
}

function PayloadList({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 text-[11px]">
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-3">
          <span className="font-semibold uppercase text-text-secondary">{k.replaceAll("_", " ")}</span>
          <span className="text-right font-mono text-text-primary">{String(v)}</span>
        </li>
      ))}
    </ul>
  );
}

function labelForKind(kind: GeneratedItemKind): string {
  return GENERATED_SECTIONS.find((s) => s.kind === kind)?.label.replace(/s$/, "") ?? kind;
}

function GeneratedItemsPanel({
  items,
  showAllThreads,
  onToggleScope,
  onOpenItem,
  onRemove,
  onAttach,
  attachedSourceIds,
}: {
  items: GeneratedItem[];
  showAllThreads: boolean;
  onToggleScope: () => void;
  onOpenItem: (i: GeneratedItem) => void;
  onRemove: (i: GeneratedItem) => void;
  /** Optional — when provided, each card gets an "Attach to current email" action. */
  onAttach?: (i: GeneratedItem) => void;
  attachedSourceIds: Set<string>;
}) {
  const byKind = useMemo(() => {
    const map = new Map<GeneratedItemKind, GeneratedItem[]>();
    for (const item of items) {
      const list = map.get(item.kind) ?? [];
      list.push(item);
      map.set(item.kind, list);
    }
    return map;
  }, [items]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="shrink-0 border-b border-border-light bg-surface-body/40 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            Generated items
          </p>
          <button
            type="button"
            onClick={onToggleScope}
            className="text-[10px] font-semibold text-accent hover:underline"
          >
            {showAllThreads ? "This thread only" : "All threads"}
          </button>
        </div>
        <p className="mt-0.5 text-[10px] text-text-secondary">
          {items.length} item{items.length === 1 ? "" : "s"} · click to open
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-light bg-white px-4 py-6 text-center text-[11px] text-text-secondary">
            Nothing generated yet. Apply a suggestion from the chat to create projects, jobs, estimates, invoices, etc.
          </div>
        ) : (
          GENERATED_SECTIONS.map(({ kind, label }) => {
            const list = byKind.get(kind);
            if (!list || list.length === 0) return null;
            return (
              <section key={kind}>
                <div className="mb-1.5 flex items-center justify-between">
                  <h4 className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                    {label}
                  </h4>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SECTION_BADGE[kind]}`}>
                    {list.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {list.map((i) => {
                    const isAttached = attachedSourceIds.has(i.id);
                    return (
                      <li key={i.id}>
                        <div className="group rounded-xl border border-border-light bg-white px-3 py-2 shadow-sm transition hover:border-accent/40 hover:bg-violet-50/30">
                          <button
                            type="button"
                            onClick={() => onOpenItem(i)}
                            className="block w-full text-left"
                          >
                            <p className="text-[12px] font-semibold text-text-primary">{i.title}</p>
                            {i.summary ? (
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">{i.summary}</p>
                            ) : null}
                            <p className="mt-1 text-[10px] text-text-secondary">{relativeTime(i.created_at)}</p>
                          </button>
                          {onAttach ? (
                            <button
                              type="button"
                              onClick={() => onAttach(i)}
                              disabled={isAttached}
                              className={`mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition ${
                                isAttached
                                  ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-accent/40 text-accent hover:bg-violet-50"
                              }`}
                            >
                              <span aria-hidden>📎</span>
                              {isAttached ? "Attached to reply" : "Attach to current email"}
                            </button>
                          ) : null}
                          <div className="mt-1.5 flex items-center justify-between text-[10px]">
                            {i.deepLink ? (
                              <Link href={i.deepLink} className="font-semibold text-accent hover:underline">
                                Open in OnPro →
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenItem(i)}
                                className="font-semibold text-accent hover:underline"
                              >
                                View details
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemove(i)}
                              className="font-semibold text-text-secondary opacity-0 transition group-hover:opacity-100 hover:text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
        <p className="rounded-xl border border-dashed border-border-light bg-white px-3 py-2 text-[10px] text-text-secondary">
          Full Gmail OAuth + LLM integration ships in a later release. See{" "}
          <Link href="/settings" className="text-accent hover:underline">
            Settings
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function GeneratedItemDetailModal({
  item,
  onClose,
}: {
  item: GeneratedItem;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border-light bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border-light px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">
            {labelForKind(item.kind)} · {relativeTime(item.created_at)}
          </p>
          <h3 className="mt-0.5 text-base font-bold text-text-primary">{item.title}</h3>
        </div>
        <div className="space-y-3 px-5 py-4">
          {item.summary ? (
            <p className="text-sm text-text-primary">{item.summary}</p>
          ) : null}
          <div className="rounded-xl border border-border-light bg-surface-body/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Payload</p>
            <PayloadList payload={item.payload} />
          </div>
          {item.deepLink ? (
            <Link
              href={item.deepLink}
              className="block rounded-lg bg-accent px-3 py-2 text-center text-sm font-semibold text-white hover:opacity-90"
            >
              Open in OnPro
            </Link>
          ) : null}
        </div>
        <div className="flex justify-end border-t border-border-light bg-surface-body/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-text-secondary hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const KIND_ICON: Record<GeneratedItemKind, string> = {
  project: "📁",
  job: "🧰",
  estimate: "🧾",
  invoice: "💸",
  vendor_quote: "📨",
  costing_line: "📊",
  sample: "🎨",
  client_po: "🛒",
  packing_list: "📦",
  task: "✅",
};

const KIND_DOC_PREFIX: Record<GeneratedItemKind, string> = {
  project: "PRJ",
  job: "JOB",
  estimate: "EST",
  invoice: "INV",
  vendor_quote: "VQ",
  costing_line: "CL",
  sample: "SMP",
  client_po: "PO",
  packing_list: "PL",
  task: "TSK",
};

function generateDocNumber(kind: GeneratedItemKind): string {
  const prefix = KIND_DOC_PREFIX[kind] ?? "DOC";
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 99999) + 1).padStart(5, "0");
  return `${prefix}-${year}-${seq}`;
}

const MONEY_KEY_RE = /price|total|amount|cost|subtotal|tax|due|paid|balance|net|gross/i;
const DATE_KEY_RE = /^(date|due|delivery|expires|sent|received|created|updated|ship|target)|(_at|_on)$/i;
const QTY_KEY_RE = /^(qty|quantity|units|count|days|weeks|months|hours)$/i;

function humanLabel(key: string): string {
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function formatDateMaybe(s: string): string {
  const t = Date.parse(s);
  if (Number.isNaN(t)) return s;
  return new Date(t).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PreviewValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (value == null || value === "") {
    return <span className="italic text-slate-400">—</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          value ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
        }`}
      >
        <span className="size-1.5 rounded-full bg-current opacity-60" /> {value ? "Yes" : "No"}
      </span>
    );
  }
  if (typeof value === "number") {
    if (MONEY_KEY_RE.test(fieldKey)) {
      return <span className="font-mono tabular-nums text-slate-900">{formatCurrency(value)}</span>;
    }
    if (QTY_KEY_RE.test(fieldKey)) {
      return <span className="font-mono tabular-nums text-slate-900">{value.toLocaleString()}</span>;
    }
    return <span className="font-mono tabular-nums text-slate-900">{value.toLocaleString()}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="italic text-slate-400">empty list</span>;
    // Array of objects → mini table.
    if (typeof value[0] === "object" && value[0] !== null) {
      const cols = Array.from(
        new Set(value.flatMap((row) => (row && typeof row === "object" ? Object.keys(row) : []))),
      );
      return (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[9px] font-bold uppercase tracking-wide text-slate-500">
                {cols.map((c) => (
                  <th key={c} className="px-2 py-1.5">{humanLabel(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {cols.map((c) => {
                    const cell = (row as Record<string, unknown>)[c];
                    return (
                      <td key={c} className="px-2 py-1.5 align-top">
                        <PreviewValue fieldKey={c} value={cell} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <ul className="ml-4 list-disc space-y-0.5 text-slate-800">
        {value.map((v, i) => (
          <li key={i}>
            <PreviewValue fieldKey={fieldKey} value={v} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className="rounded-md border border-slate-200 p-2 text-[11px]">
        {Object.entries(value).map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-2 py-0.5">
            <dt className="min-w-[6rem] font-semibold uppercase tracking-wide text-[9px] text-slate-500">
              {humanLabel(k)}
            </dt>
            <dd className="min-w-0 flex-1 text-slate-800">
              <PreviewValue fieldKey={k} value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  const text = String(value);
  if (DATE_KEY_RE.test(fieldKey) && /\d/.test(text)) {
    return <span className="text-slate-900">{formatDateMaybe(text)}</span>;
  }
  if (text.length > 80 || text.includes("\n")) {
    return (
      <p className="whitespace-pre-line text-slate-800">{text}</p>
    );
  }
  return <span className="text-slate-900">{text}</span>;
}

function DocPreview({
  kind,
  title,
  payload,
  docNumber,
}: {
  kind: GeneratedItemKind;
  title: string;
  payload: Record<string, unknown>;
  docNumber: string;
}) {
  const entries = Object.entries(payload);
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="relative mx-auto max-w-2xl rounded-lg bg-white p-8 shadow-md ring-1 ring-slate-200">
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[120px] font-black uppercase tracking-widest text-slate-50 opacity-90">
        Draft
      </span>
      <div className="relative">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-2xl text-white shadow-sm">
              {KIND_ICON[kind] ?? "📄"}
            </span>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                OnPro · {labelForKind(kind)}
              </p>
              <p className="font-mono text-xs font-semibold text-slate-700">{docNumber}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
              <span className="size-1.5 rounded-full bg-amber-500" /> Draft
            </span>
            <p className="mt-1 text-[10px] text-slate-500">Generated {today}</p>
          </div>
        </div>

        <h1 className="mt-5 text-xl font-bold leading-tight text-slate-900">
          {title || <span className="italic text-slate-400">Untitled</span>}
        </h1>

        <div className="mt-5 space-y-3">
          {entries.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
              No content yet — add fields on the left to build this document.
            </p>
          ) : (
            entries.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[10rem_1fr] items-baseline gap-3 border-b border-slate-100 py-2 last:border-b-0">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {humanLabel(k)}
                </dt>
                <dd className="min-w-0 text-sm">
                  <PreviewValue fieldKey={k} value={v} />
                </dd>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
          ✨ Drafted by OnPro AI Agent · This is a preview. It is not final until you generate it.
        </div>
      </div>
    </div>
  );
}

function DocPreviewSkeleton({ kind }: { kind: GeneratedItemKind }) {
  return (
    <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow-md ring-1 ring-slate-200">
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 animate-pulse items-center justify-center rounded-xl bg-violet-100 text-2xl">
            {KIND_ICON[kind] ?? "📄"}
          </div>
          <div className="space-y-1.5">
            <div className="h-2.5 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
        <div className="space-y-1.5 text-right">
          <div className="ml-auto h-3 w-14 animate-pulse rounded-full bg-amber-100" />
          <div className="ml-auto h-2 w-20 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-5 h-5 w-3/4 animate-pulse rounded bg-slate-200" />
      <div className="mt-5 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="grid grid-cols-[10rem_1fr] items-baseline gap-3 border-b border-slate-100 py-2">
            <div className="h-2 w-24 animate-pulse rounded bg-slate-100" />
            <div
              className="h-3 animate-pulse rounded bg-slate-100"
              style={{ width: `${50 + ((i * 17) % 40)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-2 text-[11px] font-semibold text-violet-700">
        <span className="inline-flex size-2 animate-ping rounded-full bg-violet-500" />
        Generating draft from this conversation…
      </div>
    </div>
  );
}

function DocPreviewModal({
  suggestion,
  onClose,
  onSave,
  onSaveAndAttach,
}: {
  suggestion: AgentSuggestion;
  onClose: () => void;
  onSave: (title: string, payload: Record<string, unknown>) => void;
  onSaveAndAttach: (title: string, payload: Record<string, unknown>) => void;
}) {
  const kind = generatedKindFromSuggestion(suggestion.kind);
  const [title, setTitle] = useState(suggestion.title);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...suggestion.payload }));
  const [generating, setGenerating] = useState(true);
  const docNumber = useMemo(() => generateDocNumber(kind), [kind]);

  useEffect(() => {
    const t = setTimeout(() => setGenerating(false), 750);
    return () => clearTimeout(t);
  }, []);

  function setField(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function removeField(key: string) {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const entries = Object.entries(draft);
  const safeTitle = title.trim() || suggestion.title;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-preview-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-gradient-to-r from-violet-50/60 via-white to-indigo-50/60 px-6 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-xl text-white shadow-sm">
                {KIND_ICON[kind] ?? "📄"}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-700">
                  ✨ {generating ? "Generating with AI" : "AI draft ready"}
                  {generating ? (
                    <span className="ml-1 inline-flex gap-0.5">
                      <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:0ms]" />
                      <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:150ms]" />
                      <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:300ms]" />
                    </span>
                  ) : null}
                </p>
                <h2 id="doc-preview-title" className="truncate text-base font-bold text-slate-900">
                  {labelForKind(kind)} draft
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Saved drafts appear on the right
              </span>
              <span className="hidden font-mono text-[11px] font-semibold text-slate-600 sm:inline">
                {docNumber}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
          </div>
          {generating ? (
            <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden">
              <span className="block h-full w-1/3 animate-[shimmer_1.2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            </span>
          ) : null}
        </div>

        {/* Body — two-pane */}
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* Editor */}
          <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50/40 md:border-b-0 md:border-r">
            <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Editor
              </p>
              <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Fields
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Updates the preview live.
              </p>
              <ul className="mt-3 space-y-2">
                {entries.map(([k, v]) => (
                  <PayloadField
                    key={k}
                    fieldKey={k}
                    value={v}
                    onChange={(next) => setField(k, next)}
                    onRemove={() => removeField(k)}
                  />
                ))}
                {entries.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-center text-[11px] text-slate-500">
                    No fields yet — add one below.
                  </li>
                ) : null}
              </ul>
              <AddFieldRow
                existing={new Set(entries.map(([k]) => k))}
                onAdd={(k, v) => setField(k, v)}
              />
            </div>
          </aside>

          {/* Preview */}
          <section className="min-h-0 overflow-y-auto bg-slate-100 px-6 py-6">
            {generating ? (
              <DocPreviewSkeleton kind={kind} />
            ) : (
              <div className="transition-opacity duration-300">
                <DocPreview kind={kind} title={safeTitle} payload={draft} docNumber={docNumber} />
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => onSave(safeTitle, draft)}
            className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-40"
          >
            Generate
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => onSaveAndAttach(safeTitle, draft)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-40"
          >
            <span aria-hidden>✨</span> Generate &amp; attach
          </button>
        </div>
      </div>
    </div>
  );
}

function PayloadField({
  fieldKey,
  value,
  onChange,
  onRemove,
}: {
  fieldKey: string;
  value: unknown;
  onChange: (next: unknown) => void;
  onRemove: () => void;
}) {
  const label = fieldKey.replaceAll("_", " ");
  if (typeof value === "boolean") {
    return (
      <li className="flex items-center justify-between gap-3 rounded-lg border border-border-light bg-white px-3 py-2">
        <label className="flex flex-1 items-center gap-2 text-[12px] font-semibold capitalize text-text-primary">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 accent-violet-600"
          />
          {label}
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="text-[10px] font-semibold text-text-secondary hover:text-red-600"
        >
          Remove
        </button>
      </li>
    );
  }
  if (typeof value === "number") {
    return (
      <li className="rounded-lg border border-border-light bg-white px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
            {label}
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="text-[10px] font-semibold text-text-secondary hover:text-red-600"
          >
            Remove
          </button>
        </div>
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-border-light px-2 py-1 text-sm font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </li>
    );
  }
  const text = value == null ? "" : String(value);
  const isLong = text.length > 60 || text.includes("\n");
  return (
    <li className="rounded-lg border border-border-light bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          {label}
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="text-[10px] font-semibold text-text-secondary hover:text-red-600"
        >
          Remove
        </button>
      </div>
      {isLong ? (
        <textarea
          rows={3}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full resize-y rounded-md border border-border-light px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      ) : (
        <input
          type="text"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-border-light px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )}
    </li>
  );
}

function AddFieldRow({
  existing,
  onAdd,
}: {
  existing: Set<string>;
  onAdd: (key: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [val, setVal] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-lg border border-dashed border-border-light px-3 py-2 text-[11px] font-semibold text-text-secondary hover:border-accent hover:text-accent"
      >
        + Add field
      </button>
    );
  }
  const trimmed = key.trim().toLowerCase().replace(/\s+/g, "_");
  const dup = trimmed.length > 0 && existing.has(trimmed);
  return (
    <div className="mt-3 rounded-lg border border-accent/30 bg-violet-50/30 p-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          autoFocus
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="field name"
          className="rounded-md border border-border-light px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="value"
          className="rounded-md border border-border-light px-2 py-1 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      {dup ? (
        <p className="mt-1 text-[10px] text-red-600">Field already exists.</p>
      ) : null}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setKey("");
            setVal("");
          }}
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-text-secondary hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!trimmed || dup}
          onClick={() => {
            onAdd(trimmed, val);
            setOpen(false);
            setKey("");
            setVal("");
          }}
          className="rounded-md bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function AttachmentPickerModal({
  allItems,
  currentThreadId,
  attachedSourceIds,
  onClose,
  onConfirm,
}: {
  allItems: GeneratedItem[];
  currentThreadId: string;
  attachedSourceIds: Set<string>;
  onClose: () => void;
  onConfirm: (picked: GeneratedItem[]) => void;
}) {
  const [scope, setScope] = useState<"thread" | "all">("thread");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const scoped = scope === "thread"
      ? allItems.filter((i) => i.thread_id === currentThreadId)
      : allItems;
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (i) => i.title.toLowerCase().includes(q) || labelForKind(i.kind).toLowerCase().includes(q),
    );
  }, [allItems, scope, currentThreadId, query]);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const picked = list.filter((i) => selectedIds.has(i.id));

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attach-picker-title"
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border-light px-5 py-3">
          <h3 id="attach-picker-title" className="text-base font-bold text-text-primary">
            Attach to reply
          </h3>
          <p className="mt-0.5 text-xs text-text-secondary">
            Pick one or more generated items to attach to the outgoing email.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="inline-flex rounded-full bg-slate-100 p-0.5 ring-1 ring-border-light">
              <button
                type="button"
                onClick={() => setScope("thread")}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  scope === "thread" ? "bg-accent text-white shadow-sm" : "text-text-secondary"
                }`}
              >
                This thread
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  scope === "all" ? "bg-accent text-white shadow-sm" : "text-text-secondary"
                }`}
              >
                All threads
              </button>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="flex-1 rounded-lg border border-border-light px-3 py-1 text-xs focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {list.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-light px-4 py-6 text-center text-xs text-text-secondary">
              Nothing to attach yet. Apply a suggestion to generate something.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {list.map((i) => {
                const already = attachedSourceIds.has(i.id);
                const picked = selectedIds.has(i.id);
                return (
                  <li key={i.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${
                        already
                          ? "cursor-not-allowed border-emerald-200 bg-emerald-50/60"
                          : picked
                          ? "border-accent/40 bg-violet-50/40"
                          : "border-border-light hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={already || picked}
                        disabled={already}
                        onChange={() => toggle(i.id)}
                        className="mt-0.5 size-4 accent-violet-600"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12px] font-semibold text-text-primary">{i.title}</p>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${SECTION_BADGE[i.kind]}`}>
                            {labelForKind(i.kind)}
                          </span>
                        </div>
                        {i.summary ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">{i.summary}</p>
                        ) : null}
                        {already ? (
                          <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">Already attached</p>
                        ) : null}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border-light bg-surface-body/40 px-5 py-3">
          <p className="text-[11px] text-text-secondary">
            {picked.length} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-text-secondary hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(picked)}
              disabled={picked.length === 0}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              Attach {picked.length > 0 ? picked.length : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
