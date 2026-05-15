"use client";

import { useMemo, useState } from "react";
import type { Conversation } from "@/lib/types/messages";
import {
  attachmentsForConversation,
  messagesForConversation,
  type ThreadMessage,
  type ThreadSmartAttachment,
} from "@/lib/mock/message-threads";
import { formatDateTime } from "@/lib/format";
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
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? 0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSessionKey, setComposerSessionKey] = useState(0);
  const [composerInitialDraft, setComposerInitialDraft] = useState<AttachmentComposerDraft | null>(null);
  const [composerMode, setComposerMode] = useState<"new" | "edit">("new");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [overrideById, setOverrideById] = useState<Record<string, Partial<ThreadMessage>>>({});
  const [extraMessages, setExtraMessages] = useState<ThreadMessage[]>([]);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

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

  const peerName = active?.name ?? "—";
  const handle = `@${peerName.replace(/\s+/g, "").toLowerCase()}`;

  function openNewComposer() {
    setComposerMode("new");
    setEditingMessageId(null);
    setComposerInitialDraft(null);
    setComposerSessionKey((k) => k + 1);
    setComposerOpen(true);
  }

  function startNewMessageTo(conversationId: number) {
    setActiveId(conversationId);
    setNewMessageOpen(false);
    openNewComposer();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
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
            <ul className="max-h-[min(60vh,320px)] overflow-y-auto py-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => startNewMessageTo(c.id)}
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
        {/* Left: inbox */}
        <aside className="flex w-full min-w-0 flex-col border-slate-200 bg-white md:w-[min(100%,320px)] md:max-w-[360px] md:shrink-0">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                readOnly
                placeholder="People, chat, keywords"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Yesterday
            </p>
            <ul>
              {conversations.map((c) => {
                const isActive = c.id === active?.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
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
              })}
            </ul>
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
                <div className="mx-auto max-w-2xl">
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
                              <div className="max-w-[85%]">
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
                              <div className="max-w-[min(100%,20rem)] space-y-2 text-right">
                                {m.smart_attachment ? (
                                  <SmartAttachmentCard
                                    attachment={m.smart_attachment}
                                    onOpen={() => {
                                      if (!m.smart_attachment) return;
                                      setComposerMode("edit");
                                      setEditingMessageId(m.id);
                                      setComposerInitialDraft(
                                        m.smart_attachment.composer_draft ??
                                          fallbackDraftFromSmartAttachment(m.smart_attachment, peerName),
                                      );
                                      setComposerSessionKey((k) => k + 1);
                                      setComposerOpen(true);
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
              <div className="shrink-0 border-t border-slate-200 bg-white p-3">
                <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <button type="button" className="shrink-0 text-slate-400" aria-label="Voice">
                    <MicIcon />
                  </button>
                  <input
                    readOnly
                    placeholder="Type your message here"
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none"
                  />
                  <button
                    type="button"
                    onClick={openNewComposer}
                    className="shrink-0 rounded-lg px-2 py-1 text-lg font-semibold leading-none text-violet-600 hover:bg-violet-100"
                    aria-label="Add to chat"
                    title="Add document or attachment"
                  >
                    +
                  </button>
                  <button type="button" className="text-slate-400 hover:text-violet-600" aria-label="Image">
                    <ImageIcon />
                  </button>
                  <button type="button" className="text-slate-400 hover:text-violet-600" aria-label="Emoji">
                    <SmileIcon />
                  </button>
                  <button type="button" className="text-slate-400 hover:text-violet-600" aria-label="Location">
                    <PinIcon />
                  </button>
                </div>
              </div>
              <MessageAttachmentComposer
                open={composerOpen}
                sessionKey={composerSessionKey}
                initialDraft={composerInitialDraft}
                mode={composerMode}
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
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
