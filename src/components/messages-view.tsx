"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import type { Conversation } from "@/lib/types/messages";
import {
  attachmentsForConversation,
  messagesForConversation,
  type ThreadMessage,
  type ThreadSmartAttachment,
} from "@/lib/mock/message-threads";
import { formatDateTime } from "@/lib/format";
import { AttachmentReaderModal } from "@/components/attachment-reader-modal";
import {
  AttachmentsOnboardingModal,
  hasSeenAttachmentsOnboarding,
  markAttachmentsOnboardingSeen,
} from "@/components/attachments-onboarding-modal";
import { MessageAttachmentComposer } from "@/components/message-attachment-composer";
import type { AttachmentComposerDraft } from "@/lib/attachment-composer-draft";
import { fallbackDraftFromSmartAttachment } from "@/lib/attachment-composer-draft";

function kindLabel(kind: string) {
  const map: Record<string, string> = {
    job: "Job",
    estimate: "Estimate",
    quote: "Quote",
    approval: "Approval",
    purchase_order: "PO",
    payment: "Payment",
    invoice: "Invoice",
    receiving: "Receiving",
    tracking: "Tracking",
    task: "Task",
    calendar_event: "Event",
  };
  return map[kind] ?? kind;
}

function SmartAttachmentCard({ attachment: a, onOpen }: { attachment: ThreadSmartAttachment; onOpen?: () => void }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{a.title}</p>
        {a.badge ? (
          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
            {a.badge}
          </span>
        ) : null}
      </div>
      {a.subtitle ? <p className="mt-1 line-clamp-2 text-xs text-slate-600">{a.subtitle}</p> : null}
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{kindLabel(a.kind)}</p>
    </>
  );
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-2xl rounded-tr-sm border border-violet-200 bg-white px-4 py-3 text-left shadow-sm ring-1 ring-violet-100 transition hover:border-violet-300 hover:ring-violet-200"
      >
        {body}
      </button>
    );
  }
  return (
    <div className="rounded-2xl rounded-tr-sm border border-violet-200 bg-white px-4 py-3 text-left shadow-sm ring-1 ring-violet-100">
      {body}
    </div>
  );
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function extIcon(ext: string) {
  const c =
    ext === "pdf"
      ? "bg-red-100 text-red-700"
      : ext === "doc"
        ? "bg-blue-100 text-blue-700"
        : ext === "ppt"
          ? "bg-orange-100 text-orange-700"
          : "bg-emerald-100 text-emerald-800";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${c}`}>{ext}</span>
  );
}

export function MessagesView({ conversations }: { conversations: Conversation[] }) {
  const [extraConversations, setExtraConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? 0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSessionKey, setComposerSessionKey] = useState(0);
  const [composerInitialDraft, setComposerInitialDraft] = useState<AttachmentComposerDraft | null>(null);
  const [composerMode, setComposerMode] = useState<"new" | "edit">("new");
  const [composerLayout, setComposerLayout] = useState<"workspace" | "document">("workspace");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [overrideById, setOverrideById] = useState<Record<string, Partial<ThreadMessage>>>({});
  const [extraMessages, setExtraMessages] = useState<ThreadMessage[]>([]);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState("");
  const [attachOnboardingOpen, setAttachOnboardingOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerAttachment, setReaderAttachment] = useState<ThreadSmartAttachment | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [inboxPeekOpen, setInboxPeekOpen] = useState(false);
  const [inboxSearchQuery, setInboxSearchQuery] = useState("");
  const threadInputRef = useRef<HTMLTextAreaElement>(null);

  const allConversations = useMemo(
    () => [...conversations, ...extraConversations],
    [conversations, extraConversations],
  );

  const active = allConversations.find((c) => c.id === activeId) ?? allConversations[0];

  useEffect(() => {
    if (hasSeenAttachmentsOnboarding()) return;
    setAttachOnboardingOpen(true);
  }, []);

  useEffect(() => {
    setDraftMessage("");
  }, [activeId]);

  useEffect(() => {
    if (!newMessageOpen) setNewRecipientName("");
  }, [newMessageOpen]);

  function focusThreadInput() {
    requestAnimationFrame(() => {
      threadInputRef.current?.focus();
    });
  }

  function dismissAttachOnboarding() {
    markAttachmentsOnboardingSeen();
    setAttachOnboardingOpen(false);
  }

  const thread = useMemo(() => {
    if (!active) return [];
    const base = messagesForConversation(active.id);
    const add = extraMessages.filter((m) => m.conversation_id === active.id);
    return [...base, ...add].map((m) => {
      const o = overrideById[m.id];
      return o ? ({ ...m, ...o } as ThreadMessage) : m;
    });
  }, [active, extraMessages, overrideById]);
  const attachments = active ? attachmentsForConversation(active.id) : [];

  const filteredConversations = useMemo(() => {
    const needle = inboxSearchQuery.trim().toLowerCase();
    if (!needle) return allConversations;
    return allConversations.filter((c) => {
      const participantNames = c.participants.map((p) => p.name).join(" ");
      const blob = `${c.name} ${c.last_message_preview ?? ""} ${participantNames}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [allConversations, inboxSearchQuery]);

  const peerName = active?.name ?? "—";
  const handle = `@${peerName.replace(/\s+/g, "").toLowerCase()}`;

  /** Choosing a thread should dismiss the expanded inbox rail (focus was keeping it stuck open). */
  function pickConversation(conversationId: number) {
    if (typeof document !== "undefined") {
      const ae = document.activeElement;
      if (ae instanceof HTMLElement) ae.blur();
    }
    setActiveId(conversationId);
    setInboxPeekOpen(false);
  }

  function openNewComposer() {
    setComposerLayout("workspace");
    setComposerMode("new");
    setEditingMessageId(null);
    setComposerInitialDraft(null);
    setComposerSessionKey((k) => k + 1);
    setComposerOpen(true);
  }

  function nextIds(): { convId: number; participantId: number } {
    const merged = [...conversations, ...extraConversations];
    const convId = (merged.length ? Math.max(...merged.map((c) => c.id)) : 0) + 1;
    const participantId =
      (merged.length ? Math.max(...merged.flatMap((c) => c.participants.map((p) => p.id))) : 0) + 1;
    return { convId, participantId };
  }

  function createConversationAndOpen() {
    const name = newRecipientName.trim();
    if (!name) return;
    const { convId, participantId } = nextIds();
    const row: Conversation = {
      id: convId,
      name,
      avatar_url: null,
      last_message_preview: null,
      last_message_date: new Date().toISOString(),
      unread_count: 0,
      participants: [
        { id: participantId, name, avatar_url: null },
        { id: 2, name: "Jerry M", avatar_url: null },
      ],
      is_group: false,
      project_id: null,
    };
    setExtraConversations((prev) => [...prev, row]);
    setActiveId(convId);
    setNewRecipientName("");
    setNewMessageOpen(false);
    focusThreadInput();
  }

  /** Pick an existing thread from the New message sheet — opens the composer only for typing, not attachments. */
  function openExistingChatFromModal(conversationId: number) {
    pickConversation(conversationId);
    setNewMessageOpen(false);
    focusThreadInput();
  }

  function sendDraftMessage() {
    if (!active) return;
    const trimmed = draftMessage.trim();
    if (!trimmed) return;
    const id = `local-${Date.now()}`;
    const timeLabel = new Date().toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    setExtraMessages((prev) => [
      ...prev,
      {
        id,
        conversation_id: active.id,
        side: "outgoing",
        body: trimmed,
        time_label: timeLabel,
      },
    ]);
    setExtraConversations((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? {
              ...c,
              last_message_preview: trimmed.slice(0, 140),
              last_message_date: new Date().toISOString(),
            }
          : c,
      ),
    );
    setDraftMessage("");
  }

  function handleInboxBlur(e: FocusEvent<HTMLElement>) {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setInboxPeekOpen(false);
  }

  function handleInboxMouseLeave(e: MouseEvent<HTMLElement>) {
    const root = e.currentTarget;
    queueMicrotask(() => {
      if (!root.contains(document.activeElement)) setInboxPeekOpen(false);
    });
  }

  /** Desktop inbox rail: collapsed → thread column gets wider max-width (must animate with aside width). */
  const threadShellMax = inboxPeekOpen
    ? "max-w-2xl"
    : "max-w-2xl md:max-w-[min(100%,48rem)] xl:max-w-[min(100%,56rem)]";
  const threadShellTransition =
    "transition-[max-width] duration-300 ease-out motion-reduce:transition-none";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50">
      <AttachmentsOnboardingModal open={attachOnboardingOpen} onDismiss={dismissAttachOnboarding} />
      <AttachmentReaderModal
        open={readerOpen}
        attachment={readerAttachment}
        onClose={() => {
          setReaderOpen(false);
          setReaderAttachment(null);
          setEditingMessageId(null);
        }}
        onEdit={() => {
          if (!readerAttachment) return;
          const draft =
            readerAttachment.composer_draft ??
            fallbackDraftFromSmartAttachment(readerAttachment, peerName);
          setReaderOpen(false);
          setReaderAttachment(null);
          setComposerLayout("workspace");
          setComposerMode("edit");
          setComposerInitialDraft(draft);
          setComposerSessionKey((k) => k + 1);
          setComposerOpen(true);
        }}
      />
      {/* App-style sub-header (light, under global nav) */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm md:px-6">
        <h1 className="text-lg font-semibold text-slate-900">Messages</h1>
        <button
          type="button"
          onClick={() => setNewMessageOpen(true)}
          className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
        >
          New message
        </button>
      </header>

      {newMessageOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onMouseDown={() => setNewMessageOpen(false)}
        >
          <div
            role="dialog"
            aria-labelledby="new-message-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 id="new-message-title" className="text-base font-semibold text-slate-900">
                New message
              </h2>
              <button
                type="button"
                onClick={() => setNewMessageOpen(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">New conversation</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createConversationAndOpen();
                    }
                  }}
                  placeholder="Client, vendor, or chat name"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                  aria-label="New conversation name"
                />
                <button
                  type="button"
                  disabled={!newRecipientName.trim()}
                  onClick={() => createConversationAndOpen()}
                  className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:pointer-events-none disabled:opacity-40"
                >
                  Start
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Creates a direct thread (browser-only mock).</p>
            </div>
            <div className="border-b border-slate-100 px-4 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Existing chats</p>
            </div>
            <ul className="max-h-[min(60vh,280px)] overflow-y-auto py-1">
              {allConversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openExistingChatFromModal(c.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-700">
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{c.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {c.is_group ? "Group" : "Direct"} · {c.last_message_preview ?? "No messages yet"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 divide-x divide-slate-200">
        {/* Left: inbox — md+: narrow strip with search + avatars; hover expands full panel */}
        <aside
          className={`flex shrink-0 flex-col overflow-hidden border-slate-200 bg-white transition-[width,box-shadow] duration-300 ease-out md:z-[5] md:border-r md:border-slate-200 ${
            inboxPeekOpen
              ? "w-full min-w-0 md:w-[min(100%,320px)] md:max-w-[360px] md:shadow-[6px_0_28px_-14px_rgba(15,23,42,0.18)]"
              : "w-full min-w-0 md:w-[60px] md:min-w-[60px]"
          }`}
          title={inboxPeekOpen ? undefined : "Hover to expand inbox"}
          onMouseEnter={() => setInboxPeekOpen(true)}
          onMouseLeave={handleInboxMouseLeave}
          onFocusCapture={() => setInboxPeekOpen(true)}
          onBlurCapture={handleInboxBlur}
        >
          {/* Expanded inbox — always on small screens; desktop when hovered */}
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden max-md:flex ${inboxPeekOpen ? "md:flex" : "md:hidden"}`}
          >
            <div className="border-b border-slate-100 px-3 pb-3.5 pt-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <SearchIcon className="size-[18px] shrink-0 text-slate-400" />
                </span>
                <input
                  value={inboxSearchQuery}
                  onChange={(e) => setInboxSearchQuery(e.target.value)}
                  placeholder="People, chat, keywords"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-400/25"
                  aria-label="Search conversations"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ul>
                {filteredConversations.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-slate-500">
                    {inboxSearchQuery.trim()
                      ? `No conversations match "${inboxSearchQuery.trim()}".`
                      : "No conversations yet."}
                  </li>
                ) : (
                  filteredConversations.map((c) => {
                  const isActive = c.id === active?.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pickConversation(c.id)}
                        className={`flex w-full gap-3 border-l-4 px-3 py-3 text-left transition ${
                          isActive
                            ? "border-violet-500 bg-violet-50/90"
                            : "border-transparent hover:bg-slate-50"
                        }`}
                      >
                        <span className="relative shrink-0">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-700">
                            {initials(c.name)}
                          </span>
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-semibold text-slate-900">{c.name}</span>
                            <span className="shrink-0 text-[11px] text-slate-400">
                              {c.last_message_date
                                ? new Date(c.last_message_date).toLocaleTimeString(undefined, {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                          </span>
                          <span className="line-clamp-1 text-sm text-slate-500">
                            {c.last_message_preview ?? "—"}
                          </span>
                        </span>
                        {c.unread_count > 0 ? (
                          <span className="mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                            {c.unread_count}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                  })
                )}
              </ul>
            </div>
          </div>

          {/* Collapsed rail — desktop only; header height matches expanded search row so list aligns */}
          <div
            className={
              inboxPeekOpen
                ? "hidden"
                : "hidden min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain md:flex"
            }
          >
            <div className="shrink-0 border-b border-slate-100 px-3 pb-3.5 pt-3">
              <div className="flex h-11 items-center justify-center">
                <button
                  type="button"
                  className="flex size-[46px] shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white text-slate-500 shadow-sm ring-1 ring-slate-100/90 transition hover:border-violet-100 hover:bg-violet-50 hover:text-violet-700 hover:shadow-md hover:ring-violet-100 active:scale-[0.98]"
                  aria-label="Search conversations"
                  title="Search"
                >
                  <SearchIcon className="size-[26px] shrink-0 text-slate-600" />
                </button>
              </div>
            </div>
            <ul className="flex w-full flex-col gap-1 px-0">
              {allConversations.map((c) => {
                const isActive = c.id === active?.id;
                return (
                  <li key={`rail-${c.id}`} className="w-full">
                    <button
                      type="button"
                      title={c.name}
                      onClick={() => pickConversation(c.id)}
                      className={`flex w-full items-center justify-center border-l-4 py-3 transition ${
                        isActive
                          ? "border-violet-500 bg-violet-50/90"
                          : "border-transparent hover:bg-slate-50/90"
                      }`}
                    >
                      <span
                        className={`relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-white transition hover:shadow-md hover:ring-2 hover:ring-violet-300 active:scale-[0.97]`}
                      >
                        {initials(c.name)}
                        <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-white bg-emerald-500" />
                        {c.unread_count > 0 ? (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-0.5 text-[9px] font-bold leading-none text-white">
                            {c.unread_count > 9 ? "9+" : c.unread_count}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-auto hidden shrink-0 pb-3 pt-7 text-xs tracking-wide text-slate-300 md:block" aria-hidden>
              ›
            </div>
          </div>
        </aside>

        {/* Center: thread */}
        <section className="flex min-w-0 min-h-0 flex-1 flex-col bg-slate-50/80">
          {active ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-700">
                  {initials(peerName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{peerName}</div>
                  <div className="text-xs text-emerald-600">online</div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div className={`mx-auto w-full ${threadShellTransition} ${threadShellMax}`}>
                  <div className="mb-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-slate-200" />
                    <span className="text-xs text-slate-400">
                      Today, {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" })}
                    </span>
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="space-y-4">
                    {thread.length === 0 ? (
                      <p className="text-center text-sm text-slate-500">No messages in this thread (mock).</p>
                    ) : (
                      thread.map((m) => (
                        <div key={m.id}>
                          <div className="mb-1 text-center text-[11px] text-slate-400">{m.time_label}</div>
                          {m.side === "incoming" ? (
                            <div className="flex gap-2">
                              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                                {initials(peerName)}
                              </span>
                              <div
                                className={
                                  inboxPeekOpen ? "max-w-[85%]" : "max-w-[85%] md:max-w-[min(92%,40rem)]"
                                }
                              >
                                {m.image_slots ? (
                                  <div className="flex gap-2">
                                    {Array.from({ length: m.image_slots }).map((_, i) => (
                                      <div
                                        key={i}
                                        className="h-24 w-28 shrink-0 rounded-xl bg-gradient-to-br from-slate-300 to-slate-400"
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm ring-1 ring-slate-100">
                                    {m.body}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <div
                                className={
                                  inboxPeekOpen
                                    ? "max-w-[min(100%,20rem)] space-y-2 text-right"
                                    : "max-w-[min(100%,20rem)] space-y-2 text-right md:max-w-[min(100%,34rem)] xl:max-w-[min(100%,40rem)]"
                                }
                              >
                                {m.smart_attachment ? (
                                  <SmartAttachmentCard
                                    attachment={m.smart_attachment}
                                    onOpen={() => {
                                      const att = m.smart_attachment;
                                      if (!att) return;
                                      setEditingMessageId(m.id);
                                      const draft =
                                        att.composer_draft ?? fallbackDraftFromSmartAttachment(att, peerName);
                                      if (att.kind === "invoice") {
                                        setComposerLayout("document");
                                        setComposerMode("edit");
                                        setComposerInitialDraft(draft);
                                        setComposerSessionKey((k) => k + 1);
                                        setComposerOpen(true);
                                        return;
                                      }
                                      setReaderAttachment(att);
                                      setReaderOpen(true);
                                    }}
                                  />
                                ) : null}
                                {m.body ? (
                                  <div className="inline-block rounded-2xl rounded-tr-sm bg-violet-600 px-4 py-2.5 text-left text-sm text-white shadow-sm">
                                    {m.body}
                                  </div>
                                ) : null}
                              </div>
                              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[10px] font-bold text-violet-800">
                                ME
                              </span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 border-t border-slate-200 bg-white p-4">
                <div
                  className={`mx-auto flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-[max-width,box-shadow,border-color] duration-300 ease-out focus-within:border-violet-400/70 focus-within:shadow-md focus-within:shadow-violet-500/10 motion-reduce:transition-none ${threadShellMax}`}
                >
                  <textarea
                    ref={threadInputRef}
                    value={draftMessage}
                    onChange={(e) => setDraftMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        sendDraftMessage();
                      }
                    }}
                    rows={2}
                    placeholder="Type your message here"
                    title="⌘↵ or Ctrl+Enter to send"
                    aria-label="Message text"
                    className="min-h-[2.25rem] w-full resize-y border-0 bg-transparent px-4 py-2 text-base leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/95 px-2 py-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-0.5 gap-y-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-violet-600"
                        aria-label="Voice"
                      >
                        <MicIcon />
                      </button>
                      <button
                        type="button"
                        onClick={openNewComposer}
                        className="rounded-lg px-2.5 py-2 text-lg font-semibold leading-none text-violet-600 transition hover:bg-violet-100"
                        aria-label="Add to chat"
                        title="Add document or attachment"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-violet-600"
                        aria-label="Image"
                      >
                        <ImageIcon />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-violet-600"
                        aria-label="Emoji"
                      >
                        <SmileIcon />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-violet-600"
                        aria-label="Location"
                      >
                        <PinIcon />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={sendDraftMessage}
                      disabled={!draftMessage.trim()}
                      className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
              <MessageAttachmentComposer
                open={composerOpen}
                sessionKey={composerSessionKey}
                initialDraft={composerInitialDraft}
                mode={composerMode}
                layout={composerLayout}
                onClose={() => {
                  setComposerOpen(false);
                  setEditingMessageId(null);
                }}
                roomTitle={peerName}
                onSend={(attachment: ThreadSmartAttachment, timeLabel: string) => {
                  if (!active) return;
                  if (editingMessageId) {
                    const patch: Partial<ThreadMessage> = {
                      smart_attachment: attachment,
                      time_label: timeLabel,
                    };
                    const inExtras = extraMessages.some((x) => x.id === editingMessageId);
                    if (inExtras) {
                      setExtraMessages((prev) =>
                        prev.map((x) => (x.id === editingMessageId ? { ...x, ...patch } : x)),
                      );
                    } else {
                      setOverrideById((prev) => ({ ...prev, [editingMessageId]: patch }));
                    }
                    setComposerOpen(false);
                    setEditingMessageId(null);
                    return;
                  }
                  const id = `local-${Date.now()}`;
                  setExtraMessages((prev) => [
                    ...prev,
                    {
                      id,
                      conversation_id: active.id,
                      side: "outgoing",
                      body: "",
                      time_label: timeLabel,
                      smart_attachment: attachment,
                    },
                  ]);
                }}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-500">Select a conversation</div>
          )}
        </section>

        {/* Right: profile + attachments + members */}
        <aside className="hidden w-[min(100%,300px)] shrink-0 overflow-y-auto border-l border-slate-200 bg-white lg:block">
          {active ? (
            <div className="p-5">
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-lg font-bold text-slate-700">
                  {initials(peerName)}
                </div>
                <h2 className="mt-3 text-lg font-semibold capitalize text-slate-900">{peerName}</h2>
                <p className="text-sm text-slate-500">{handle}</p>
              </div>

              <details open className="mt-8 group">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
                  Attachments
                  <span className="text-slate-400">▾</span>
                </summary>
                <ul className="mt-3 space-y-3">
                  {attachments.length === 0 ? (
                    <li className="text-xs text-slate-500">No attachments (mock).</li>
                  ) : (
                    attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex gap-3 rounded-lg border border-slate-100 p-2 hover:bg-slate-50"
                      >
                        {extIcon(a.ext)}
                        <div className="min-w-0 flex-1 text-xs">
                          <div className="truncate font-medium text-slate-800">{a.name}</div>
                          <div className="text-slate-500">
                            {a.size} · {a.date}
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <button type="button" className="mt-2 text-xs font-semibold text-violet-600 hover:underline">
                  View all
                </button>
              </details>

              <details open className="mt-8">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
                  Members
                  <span className="text-slate-400">▾</span>
                </summary>
                <button
                  type="button"
                  className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    +
                  </span>
                  Add Member
                </button>
                <ul className="mt-4 space-y-2">
                  {active.participants.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                        {initials(p.name)}
                      </span>
                      <span className="truncate text-slate-800">{p.name}</span>
                    </li>
                  ))}
                </ul>
              </details>

              <p className="mt-6 text-[10px] text-slate-400">
                Last activity: {formatDateTime(active.last_message_date)}
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      {/* Narrow screens: hint for right column */}
      <p className="border-t border-slate-200 bg-white px-4 py-2 text-center text-[11px] text-slate-500 lg:hidden">
        Widen the window to see profile, attachments, and members.
      </p>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "size-4 shrink-0"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
