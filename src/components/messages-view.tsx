"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Conversation } from "@/lib/types/messages";
import {
  mockThreadMessages,
  type ThreadMessage,
  type ThreadSmartAttachment,
} from "@/lib/mock/message-threads";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { AttachmentReaderModal } from "@/components/attachment-reader-modal";
import {
  AttachmentsOnboardingModal,
  hasSeenAttachmentsOnboarding,
  markAttachmentsOnboardingSeen,
} from "@/components/attachments-onboarding-modal";
import { MessageAttachmentComposer } from "@/components/message-attachment-composer";
import type { AttachmentComposerDraft } from "@/lib/attachment-composer-draft";
import { fallbackDraftFromSmartAttachment } from "@/lib/attachment-composer-draft";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { readSessionProjects } from "@/lib/mock/project-session";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { PromoteToMailroomModal } from "@/components/promote-to-mailroom-modal";
import { MessagesConnectHero } from "@/components/messages-connect-hero";
import {
  NewMessageModal,
  participantFromContact,
  type NewMessageStartPayload,
} from "@/components/new-message-modal";
import { loadMailroomState } from "@/lib/mailroom-state";
import { loadContacts } from "@/lib/contacts-store";
import {
  clearJobShareCompose,
  readJobShareCompose,
} from "@/lib/job-share-compose";
import { useCurrentUser } from "@/components/profile-provider";
import { shouldShowSectionCover } from "@/lib/section-cover";
import { useStripSectionCoverWhenPopulated } from "@/lib/section-cover-hooks";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { isClientLiveBackend, isClientMockBackend } from "@/lib/config/backend-mode";
import { getConversations } from "@/lib/mock/conversations";
import {
  conversationListAvatar,
  isSelfParticipant,
  peerParticipant,
  selfParticipant,
} from "@/lib/message-participants";
import { AddConversationMemberModal } from "@/components/add-conversation-member-modal";
import type { Contact } from "@/lib/types/contact";
import { contactPickerLabel } from "@/lib/attachment-contact-options";
import {
  MessageImageStrip,
  MessageImageViewerModal,
} from "@/components/message-chat-images";
import {
  createConversationViaApi,
  deleteMessageViaApi,
  fetchConversationOwnerViaApi,
  fetchConversationsViaApi,
  fetchMessagesViaApi,
  patchMessageImagesViaApi,
  sendMessageViaApi,
} from "@/lib/data/messages-api";
import { uploadMessageImageForConversation } from "@/lib/supabase/upload-message-image";

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
    packing_list: "Packing list",
    tracking: "Tracking",
    task: "Task",
    calendar_event: "Event",
  };
  return map[kind] ?? kind;
}

function revokeMessageImageUrls(urls: string[] | undefined) {
  for (const url of urls ?? []) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "size-3.5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

function SmartAttachmentCard({
  attachment: a,
  onOpen,
  onRemove,
}: {
  attachment: ThreadSmartAttachment;
  onOpen?: () => void;
  onRemove?: () => void;
}) {
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
  const shellClass =
    "relative w-full rounded-2xl rounded-tr-sm border border-violet-200 bg-white px-4 py-3 text-left shadow-sm ring-1 ring-violet-100";

  if (onOpen) {
    return (
      <div className="group/att relative max-w-full">
        <button
          type="button"
          onClick={onOpen}
          className={`${shellClass} transition hover:border-violet-300 hover:ring-violet-200`}
        >
          {body}
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-slate-900/75 text-white opacity-0 shadow-sm transition group-hover/att:opacity-100 hover:bg-red-600 focus:opacity-100"
            aria-label="Remove attachment"
            title="Remove attachment"
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className={shellClass}>
      {body}
    </div>
  );
}

/** Honest presence — we have no live presence channel; show last conversation activity only. */
function peerLastActiveLabel(lastMessageDate: string | null | undefined): string | null {
  if (!lastMessageDate) return null;
  const d = new Date(lastMessageDate);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return null;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `Last active ${mins <= 1 ? "just now" : `${mins}m ago`}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Last active ${days}d ago`;
  return `Last active ${formatShortDate(lastMessageDate)}`;
}

function MemberRow({ participant: p }: { participant: Conversation["participants"][number] }) {
  const subtitle = !p.is_company && p.company_name?.trim() ? p.company_name.trim() : null;
  return (
    <li className="flex items-center gap-2 text-sm">
      <DirectoryAvatar name={p.name} avatarUrl={p.avatar_url} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight text-slate-800">{p.name}</p>
        {subtitle ? <p className="truncate text-[11px] leading-tight text-slate-500">{subtitle}</p> : null}
      </div>
    </li>
  );
}

function OutgoingMessageToolbar({ onDeleteMessage }: { onDeleteMessage: () => void }) {
  return (
    <div className="mb-1 flex justify-end opacity-0 transition group-hover/msg:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={onDeleteMessage}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600"
        title="Delete message"
      >
        <TrashIcon className="size-3" />
        Delete
      </button>
    </div>
  );
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

export function MessagesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const seedConversations = useMemo(
    () => (isClientMockBackend() ? getConversations() : []),
    [],
  );
  const requestedConversationParam = searchParams.get("conversation");
  const requestedConversationId = useMemo(() => {
    if (!requestedConversationParam) return null;
    const n = Number(requestedConversationParam);
    return Number.isFinite(n) ? n : null;
  }, [requestedConversationParam]);

  const [extraConversations, setExtraConversations] = useState<Conversation[]>(() => {
    return readMockLs<Conversation[]>(MOCK_LS.messageConversations) ?? [];
  });
  const [activeId, setActiveId] = useState(
    requestedConversationId ?? seedConversations[0]?.id ?? 0,
  );

  useEffect(() => {
    if (requestedConversationId != null) setActiveId(requestedConversationId);
  }, [requestedConversationId]);

  const composeFromJobShare = searchParams.get("compose") === "job";
  const jobShareComposeOpened = useRef(false);

  useEffect(() => {
    if (!composeFromJobShare || jobShareComposeOpened.current) return;
    jobShareComposeOpened.current = true;
    const session = readJobShareCompose();
    if (!session) return;
    setComposeContactId(session.contactId);
    setPendingThreadDraft(session.body);
    setNewMessageOpen(true);
    clearJobShareCompose();
    const params = new URLSearchParams(searchParams.toString());
    params.delete("compose");
    const q = params.toString();
    router.replace(q ? `/messages?${q}` : "/messages");
  }, [composeFromJobShare, router, searchParams]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSessionKey, setComposerSessionKey] = useState(0);
  const [composerInitialDraft, setComposerInitialDraft] = useState<AttachmentComposerDraft | null>(null);
  const [composerMode, setComposerMode] = useState<"new" | "edit">("new");
  const [composerLayout, setComposerLayout] = useState<"workspace" | "document">("workspace");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [overrideById, setOverrideById] = useState<Record<string, Partial<ThreadMessage>>>({});
  const [extraMessages, setExtraMessages] = useState<ThreadMessage[]>(() => {
    return readMockLs<ThreadMessage[]>(MOCK_LS.messageThreads) ?? [];
  });
  const [deletedMessageIds, setDeletedMessageIds] = useState<Set<string>>(() => {
    const saved = readMockLs<string[]>(MOCK_LS.messageDeletedIds);
    return new Set(saved ?? []);
  });
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [composeContactId, setComposeContactId] = useState<string | null>(null);
  const [pendingThreadDraft, setPendingThreadDraft] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [attachOnboardingOpen, setAttachOnboardingOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerAttachment, setReaderAttachment] = useState<ThreadSmartAttachment | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [inboxPeekOpen, setInboxPeekOpen] = useState(false);
  const [inboxSearchQuery, setInboxSearchQuery] = useState("");
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [mailroomLinks, setMailroomLinks] = useState<Record<number, string>>({});
  const [imageViewer, setImageViewer] = useState<{ urls: string[]; index: number } | null>(null);
  const [liveConversations, setLiveConversations] = useState<Conversation[]>([]);
  const [liveMessages, setLiveMessages] = useState<ThreadMessage[]>([]);
  const [liveLoadingConversations, setLiveLoadingConversations] = useState(false);
  const [liveLoadingMessages, setLiveLoadingMessages] = useState(false);
  const [liveMessagesError, setLiveMessagesError] = useState<string | null>(null);
  const [conversationOwnerId, setConversationOwnerId] = useState<string | null>(null);
  const threadInputRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function syncMailroomLinks() {
      const s = loadMailroomState();
      setMailroomLinks(s.message_links ?? {});
    }
    syncMailroomLinks();
    window.addEventListener("onpro-mailroom-state-changed", syncMailroomLinks);
    return () => window.removeEventListener("onpro-mailroom-state-changed", syncMailroomLinks);
  }, []);

  useEffect(() => {
    if (requestedConversationId == null && extraConversations.length > 0) {
      setActiveId((id) => (id ? id : extraConversations[0].id));
    }
  }, [requestedConversationId, extraConversations]);

  useEffect(() => {
    writeMockLs(MOCK_LS.messageConversations, extraConversations);
  }, [extraConversations]);

  useEffect(() => {
    writeMockLs(MOCK_LS.messageThreads, extraMessages);
  }, [extraMessages]);

  useEffect(() => {
    writeMockLs(MOCK_LS.messageDeletedIds, [...deletedMessageIds]);
  }, [deletedMessageIds]);

  useEffect(() => {
    if (!isClientMockBackend()) return;
    if (extraMessages.length > 0) return;
    setExtraMessages(mockThreadMessages);
  }, [extraMessages]);

  const reloadLiveConversations = useCallback(async () => {
    if (!isClientLiveBackend()) return;
    setLiveLoadingConversations(true);
    try {
      setLiveConversations(await fetchConversationsViaApi());
    } catch (e) {
      console.warn("[messages] load conversations", e);
    } finally {
      setLiveLoadingConversations(false);
    }
  }, []);

  const reloadLiveMessages = useCallback(async (conversationId: number) => {
    if (!isClientLiveBackend()) return;
    setLiveLoadingMessages(true);
    setLiveMessagesError(null);
    try {
      const [messages, ownerId] = await Promise.all([
        fetchMessagesViaApi(conversationId),
        fetchConversationOwnerViaApi(conversationId),
      ]);
      setLiveMessages(messages);
      setConversationOwnerId(ownerId);
    } catch (e) {
      setLiveMessages([]);
      setLiveMessagesError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setLiveLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!isClientLiveBackend()) return;
    void reloadLiveConversations();
  }, [reloadLiveConversations]);

  const allConversations = useMemo(() => {
    if (isClientLiveBackend()) {
      return [...liveConversations].sort((a, b) => {
        const ta = a.last_message_date ? new Date(a.last_message_date).getTime() : 0;
        const tb = b.last_message_date ? new Date(b.last_message_date).getTime() : 0;
        return tb - ta;
      });
    }
    const byId = new Map<number, Conversation>();
    for (const c of seedConversations) byId.set(c.id, c);
    for (const c of extraConversations) byId.set(c.id, c);
    return [...byId.values()].sort((a, b) => {
      const ta = a.last_message_date ? new Date(a.last_message_date).getTime() : 0;
      const tb = b.last_message_date ? new Date(b.last_message_date).getTime() : 0;
      return tb - ta;
    });
  }, [seedConversations, extraConversations, liveConversations]);

  function upsertConversation(updated: Conversation) {
    if (isClientLiveBackend()) {
      setLiveConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === updated.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
      return;
    }
    setExtraConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      const seed = seedConversations.find((c) => c.id === updated.id);
      if (seed) return [...prev, { ...seed, ...updated }];
      return [...prev, updated];
    });
  }

  const showCoverPage = searchParams.get("cover") === "1";
  const conversationCount = allConversations.length;
  const showHero = shouldShowSectionCover(showCoverPage, conversationCount);
  const canOpenInbox = conversationCount > 0;
  useStripSectionCoverWhenPopulated("/messages", searchParams, conversationCount);

  function messagesHref(opts: { cover?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (opts.cover) params.set("cover", "1");
    else params.delete("cover");
    const q = params.toString();
    return q ? `/messages?${q}` : "/messages";
  }

  const openCoverPage = () => router.push(messagesHref({ cover: true }));
  const openInbox = () => router.push(messagesHref({ cover: false }));

  function openImageViewer(urls: string[], index: number) {
    if (!urls[index]) return;
    setImageViewer({ urls, index });
  }

  const active = allConversations.find((c) => c.id === activeId) ?? allConversations[0];

  useEffect(() => {
    if (hasSeenAttachmentsOnboarding()) return;
    if (showHero) return;
    setAttachOnboardingOpen(true);
  }, [showHero]);

  useEffect(() => {
    setDraftMessage("");
  }, [activeId]);

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
    if (isClientLiveBackend()) return liveMessages;
    return extraMessages
      .filter((m) => m.conversation_id === active.id && !deletedMessageIds.has(m.id))
      .map((m) => {
        const o = overrideById[m.id];
        return o ? ({ ...m, ...o } as ThreadMessage) : m;
      });
  }, [active, extraMessages, overrideById, deletedMessageIds, liveMessages]);

  useEffect(() => {
    if (!isClientLiveBackend() || !active?.id) return;
    void reloadLiveMessages(active.id);
  }, [active?.id, reloadLiveMessages]);

  function resolveMessageById(messageId: string): ThreadMessage | null {
    const base = extraMessages.find((m) => m.id === messageId);
    if (!base) return null;
    const o = overrideById[messageId];
    return o ? ({ ...base, ...o } as ThreadMessage) : base;
  }

  function refreshConversationPreviewFromThread(messages: ThreadMessage[]) {
    if (!active) return;
    const last = messages[messages.length - 1];
    if (!last) {
      upsertConversation({
        ...active,
        last_message_preview: "",
        last_message_date: active.last_message_date,
      });
      return;
    }
    const preview =
      last.body.trim() ||
      (last.image_urls?.length
        ? `${last.image_urls.length} photo${last.image_urls.length === 1 ? "" : "s"}`
        : last.smart_attachment?.title ?? "");
    upsertConversation({
      ...active,
      last_message_preview: preview.slice(0, 140),
      last_message_date: new Date().toISOString(),
    });
  }

  function deleteMessage(messageId: string) {
    const msg = isClientLiveBackend()
      ? liveMessages.find((m) => m.id === messageId) ?? null
      : resolveMessageById(messageId);
    if (!msg || msg.side !== "outgoing") return;
    if (!window.confirm("Remove this message from the conversation?")) return;

    if (isClientLiveBackend() && active) {
      void (async () => {
        try {
          await deleteMessageViaApi(messageId);
          await Promise.all([reloadLiveMessages(active.id), reloadLiveConversations()]);
        } catch (e) {
          console.warn("[messages] delete", e);
          window.alert(e instanceof Error ? e.message : "Could not delete message");
        }
      })();
      return;
    }

    revokeMessageImageUrls(msg.image_urls);
    setDeletedMessageIds((prev) => new Set(prev).add(messageId));
    setExtraMessages((prev) => prev.filter((m) => m.id !== messageId));
    setOverrideById((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
    if (editingMessageId === messageId) {
      setComposerOpen(false);
      setEditingMessageId(null);
    }
    const nextThread = thread.filter((m) => m.id !== messageId);
    refreshConversationPreviewFromThread(nextThread);
  }

  function removeMessageImage(messageId: string, index: number) {
    const msg = isClientLiveBackend()
      ? liveMessages.find((m) => m.id === messageId) ?? null
      : resolveMessageById(messageId);
    if (!msg || msg.side !== "outgoing" || !msg.image_urls?.length) return;

    const removed = msg.image_urls[index];
    if (removed?.startsWith("blob:")) URL.revokeObjectURL(removed);

    const nextUrls = msg.image_urls.filter((_, i) => i !== index);
    const hasBody = Boolean(msg.body.trim());
    const hasAttachment = Boolean(msg.smart_attachment);

    if (isClientLiveBackend() && active) {
      void (async () => {
        try {
          if (nextUrls.length === 0 && !hasBody && !hasAttachment) {
            await deleteMessageViaApi(messageId);
          } else {
            await patchMessageImagesViaApi(messageId, nextUrls);
          }
          await Promise.all([reloadLiveMessages(active.id), reloadLiveConversations()]);
        } catch (e) {
          console.warn("[messages] remove image", e);
          window.alert(e instanceof Error ? e.message : "Could not update message");
        }
      })();
      return;
    }

    if (nextUrls.length === 0 && !hasBody && !hasAttachment) {
      setDeletedMessageIds((prev) => new Set(prev).add(messageId));
      setExtraMessages((prev) => prev.filter((m) => m.id !== messageId));
      setOverrideById((prev) => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      refreshConversationPreviewFromThread(thread.filter((m) => m.id !== messageId));
      return;
    }

    const patch: Partial<ThreadMessage> = { image_urls: nextUrls };
    setExtraMessages((prev) =>
      prev.map((x) => (x.id === messageId ? ({ ...x, ...patch } as ThreadMessage) : x)),
    );
    setOverrideById((prev) => {
      if (!prev[messageId]) return prev;
      return { ...prev, [messageId]: { ...prev[messageId], ...patch } };
    });
    const nextThread = thread.map((m) =>
      m.id === messageId ? ({ ...m, image_urls: nextUrls } as ThreadMessage) : m,
    );
    refreshConversationPreviewFromThread(nextThread);
  }

  const attachments = useMemo(() => {
    if (!active) return [];
    return thread
      .filter((m) => m.smart_attachment?.title)
      .map((m) => ({
        id: m.id,
        name: m.smart_attachment!.title,
        ext: "pdf" as const,
        size: m.smart_attachment!.badge ?? "—",
        date: m.time_label,
      }));
  }, [active, thread]);

  const filteredConversations = useMemo(() => {
    const needle = inboxSearchQuery.trim().toLowerCase();
    if (!needle) return allConversations;
    return allConversations.filter((c) => {
      const participantNames = c.participants
        .map((p) => [p.name, p.company_name].filter(Boolean).join(" "))
        .join(" ");
      const blob = `${c.name} ${c.last_message_preview ?? ""} ${participantNames}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [allConversations, inboxSearchQuery]);

  const peer = useMemo(
    () => (active ? peerParticipant(active, user) : null),
    [active, user],
  );
  const self = useMemo(
    () => (active ? selfParticipant(active, user) : null),
    [active, user],
  );
  const peerName = peer?.name ?? active?.name ?? "—";
  const peerLastActive = peerLastActiveLabel(active?.last_message_date);
  const handle = `@${peerName.replace(/\s+/g, "").toLowerCase()}`;
  const activeProject = useMemo(() => {
    if (active?.project_id == null) return undefined;
    if (isClientLiveBackend()) {
      return getLiveCachedProjects().find((p) => p.id === active.project_id);
    }
    return readSessionProjects().find((p) => p.id === active.project_id);
  }, [active?.project_id]);

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
    const merged = [...seedConversations, ...extraConversations];
    const convId = (merged.length ? Math.max(...merged.map((c) => c.id)) : 0) + 1;
    const participantId =
      (merged.length ? Math.max(...merged.flatMap((c) => c.participants.map((p) => p.id))) : 0) + 1;
    return { convId, participantId };
  }

  function addMemberToConversation(contact: Contact) {
    if (!active) return;
    const contacts = loadContacts();
    const label = contactPickerLabel(contact, contacts);
    if (
      active.participants.some(
        (p) => p.name.trim().toLowerCase() === label.trim().toLowerCase(),
      )
    ) {
      setAddMemberOpen(false);
      return;
    }
    const { participantId } = nextIds();
    const newParticipant = participantFromContact(contact, contacts, participantId);
    const nextParticipants = [...active.participants, newParticipant];
    const isGroup = nextParticipants.length > 2;
    let name = active.name;
    if (!active.is_group && isGroup) {
      const peerNames = nextParticipants
        .filter((p) => !isSelfParticipant(p, user))
        .map((p) => p.name);
      name =
        peerNames.length <= 2
          ? peerNames.join(", ")
          : `${peerNames[0]} + ${peerNames.length - 1} others`;
    }
    upsertConversation({
      ...active,
      participants: nextParticipants,
      is_group: isGroup,
      name,
    });
    setAddMemberOpen(false);
  }

  async function createConversation({ contact, name }: NewMessageStartPayload) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const draftAfterCreate = pendingThreadDraft;

    if (isClientLiveBackend()) {
      const contactId = contact?.id ? Number(contact.id) : NaN;
      try {
        const conv = await createConversationViaApi({
          name: trimmed,
          participantContactIds: Number.isFinite(contactId) ? [contactId] : [],
        });
        await reloadLiveConversations();
        setActiveId(conv.id);
        setNewMessageOpen(false);
        setComposeContactId(null);
        if (showCoverPage) router.replace(messagesHref({ cover: false }));
        if (draftAfterCreate?.trim()) {
          setPendingThreadDraft(draftAfterCreate);
          setDraftMessage(draftAfterCreate.trim());
        }
        focusThreadInput();
      } catch (e) {
        console.warn("[messages] create conversation", e);
        window.alert(e instanceof Error ? e.message : "Could not create conversation");
      }
      return;
    }

    const existing = allConversations.find(
      (c) => c.name.localeCompare(trimmed, undefined, { sensitivity: "base" }) === 0,
    );
    if (existing) {
      pickConversation(existing.id);
      setNewMessageOpen(false);
      setComposeContactId(null);
      if (showCoverPage) router.replace(messagesHref({ cover: false }));
      if (draftAfterCreate?.trim()) setDraftMessage(draftAfterCreate.trim());
      focusThreadInput();
      return;
    }

    const contacts = loadContacts();
    const { convId, participantId } = nextIds();
    const selfParticipantId = participantId + 1;
    const peer = contact
      ? participantFromContact(contact, contacts, participantId)
      : { id: participantId, name: trimmed, avatar_url: null as string | null };

    const selfName = user?.fullName?.trim() || user?.email?.split("@")[0] || "You";
    const row: Conversation = {
      id: convId,
      name: trimmed,
      avatar_url: peer.avatar_url ?? contact?.avatar_url ?? null,
      last_message_preview: null,
      last_message_date: new Date().toISOString(),
      unread_count: 0,
      participants: [
        peer,
        {
          id: selfParticipantId,
          name: selfName,
          avatar_url: user?.avatarUrl ?? null,
          company_name: user?.companyName?.trim() || undefined,
        },
      ],
      is_group: false,
      project_id: null,
    };
    setExtraConversations((prev) => [...prev, row]);
    setActiveId(convId);
    setNewMessageOpen(false);
    setComposeContactId(null);
    if (showCoverPage) router.replace(messagesHref({ cover: false }));
    if (draftAfterCreate?.trim()) setDraftMessage(draftAfterCreate.trim());
    focusThreadInput();
  }

  /** Pick an existing thread from the New message sheet — opens the composer only for typing, not attachments. */
  function openExistingChatFromModal(conversationId: number) {
    pickConversation(conversationId);
    setNewMessageOpen(false);
    focusThreadInput();
  }

  async function sendDraftMessage() {
    if (!active) return;
    const trimmed = draftMessage.trim();
    if (!trimmed) return;

    if (isClientLiveBackend()) {
      try {
        await sendMessageViaApi({ conversationId: active.id, content: trimmed });
        setDraftMessage("");
        await Promise.all([reloadLiveMessages(active.id), reloadLiveConversations()]);
        focusThreadInput();
      } catch (e) {
        console.warn("[messages] send", e);
        window.alert(e instanceof Error ? e.message : "Could not send message");
      }
      return;
    }

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
    setDraftMessage("");
    upsertConversation({
      ...active,
      last_message_preview: trimmed.slice(0, 140),
      last_message_date: new Date().toISOString(),
    });
    focusThreadInput();
  }

  async function sendImagesFromFiles(files: FileList | null) {
    if (!active || !files?.length) return;

    const caption = draftMessage.trim();

    if (isClientLiveBackend()) {
      let ownerId = conversationOwnerId;
      if (!ownerId) {
        try {
          ownerId = await fetchConversationOwnerViaApi(active.id);
          setConversationOwnerId(ownerId);
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Could not resolve conversation");
          return;
        }
      }
      const urls: string[] = [];
      try {
        for (let i = 0; i < Math.min(files.length, 6); i++) {
          const file = files[i];
          if (!file.type.startsWith("image/")) continue;
          urls.push(await uploadMessageImageForConversation(ownerId, active.id, file));
        }
        if (urls.length === 0) return;
        await sendMessageViaApi({
          conversationId: active.id,
          content: caption,
          imageUrls: urls,
        });
        setDraftMessage("");
        if (imageInputRef.current) imageInputRef.current.value = "";
        await Promise.all([reloadLiveMessages(active.id), reloadLiveConversations()]);
      } catch (e) {
        console.warn("[messages] send images", e);
        window.alert(e instanceof Error ? e.message : "Could not send images");
      }
      return;
    }

    const urls: string[] = [];
    for (let i = 0; i < Math.min(files.length, 6); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      urls.push(URL.createObjectURL(file));
    }
    if (urls.length === 0) return;
    const id = `local-img-${Date.now()}`;
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
        body: caption,
        time_label: timeLabel,
        image_urls: urls,
      },
    ]);
    upsertConversation({
      ...active,
      last_message_preview: caption || `${urls.length} photo${urls.length === 1 ? "" : "s"}`,
      last_message_date: new Date().toISOString(),
    });
    setDraftMessage("");
    if (imageInputRef.current) imageInputRef.current.value = "";
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <AttachmentsOnboardingModal open={attachOnboardingOpen} onDismiss={dismissAttachOnboarding} />
      <MessageImageViewerModal
        open={imageViewer != null}
        urls={imageViewer?.urls ?? []}
        index={imageViewer?.index ?? 0}
        onClose={() => setImageViewer(null)}
        onIndexChange={(index) =>
          setImageViewer((prev) => (prev ? { ...prev, index } : null))
        }
      />
      {promoteOpen && active ? (
        <PromoteToMailroomModal
          conversation={active}
          messages={thread.map((m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            body: m.body,
            side: m.side,
            time_label: m.time_label,
          }))}
          connectedEmail="me@connectdots"
          onClose={() => setPromoteOpen(false)}
          onPromoted={(threadId) => {
            setMailroomLinks((prev) => ({ ...prev, [active.id]: threadId }));
            setPromoteOpen(false);
          }}
        />
      ) : null}
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
      <div className="shrink-0">
        <PageHeader
          title="Messages"
          onInfoClick={openCoverPage}
          infoLabel="About Messages"
          action={
            <button
              type="button"
              onClick={() => setNewMessageOpen(true)}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90"
            >
              New message
            </button>
          }
        />
      </div>

      <NewMessageModal
        open={newMessageOpen}
        onClose={() => {
          setNewMessageOpen(false);
          setComposeContactId(null);
          setPendingThreadDraft(null);
        }}
        onStart={createConversation}
        onOpenExisting={openExistingChatFromModal}
        existingConversations={allConversations}
        initialContactId={composeContactId}
      />

      <AddConversationMemberModal
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onAdd={addMemberToConversation}
        existingParticipants={active?.participants ?? []}
      />

      {showHero ? (
        <MessagesConnectHero
          onStartConversation={() => setNewMessageOpen(true)}
          onSeeSmartAttachments={() => setAttachOnboardingOpen(true)}
          onDismiss={canOpenInbox && showCoverPage ? openInbox : undefined}
        />
      ) : (
      <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50">

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
                  const listAvatar = conversationListAvatar(c, user);
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
                          <DirectoryAvatar
                            name={listAvatar.name}
                            avatarUrl={listAvatar.avatarUrl}
                            size="list"
                          />
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
                const listAvatar = conversationListAvatar(c, user);
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
                      <span className="relative shrink-0 shadow-sm ring-1 ring-white transition hover:shadow-md hover:ring-2 hover:ring-violet-300 active:scale-[0.97] rounded-full">
                        <DirectoryAvatar
                          name={listAvatar.name}
                          avatarUrl={listAvatar.avatarUrl}
                          size="sm"
                        />
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
              <div className="shrink-0 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-3 px-4 py-3">
                  <DirectoryAvatar
                    name={peer?.name ?? peerName}
                    avatarUrl={peer?.avatar_url ?? active.avatar_url}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-900">{peerName}</div>
                    {peerLastActive ? (
                      <div className="text-xs text-slate-500">{peerLastActive}</div>
                    ) : null}
                  </div>
                  {active && mailroomLinks[active.id] ? (
                    <Link
                      href={`/mailroom?thread=${encodeURIComponent(mailroomLinks[active.id])}`}
                      className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100"
                    >
                      🔗 Open in Mailroom
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPromoteOpen(true)}
                      disabled={!active || thread.length === 0}
                      className="shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
                      title="Summarize this conversation and create a Mailroom thread"
                    >
                      ✨ Summarize & promote
                    </button>
                  )}
                </div>
                {active && mailroomLinks[active.id] ? (
                  <div className="border-t border-violet-100 bg-violet-50/50 px-4 py-1.5 text-[11px] text-violet-700">
                    This conversation has been promoted to the Mailroom for agent triage.
                  </div>
                ) : null}
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
                    {liveLoadingMessages ? (
                      <p className="text-center text-sm text-slate-500">Loading messages…</p>
                    ) : liveMessagesError ? (
                      <p className="text-center text-sm text-red-600">{liveMessagesError}</p>
                    ) : thread.length === 0 ? (
                      <p className="text-center text-sm text-slate-500">No messages yet. Say hello below.</p>
                    ) : (
                      thread.map((m) => (
                        <div key={m.id}>
                          <div className="mb-1 text-center text-[11px] text-slate-400">{m.time_label}</div>
                          {m.side === "incoming" ? (
                            <div className="flex gap-2">
                              <div className="mt-1 shrink-0">
                                <DirectoryAvatar
                                  name={peer?.name ?? peerName}
                                  avatarUrl={peer?.avatar_url ?? active.avatar_url}
                                  size="xs"
                                />
                              </div>
                              <div
                                className={
                                  inboxPeekOpen ? "max-w-[85%]" : "max-w-[85%] md:max-w-[min(92%,40rem)]"
                                }
                              >
                                {m.image_urls?.length || m.image_slots ? (
                                  <div className="space-y-2">
                                    {m.image_urls?.length ? (
                                      <MessageImageStrip
                                        urls={m.image_urls}
                                        onOpenAt={(index) => openImageViewer(m.image_urls!, index)}
                                      />
                                    ) : m.image_slots ? (
                                      <div className="flex gap-2">
                                        {Array.from({ length: m.image_slots }).map((_, i) => (
                                          <div
                                            key={i}
                                            className="h-24 w-28 shrink-0 rounded-xl bg-gradient-to-br from-slate-300 to-slate-400"
                                          />
                                        ))}
                                      </div>
                                    ) : null}
                                    {m.body ? (
                                      <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm ring-1 ring-slate-100">
                                        {m.body}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm ring-1 ring-slate-100">
                                    {m.body}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="group/msg flex justify-end gap-2">
                              <div
                                className={
                                  inboxPeekOpen
                                    ? "max-w-[min(100%,20rem)] space-y-2 text-right"
                                    : "max-w-[min(100%,20rem)] space-y-2 text-right md:max-w-[min(100%,34rem)] xl:max-w-[min(100%,40rem)]"
                                }
                              >
                                <OutgoingMessageToolbar onDeleteMessage={() => deleteMessage(m.id)} />
                                {m.image_urls?.length ? (
                                  <MessageImageStrip
                                    urls={m.image_urls}
                                    alignEnd
                                    removable
                                    onRemoveAt={(index) => removeMessageImage(m.id, index)}
                                    onOpenAt={(index) => openImageViewer(m.image_urls!, index)}
                                  />
                                ) : null}
                                {m.smart_attachment ? (
                                  <SmartAttachmentCard
                                    attachment={m.smart_attachment}
                                    onRemove={() => deleteMessage(m.id)}
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
                              <div className="mt-1 shrink-0">
                                <DirectoryAvatar
                                  name={self?.name ?? "You"}
                                  avatarUrl={self?.avatar_url ?? user?.avatarUrl}
                                  size="xs"
                                />
                              </div>
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
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void sendDraftMessage();
                      }
                    }}
                    rows={2}
                    placeholder="Type your message here (Enter to send)"
                    title="Enter to send · Shift+Enter for a new line"
                    aria-label="Message text"
                    className="min-h-[2.25rem] w-full resize-y border-0 bg-transparent px-4 py-2 text-base leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    multiple
                    className="hidden"
                    aria-hidden
                    onChange={(e) => {
                      sendImagesFromFiles(e.target.files);
                    }}
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/95 px-2 py-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-0.5 gap-y-1">
                      {/* Voice — hidden for now
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-violet-600"
                        aria-label="Voice"
                      >
                        <MicIcon />
                      </button>
                      */}
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
                        onClick={() => imageInputRef.current?.click()}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-violet-600"
                        aria-label="Add photos"
                        title="Add photos to message"
                      >
                        <ImageIcon />
                      </button>
                      {/* Emoji — hidden for now
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-violet-600"
                        aria-label="Emoji"
                      >
                        <SmileIcon />
                      </button>
                      */}
                      {/* Location — hidden for now
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200/80 hover:text-violet-600"
                        aria-label="Location"
                      >
                        <PinIcon />
                      </button>
                      */}
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void sendDraftMessage()}
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
                projectId={active?.project_id ?? null}
                linkedProjectName={activeProject?.name ?? null}
                onSend={(attachment: ThreadSmartAttachment, timeLabel: string) => {
                  if (!active) return;
                  if (isClientLiveBackend()) {
                    void (async () => {
                      try {
                        await sendMessageViaApi({
                          conversationId: active.id,
                          smartAttachment: attachment,
                        });
                        setComposerOpen(false);
                        setEditingMessageId(null);
                        await Promise.all([
                          reloadLiveMessages(active.id),
                          reloadLiveConversations(),
                        ]);
                      } catch (e) {
                        window.alert(e instanceof Error ? e.message : "Could not send attachment");
                      }
                    })();
                    return;
                  }
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
                <div className="mx-auto w-fit">
                  <DirectoryAvatar
                    name={peer?.name ?? peerName}
                    avatarUrl={peer?.avatar_url ?? active.avatar_url}
                    size="lg"
                  />
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
                    <li className="text-xs text-slate-500">No attachments yet.</li>
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
                        <button
                          type="button"
                          onClick={() => deleteMessage(a.id)}
                          className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${a.name}`}
                          title="Remove attachment"
                        >
                          <TrashIcon />
                        </button>
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
                  onClick={() => setAddMemberOpen(true)}
                  className="mt-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                    +
                  </span>
                  Add Member
                </button>
                <ul className="mt-4 space-y-2">
                  {active.participants.map((p) => (
                    <MemberRow key={p.id} participant={p} />
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
      )}
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
