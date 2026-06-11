"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
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
  MailroomRfqIntake,
  MailroomWorkflow,
  MailroomWorkflowStep,
} from "@/lib/types/agent";
import {
  MOCK_EMAIL_THREADS,
  suggestionsForThread,
  workflowForThread,
} from "@/lib/mock/email-threads";
import {
  buildStepExecContext,
  buildWorkflowSuccessSummary,
  countPendingWorkflowSteps,
  formatPayloadValue,
  patchWorkflowStep,
  normalizeWorkflowForWorkspace,
  resolveWorkflowProjectId,
  workflowMissingProjectMessage,
  workflowProjectAlreadyCreated,
  workflowStepNeedsProject,
  workflowToSuggestions,
  type WorkflowSuccessSummary,
} from "@/lib/mailroom/workflow-utils";
import {
  enrichSuggestionPayloadForThread,
  lastAppliedJobId,
} from "@/lib/mailroom/enrich-suggestion-payload";
import {
  buildMailroomThreadWorkspaceContext,
  mailroomWorkspaceContextForPrompt,
} from "@/lib/mailroom/thread-workspace-context";
import {
  appendKeyToFieldOrder,
  ensurePayloadFieldOrder,
  isPayloadFieldKey,
  movePayloadField,
  orderedPayloadEntries,
  payloadWithFieldOrder,
  removeKeyFromFieldOrder,
  stripPayloadFieldOrder,
} from "@/lib/mailroom/payload-field-order";
import {
  MailroomWorkflowPlanModal,
  MailroomWorkflowSuccessModal,
} from "@/components/mailroom-workflow-plan";
import { MAILROOM_Z_DOC_PREVIEW } from "@/lib/mailroom/modal-layers";
import { MailroomRfqReviewModal } from "@/components/mailroom-rfq-intake-card";
import { isRfqIntakeConfirmed, mailroomNeedsRfqConfirm } from "@/lib/mailroom/rfq-intake";
import { isClientMockBackend } from "@/lib/config/backend-mode";
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
  removePromotedThreadFromMailroom,
  canRemoveThreadFromMailroom,
  isSuggestionRemoved,
  removeSuggestion,
  clearMailroomFreshSummarizeFlag,
  clearThreadMailroomAiResults,
  resetThreadSummarizeArtifacts,
  resolveSuggestionStatus,
  confirmRfqIntake,
  saveMailroomWorkflow,
  saveRfqIntakeDraft,
  setRfqPlanPanelOpen,
  setWorkflowPlanPanelOpen,
  saveThreadSummary,
  setSuggestionStatus,
  setThreadStatus,
  linkWorkflowToExistingProject,
  unlinkWorkflowFromExistingProject,
  updateMailroomWorkflow,
} from "@/lib/mailroom-state";
import { generatedItemFromSuggestion, generatedKindFromSuggestion } from "@/lib/agent-apply";
import {
  dispatchWorkspaceDataChanged,
  executeAgentSuggestionClient,
} from "@/lib/execute-agent-suggestion-client";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { resolveClientProjectList } from "@/lib/mock/project-session";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  applySuggestionViaApi,
  disconnectGmailViaApi,
  fetchMailroomBootstrapViaApi,
  fetchMailroomThreadDetailViaApi,
  fetchMailroomThreadsViaApi,
  GmailStatusError,
  mailroomApiEnabled,
  MAILROOM_FIRST_INBOX_PAGE_SIZE,
  MAILROOM_REFRESH_INBOX_PAGE_SIZE,
  sendMailroomChatViaApi,
  invalidateMailroomSummarizeCache,
  summarizeThreadViaApi,
  type MailroomBootstrapResponse,
  type MailroomChatResponse,
} from "@/lib/data/mailroom-api";
import { detectMailroomChatIntent } from "@/lib/mailroom/chat-intent";
import { filterImportedGmailThreads } from "@/lib/mailroom/filter-gmail-threads";
import {
  clearMailroomGmailThreadCache,
  getCachedMailroomGmailThreads,
  mergeCachedMailroomGmailThreads,
  refreshMailroomGmailFromBootstrap,
} from "@/lib/mailroom/gmail-thread-cache";
import { MailroomConnectHero } from "@/components/mailroom-connect-hero";
import { useCurrentUser } from "@/components/profile-provider";
import { shouldShowSectionCover } from "@/lib/section-cover";
import { useStripSectionCoverWhenPopulated } from "@/lib/section-cover-hooks";
import { ToastViewport } from "@/components/toast-viewport";
import { emailBodyPreview, normalizeEmailBody } from "@/lib/email-body";
import { importMailroomImagesToDocuments } from "@/lib/documents/import-mailroom-images";
import { getDocuments } from "@/lib/mock/documents";

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

function MailroomShell({
  children,
  onInfoClick,
  infoLabel,
}: {
  children: ReactNode;
  onInfoClick?: () => void;
  infoLabel?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Mailroom"
          onInfoClick={onInfoClick}
          infoLabel={infoLabel}
        />
      </div>
      {children}
    </div>
  );
}

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

function suggestionForKind(
  thread: EmailThread,
  kind: AgentSuggestionKind,
  overrides?: { title?: string; payload?: Record<string, unknown> },
): AgentSuggestion {
  const titles: Record<AgentSuggestionKind, string> = {
    create_project: `Create project from "${thread.subject}"`,
    create_order: "Create production order for this project",
    create_job: "Add a job draft to this project",
    add_vendor_quote: `Capture vendor quote from ${thread.related?.vendor ?? "vendor"}`,
    add_costing_line: "Add a costing line",
    generate_estimate: "Generate an estimate",
    create_invoice: "Draft an invoice",
    update_project: "Update project name or details",
    update_client_po: "Set client PO from this thread",
    update_sample_milestone: "Update a sample milestone",
    log_packing_list: "Update the packing list variant",
    team_note: "Add a task for the team",
  };
  return {
    id: makeId("sug"),
    thread_id: thread.id,
    kind,
    title: overrides?.title ?? titles[kind],
    payload: { ...(thread.related ?? {}), ...(overrides?.payload ?? {}) },
    status: "pending",
    created_at: nowIso(),
  };
}

function suggestionFromChatProposal(
  thread: EmailThread,
  proposal: NonNullable<MailroomChatResponse["propose_suggestion"]>,
  workflow?: MailroomWorkflow,
): AgentSuggestion {
  const payload = enrichSuggestionPayloadForThread(proposal.kind, proposal.payload ?? {}, {
    workflow,
    threadSubject: thread.subject,
  });
  return suggestionForKind(thread, proposal.kind, {
    title: proposal.title,
    payload,
  });
}

function mergeGmailThreadLists(existing: EmailThread[], incoming: EmailThread[]): EmailThread[] {
  const byId = new Map(existing.map((t) => [t.id, t]));
  for (const t of incoming) byId.set(t.id, t);
  return [...byId.values()].sort((a, b) => {
    const atA = a.messages[a.messages.length - 1]?.at ?? "";
    const atB = b.messages[b.messages.length - 1]?.at ?? "";
    return atB.localeCompare(atA);
  });
}

function readMailroomLastRefreshMs(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem("onpro_mailroom_last_inbox_refresh");
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function touchMailroomLastRefreshMs(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("onpro_mailroom_last_inbox_refresh", String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function MailroomView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: currentUser } = useCurrentUser();
  const requestedThreadId = searchParams.get("thread");
  const showCoverPage = searchParams.get("cover") === "1";
  const gmailOAuthFlag = searchParams.get("gmail");
  const isMock = isClientMockBackend();
  const isLiveMailroom = mailroomApiEnabled();
  const [state, setState] = useState<MailroomState | null>(() => loadMailroomState());
  const [gmailThreads, setGmailThreads] = useState<EmailThread[]>([]);
  const [gmailNextPageToken, setGmailNextPageToken] = useState<string | null>(null);
  const [gmailThreadsLoading, setGmailThreadsLoading] = useState(false);
  const [gmailLoadingMore, setGmailLoadingMore] = useState(false);
  const [gmailInboxEstimate, setGmailInboxEstimate] = useState<number | null>(null);
  const [gmailSyncComplete, setGmailSyncComplete] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [gmailSearchActive, setGmailSearchActive] = useState(false);
  const [gmailSearchResults, setGmailSearchResults] = useState<EmailThread[]>([]);
  const [gmailSearching, setGmailSearching] = useState(false);
  const gmailBackgroundLoadRef = useRef(false);
  const gmailFullThreadIdsRef = useRef(new Set<string>());
  const lastInboxRefreshRef = useRef(0);
  const inboxRefreshInFlightRef = useRef(false);
  const [gmailThreadDetailLoading, setGmailThreadDetailLoading] = useState(false);
  const [gmailStatus, setGmailStatus] = useState({
    loading: isLiveMailroom && gmailOAuthFlag !== "connected",
    connected: gmailOAuthFlag === "connected",
    email: null as string | null,
    oauthConfigured: false,
    message: undefined as string | undefined,
  });
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(requestedThreadId);
  const [toast, setToast] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<GeneratedItem | null>(null);
  const [showAllThreads, setShowAllThreads] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<EmailAttachment[]>([]);
  const [attachPickerOpen, setAttachPickerOpen] = useState(false);
  const [pane, setPane] = useState<"chat" | "emails">("chat");
  const [previewSuggestion, setPreviewSuggestion] = useState<AgentSuggestion | null>(null);
  const [previewWorkflowStep, setPreviewWorkflowStep] = useState<MailroomWorkflowStep | null>(null);
  /** When true, preview opened from Quick generate — emphasize Generate & attach. */
  const [previewAttachMode, setPreviewAttachMode] = useState(false);
  const [chatReplying, setChatReplying] = useState(false);
  /** Workflow step id being applied, or "all" for run-all. Blocks duplicate clicks. */
  const [workflowApplying, setWorkflowApplying] = useState<string | null>(null);
  /** Polished follow-up after all workflow steps finish. */
  const [workflowSuccess, setWorkflowSuccess] = useState<WorkflowSuccessSummary | null>(null);
  const prevWorkflowPendingRef = useRef<Record<string, number>>({});

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
    if (requestedThreadId) {
      const knownIds = new Set([
        ...(isMock ? MOCK_EMAIL_THREADS.map((t) => t.id) : []),
        ...loaded.promoted_threads.map((t) => t.id),
      ]);
      if (knownIds.has(requestedThreadId)) setSelectedThreadId(requestedThreadId);
    } else if (isMock && MOCK_EMAIL_THREADS[0]) {
      setSelectedThreadId(MOCK_EMAIL_THREADS[0].id);
    }
  }, [requestedThreadId, isMock]);

  useEffect(() => {
    const syncMailroom = () => setState(loadMailroomState());
    window.addEventListener("onpro-mailroom-state-changed", syncMailroom);
    window.addEventListener("onpro-projects-changed", syncMailroom);
    return () => {
      window.removeEventListener("onpro-mailroom-state-changed", syncMailroom);
      window.removeEventListener("onpro-projects-changed", syncMailroom);
    };
  }, []);

  async function loadNextGmailPage(startToken: string, estimate?: number | null) {
    if (gmailBackgroundLoadRef.current || !startToken) return;
    gmailBackgroundLoadRef.current = true;
    setGmailLoadingMore(true);
    try {
      const data = await fetchMailroomThreadsViaApi({
        pageToken: startToken,
        maxResults: 40,
      });
      const inboxEstimate = data.resultSizeEstimate ?? estimate ?? gmailInboxEstimate;
      setGmailInboxEstimate(inboxEstimate);
      setGmailThreads((prev) => mergeGmailThreadLists(prev, data.threads));
      mergeCachedMailroomGmailThreads(data.threads, data.nextPageToken ?? null, {
        estimatedTotal: inboxEstimate,
        markComplete: !data.nextPageToken,
      });
      const token = data.nextPageToken ?? null;
      setGmailNextPageToken(token);
      setGmailSyncComplete(!token);
    } catch (e) {
      console.warn("[mailroom] Gmail page load failed", e);
      setToast("Could not load more threads — scroll to try again.");
    } finally {
      gmailBackgroundLoadRef.current = false;
      setGmailLoadingMore(false);
    }
  }

  const applyBootstrapThreads = useCallback((bootstrap: MailroomBootstrapResponse) => {
    const estimate = bootstrap.resultSizeEstimate ?? null;
    setGmailInboxEstimate(estimate);
    const merged = mergeCachedMailroomGmailThreads(
      bootstrap.threads,
      bootstrap.nextPageToken ?? null,
      { estimatedTotal: estimate, markComplete: !bootstrap.nextPageToken },
    );
    setGmailThreads(merged);
    setGmailNextPageToken(bootstrap.nextPageToken ?? null);
    setGmailSyncComplete(!bootstrap.nextPageToken);
    return merged;
  }, []);

  const refreshInbox = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isLiveMailroom || gmailSearchActive || inboxRefreshInFlightRef.current) return;
      inboxRefreshInFlightRef.current = true;
      setGmailThreadsLoading(true);
      try {
        const bootstrap = await fetchMailroomBootstrapViaApi({
          maxResults: MAILROOM_REFRESH_INBOX_PAGE_SIZE,
          fresh: true,
        });
        if (!bootstrap.connected) return;
        const estimate = bootstrap.resultSizeEstimate ?? null;
        setGmailInboxEstimate(estimate);
        const { threads: merged, newThreadIds, updatedThreadIds } =
          refreshMailroomGmailFromBootstrap(bootstrap.threads, bootstrap.nextPageToken ?? null, {
            estimatedTotal: estimate,
            markComplete: !bootstrap.nextPageToken,
          });
        setGmailThreads(merged);
        setGmailNextPageToken(bootstrap.nextPageToken ?? null);
        setGmailSyncComplete(!bootstrap.nextPageToken);
        lastInboxRefreshRef.current = Date.now();
        touchMailroomLastRefreshMs();

        const incomingCount = newThreadIds.length + updatedThreadIds.length;
        if (incomingCount > 0) {
          if (newThreadIds[0]) setSelectedThreadId(newThreadIds[0]);
          else if (updatedThreadIds[0]) setSelectedThreadId(updatedThreadIds[0]);
          const label =
            newThreadIds.length > 0
              ? `${newThreadIds.length} new thread${newThreadIds.length === 1 ? "" : "s"}`
              : `${updatedThreadIds.length} updated thread${updatedThreadIds.length === 1 ? "" : "s"}`;
          setToast(opts?.silent ? `New mail · ${label}` : `Inbox updated · ${label}`);
        } else if (!opts?.silent) {
          setToast(`Inbox updated · ${merged.length} thread${merged.length === 1 ? "" : "s"}`);
        }
      } catch (e) {
        if (!opts?.silent) {
          setToast(e instanceof Error ? e.message : "Could not refresh inbox");
        }
      } finally {
        inboxRefreshInFlightRef.current = false;
        setGmailThreadsLoading(false);
      }
    },
    [gmailSearchActive, isLiveMailroom],
  );

  async function runGmailInboxSearch() {
    const q = threadSearch.trim();
    if (!q) {
      setGmailSearchActive(false);
      setGmailSearchResults([]);
      return;
    }
    setGmailSearching(true);
    try {
      const data = await fetchMailroomThreadsViaApi({ q, maxResults: 40 });
      setGmailSearchResults(data.threads);
      setGmailSearchActive(true);
      if (data.threads.length === 0) {
        setToast(`No threads found for “${q}”.`);
      } else if (data.threads[0]) {
        setSelectedThreadId(data.threads[0].id);
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Gmail search failed");
    } finally {
      setGmailSearching(false);
    }
  }

  useEffect(() => {
    if (!isLiveMailroom) {
      setGmailStatus((s) => ({ ...s, loading: false }));
      return;
    }
    let cancelled = false;

    async function loadMailroom(attempt = 0) {
      let statusConnected = false;
      try {
        const bootstrap = await fetchMailroomBootstrapViaApi({
          maxResults: MAILROOM_FIRST_INBOX_PAGE_SIZE,
          fresh:
            gmailOAuthFlag === "connected" ||
            Date.now() - readMailroomLastRefreshMs() > 60_000,
        });
        if (cancelled) return;
        statusConnected = bootstrap.connected;
        const effectiveConnected =
          bootstrap.connected || (gmailOAuthFlag === "connected" && attempt < 2);
        setGmailStatus({
          loading: false,
          connected: effectiveConnected,
          email: bootstrap.email,
          oauthConfigured: bootstrap.oauthConfigured ?? true,
          message: bootstrap.message,
        });
        if (!bootstrap.connected) {
          setGmailThreads([]);
          if (gmailOAuthFlag === "connected" && attempt < 2) {
            await new Promise((r) => setTimeout(r, 500));
            if (!cancelled) await loadMailroom(attempt + 1);
          }
          return;
        }

        if (gmailOAuthFlag === "connected") {
          clearMailroomGmailThreadCache();
          gmailFullThreadIdsRef.current.clear();
          const params = new URLSearchParams(searchParams.toString());
          params.delete("gmail");
          params.delete("cover");
          const q = params.toString();
          router.replace(q ? `/mailroom?${q}` : "/mailroom", { scroll: false });
        }

        setGmailThreadsLoading(true);
        try {
          const cached = getCachedMailroomGmailThreads();
          if (!cancelled && cached.fresh && cached.threads.length > 0 && !gmailOAuthFlag) {
            setGmailThreads(cached.threads);
            setGmailNextPageToken(cached.nextPageToken);
            setGmailInboxEstimate(cached.sync.estimatedTotal);
            setGmailSyncComplete(cached.sync.complete);
            if (!selectedThreadId && cached.threads[0]) {
              setSelectedThreadId(cached.threads[0].id);
            }
          }

          if (!cancelled) {
            applyBootstrapThreads(bootstrap);
            if (!selectedThreadId && bootstrap.threads[0]) {
              setSelectedThreadId(bootstrap.threads[0].id);
            }
          }
        } catch (threadErr) {
          console.warn("[mailroom] Gmail threads load failed", threadErr);
          if (!cancelled) {
            setGmailThreads([]);
            const msg =
              threadErr instanceof Error
                ? threadErr.message
                : "Could not load inbox threads.";
            setGmailStatus((s) => ({
              ...s,
              loading: false,
              connected: true,
              message:
                msg.includes("502") || msg.includes("Failed to load")
                  ? "Gmail is connected but inbox load timed out — try Refresh. Large inboxes may take a moment."
                  : `Gmail is connected but inbox could not load: ${msg}`,
            }));
            setToast("Inbox load failed — tap Refresh or try again in a moment.");
          }
        } finally {
          if (!cancelled) {
            setGmailThreadsLoading(false);
            lastInboxRefreshRef.current = Date.now();
            touchMailroomLastRefreshMs();
          }
        }
      } catch (e) {
        console.warn("[mailroom] Mailroom bootstrap failed", e);
        if (!cancelled) {
          const needsSignIn = e instanceof GmailStatusError && e.status === 401;
          setGmailStatus({
            loading: false,
            connected: statusConnected,
            email: null,
            oauthConfigured: true,
            message: needsSignIn
              ? "Please sign in to OnPro first, then connect Gmail."
              : e instanceof Error
                ? e.message
                : "Could not reach Mailroom. Refresh and try again.",
          });
          if (!statusConnected) setGmailThreads([]);
          if (gmailOAuthFlag === "connected" && attempt < 2 && !statusConnected) {
            await new Promise((r) => setTimeout(r, 500));
            if (!cancelled) await loadMailroom(attempt + 1);
          }
        }
      }
    }

    void loadMailroom();
    return () => {
      cancelled = true;
    };
  }, [isLiveMailroom, gmailOAuthFlag, router, searchParams]);

  const refreshInboxRef = useRef(refreshInbox);
  refreshInboxRef.current = refreshInbox;

  useEffect(() => {
    if (!isLiveMailroom || !gmailStatus.connected || gmailSearchActive) return;
    const MIN_REFRESH_MS = 30_000;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastInboxRefreshRef.current < MIN_REFRESH_MS) return;
      void refreshInboxRef.current({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isLiveMailroom, gmailStatus.connected, gmailSearchActive]);

  /** Poll Gmail while Mailroom is open — Pub/Sub updates server cache only, not the browser. */
  useEffect(() => {
    if (!isLiveMailroom || !gmailStatus.connected || gmailSearchActive) return;
    const POLL_MS = 20_000;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshInboxRef.current({ silent: true });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [isLiveMailroom, gmailStatus.connected, gmailSearchActive]);

  useEffect(() => {
    if (gmailOAuthFlag === "connected") setToast("Gmail connected — loading your inbox.");
    if (gmailOAuthFlag === "denied") setToast("Gmail connection was cancelled.");
    if (gmailOAuthFlag === "not_configured") setToast("Gmail OAuth is not configured on the server.");
    if (gmailOAuthFlag === "error") setToast("Gmail connection failed — try again.");
    if (gmailOAuthFlag === "no_refresh") {
      setToast("Google did not return a new token — revoke OnPro in Google Account settings, then connect again.");
    }
    if (gmailOAuthFlag === "invalid_state") {
      setToast("Gmail session expired — try Connect Gmail again (avoid private browsing).");
    }
  }, [gmailOAuthFlag]);

  const inboxThreadsForList = useMemo(() => {
    if (isMock) return MOCK_EMAIL_THREADS;
    if (gmailSearchActive) return gmailSearchResults;
    return filterImportedGmailThreads(gmailThreads, threadSearch);
  }, [isMock, gmailSearchActive, gmailSearchResults, gmailThreads, threadSearch]);

  const threads = useMemo(() => {
    const inbox = inboxThreadsForList;
    const promoted = gmailSearchActive || !state ? [] : state.promoted_threads;
    const merged = [...promoted, ...inbox];
    if (!state) return merged;
    return merged.map((t) => ({
      ...t,
      status: state.thread_status[t.id] ?? t.status,
    }));
  }, [state, inboxThreadsForList, gmailSearchActive]);

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? threads[0] ?? null,
    [threads, selectedThreadId],
  );

  useEffect(() => {
    if (!isLiveMailroom || isMock || !selectedThreadId) return;
    if (!selectedThreadId.startsWith("gmail-")) return;
    if (gmailFullThreadIdsRef.current.has(selectedThreadId)) return;

    let cancelled = false;
    void (async () => {
      setGmailThreadDetailLoading(true);
      try {
        const { thread } = await fetchMailroomThreadDetailViaApi(selectedThreadId);
        if (cancelled) return;
        gmailFullThreadIdsRef.current.add(selectedThreadId);
        setGmailThreads((prev) => mergeGmailThreadLists(prev, [thread]));
        setGmailSearchResults((prev) =>
          prev.some((t) => t.id === thread.id)
            ? prev.map((t) => (t.id === thread.id ? thread : t))
            : prev,
        );
      } catch (e) {
        console.warn("[mailroom] Gmail thread detail load failed", e);
      } finally {
        if (!cancelled) setGmailThreadDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedThreadId, isLiveMailroom, isMock]);

  const allSuggestionsForThread = useMemo<AgentSuggestion[]>(() => {
    if (!selectedThread) return [];
    const seeded = isMock ? suggestionsForThread(selectedThread) : [];
    const custom = state?.custom_suggestions?.filter((s) => s.thread_id === selectedThread.id) ?? [];
    const merged = [...seeded, ...custom].filter(
      (s) => !state || !isSuggestionRemoved(state, s.id),
    );
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
        ...(isMock ? suggestionsForThread(t) : []),
        ...(state.custom_suggestions?.filter((s) => s.thread_id === t.id) ?? []),
      ];
      for (const s of all) {
        if (isSuggestionRemoved(state, s.id)) continue;
        if (
          resolveSuggestionStatus(s, state.suggestion_status, state.generated_items) === "pending"
        ) {
          n += 1;
        }
      }
    }
    return n;
  }, [threads, state]);

  const workflowProjects = useMemo(
    () =>
      resolveClientProjectList(getLiveCachedProjects()).map((p) => ({
        id: p.id,
        name: p.name,
        client: p.client.name,
      })),
    [state, selectedThread?.id],
  );
  const existingProjectIds = useMemo(
    () => new Set(workflowProjects.map((p) => p.id)),
    [workflowProjects],
  );

  const mailroomImportToastRef = useRef(false);
  useEffect(() => {
    if (!state || workflowProjects.length === 0) return;
    let cancelled = false;
    void importMailroomImagesToDocuments({
      threads,
      workflows: state.workflows ?? {},
      generatedItems: state.generated_items,
      projectNames: workflowProjects.map((p) => ({ id: p.id, name: p.name })),
      seedDocuments: isClientLiveBackend() ? [] : getDocuments(),
    }).then((result) => {
      if (cancelled || !result.quotaExceeded) return;
      if (mailroomImportToastRef.current) return;
      mailroomImportToastRef.current = true;
      setToast(
        "Document storage is full — mailroom images were not saved. Open Documents, remove old files, or clear site data, then reload Mailroom.",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [threads, state, workflowProjects]);

  const selectedWorkflow = useMemo(
    () => (selectedThread && state ? state.workflows[selectedThread.id] : undefined),
    [selectedThread, state],
  );

  const summarized = selectedThread
    ? Boolean(state?.summarized_threads?.[selectedThread.id])
    : false;

  const [summarizing, setSummarizing] = useState(false);

  function persistWorkflowFromSummarize(workflow: MailroomWorkflow): MailroomWorkflow {
    if (!selectedThread) return workflow;
    const normalized = normalizeWorkflowForWorkspace(workflow, existingProjectIds, {
      threadSubject: selectedThread.subject,
      summary: state?.thread_summaries?.[selectedThread.id],
    });
    setState(saveMailroomWorkflow(normalized));
    return normalized;
  }

  async function handleSummarize() {
    if (!selectedThread || summarizing) return;
    setSummarizing(true);

    const needsFresh = Boolean(state?.mailroom_fresh_summarize?.[selectedThread.id]);
    const isRegenerate =
      Boolean(state?.summarized_threads?.[selectedThread.id]) || needsFresh;
    if (isRegenerate) {
      setState(resetThreadSummarizeArtifacts(selectedThread.id));
    }

    let intro: string;
    let summaryText = "";
    let suggestionIds: string[] = [];
    let workflow: MailroomWorkflow | null = null;
    const seeded = isMock ? suggestionsForThread(selectedThread) : [];
    const seededWorkflow = isMock ? workflowForThread(selectedThread) : null;

    try {
      const data = await summarizeThreadViaApi(selectedThread, { forceRegenerate: isRegenerate });
      workflow = data.workflow ?? seededWorkflow;
      summaryText = normalizeEmailBody(data.summary);
      const list =
        data.suggestions.length > 0
          ? data.suggestions
          : workflow
            ? workflowToSuggestions(workflow)
            : seeded;
      suggestionIds = workflow ? [] : list.map((s) => s.id);

      if (data.source === "openai" || data.source === "live") {
        intro = summaryText;
        if (workflow) {
          intro += ` I built a ${workflow.steps.length}-step workflow — review the plan above and approve each step.`;
        } else if (list.length > 0) {
          intro += ` I have ${list.length} suggested action${list.length === 1 ? "" : "s"} ready — review them in chat, or tell me what to do.`;
        } else {
          intro += " Tell me what you'd like to do.";
        }
        markThreadSummarized(selectedThread.id);
        saveThreadSummary(selectedThread.id, summaryText);
        if (workflow) {
          workflow = persistWorkflowFromSummarize(workflow);
        }
        for (const s of data.suggestions.length > 0 ? data.suggestions : list) {
          addCustomSuggestion(s);
        }
      } else {
        intro = `Here's what I'm seeing in this thread: ${summaryText}${
          workflow
            ? ` I built a ${workflow.steps.length}-step workflow — review the plan above and approve each step.`
            : list.length > 0
              ? ` I have ${list.length} suggested action${list.length === 1 ? "" : "s"} ready — review them in chat, or tell me what to do.`
              : " Tell me what you'd like to do."
        }`;
        markThreadSummarized(selectedThread.id);
        saveThreadSummary(selectedThread.id, summaryText);
        if (workflow) {
          workflow = persistWorkflowFromSummarize(workflow);
        }
        for (const s of list) {
          addCustomSuggestion(s);
        }
      }
      setState(clearMailroomFreshSummarizeFlag(selectedThread.id));
    } catch (e) {
      console.warn("[mailroom] summarize API failed", e);
      if (isLiveMailroom) {
        intro =
          "I couldn't summarize this thread right now. Check OpenAI billing or try again in a moment.";
        suggestionIds = [];
      } else {
        workflow = seededWorkflow;
        const list = workflow ? workflowToSuggestions(workflow) : seeded;
        suggestionIds = workflow ? [] : list.map((s) => s.id);
        summaryText = summarize(selectedThread);
        intro = `Here's what I'm seeing in this thread: ${summaryText}${
          workflow
            ? ` I built a ${workflow.steps.length}-step workflow — review the plan above and approve each step.`
            : list.length > 0
              ? ` I have ${list.length} suggested action${list.length === 1 ? "" : "s"} ready — review them in chat, or tell me what to do.`
              : " Tell me what you'd like to do."
        }`;
        markThreadSummarized(selectedThread.id);
        saveThreadSummary(selectedThread.id, summaryText);
        if (workflow) {
          workflow = persistWorkflowFromSummarize(workflow);
          for (const s of list) addCustomSuggestion(s);
        }
        setState(clearMailroomFreshSummarizeFlag(selectedThread.id));
      }
    }

    const msg = makeAgentChat(
      selectedThread.id,
      isRegenerate ? `**Regenerated summary.** ${intro}` : intro,
      suggestionIds,
    );
    setState(appendChat(msg));
    setSummarizing(false);
  }

  useEffect(() => {
    if (!state || !selectedThread || !selectedWorkflow || workflowApplying) return;
    const threadId = selectedThread.id;
    const pending = countPendingWorkflowSteps(selectedWorkflow);
    const prev = prevWorkflowPendingRef.current[threadId];
    prevWorkflowPendingRef.current[threadId] = pending;
    if (prev !== undefined && prev > 0 && pending === 0) {
      const summary = buildWorkflowSuccessSummary(selectedWorkflow, workflowProjects);
      if (summary) {
        setWorkflowSuccess(summary);
        setState(setWorkflowPlanPanelOpen(selectedThread.id, false));
      }
    }
  }, [state, selectedThread, selectedWorkflow, workflowApplying, workflowProjects]);

  useEffect(() => {
    setWorkflowSuccess(null);
  }, [selectedThread?.id]);

  const inboxConnectedForCover = state
    ? isMock
      ? state.oauth_connected
      : gmailStatus.connected
    : false;
  const mailroomContentCount = inboxConnectedForCover ? Math.max(threads.length, 1) : 0;
  useStripSectionCoverWhenPopulated("/mailroom", searchParams, mailroomContentCount);

  const showStatusLoading =
    isLiveMailroom && gmailStatus.loading && !gmailStatus.connected;

  if (!state || showStatusLoading) {
    return (
      <MailroomShell>
        <div className="flex flex-1 items-center justify-center text-text-secondary">
          Loading mailroom…
        </div>
      </MailroomShell>
    );
  }

  const inboxConnected = isMock ? state.oauth_connected : gmailStatus.connected;
  const connectedEmail = isMock ? state.connected_email : gmailStatus.email;
  function mailroomHref(opts: { cover?: boolean }) {
    const params = new URLSearchParams(searchParams.toString());
    if (opts.cover) params.set("cover", "1");
    else params.delete("cover");
    const q = params.toString();
    return q ? `/mailroom?${q}` : "/mailroom";
  }
  const openCoverPage = () => router.push(mailroomHref({ cover: true }));
  const openInbox = () => router.push(mailroomHref({ cover: false }));
  const showHero = inboxConnected
    ? false
    : shouldShowSectionCover(showCoverPage, threads.length);

  async function handleDisconnectInbox() {
    if (isMock) {
      setState(disconnectMockGmail());
      setGmailThreads([]);
      return;
    }
    try {
      await disconnectGmailViaApi();
      clearMailroomGmailThreadCache();
      setGmailThreads([]);
      setGmailNextPageToken(null);
      setGmailLoadingMore(false);
      setGmailInboxEstimate(null);
      setGmailSyncComplete(false);
      setThreadSearch("");
      setGmailSearchActive(false);
      setGmailSearchResults([]);
      gmailBackgroundLoadRef.current = false;
      gmailFullThreadIdsRef.current.clear();
      setGmailStatus({
        loading: false,
        connected: false,
        email: null,
        oauthConfigured: gmailStatus.oauthConfigured,
        message: undefined,
      });
      setSelectedThreadId(state?.promoted_threads[0]?.id ?? null);
      setToast("Gmail disconnected.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Disconnect failed");
    }
  }

  if (showHero) {
    return (
      <MailroomShell onInfoClick={openCoverPage} infoLabel="About Mailroom">
        <MailroomConnectHero
          mode={isMock ? "mock" : "live"}
          oauthConfigured={gmailStatus.oauthConfigured}
          statusMessage={
            isMock
              ? "Demo threads are stored locally. Switch to Live for real Gmail."
              : gmailStatus.message
          }
          onConnectMock={() => setState(connectMockGmail("ric@connectdots.la"))}
          connected={inboxConnected}
          connectedEmail={connectedEmail}
          onOpenInbox={inboxConnected ? openInbox : undefined}
          signedInEmail={currentUser?.email}
        />
      </MailroomShell>
    );
  }

  function handleSelectThread(t: EmailThread) {
    setSelectedThreadId(t.id);
    if (t.status === "unread") {
      setState(setThreadStatus(t.id, "read"));
    }
  }

  function handleRemovePromotedThread(t: EmailThread) {
    if (!state || !canRemoveThreadFromMailroom(t, state)) return;
    const label = t.subject.trim() || "this conversation";
    if (
      !window.confirm(
        `Remove "${label}" from Mailroom? Gmail threads stay in your inbox; you can promote this chat again from Messages.`,
      )
    ) {
      return;
    }
    const next = removePromotedThreadFromMailroom(t.id);
    setState(next);
    const remaining = [
      ...next.promoted_threads,
      ...(isMock ? MOCK_EMAIL_THREADS : gmailThreads),
    ];
    setSelectedThreadId((cur) => {
      if (cur !== t.id) return cur;
      return remaining[0]?.id ?? null;
    });
    setPreviewSuggestion(null);
    setViewItem(null);
    setPendingAttachments([]);
    setToast("Removed from Mailroom.");
  }

  async function applyOneWith(
    s: AgentSuggestion,
    override?: { title?: string; payload?: Record<string, unknown> },
    workflowStep?: MailroomWorkflowStep,
  ): Promise<GeneratedItem | null> {
    const workflow = selectedThread ? state?.workflows[selectedThread.id] : undefined;
    const linkedProjectIdEarly =
      workflow?.link_existing_project_id ??
      (workflow ? resolveWorkflowProjectId(workflow) : undefined);
    const mergedPayload = enrichSuggestionPayloadForThread(
      s.kind,
      stripPayloadFieldOrder(override?.payload ?? s.payload),
      {
        workflow,
        threadSubject: selectedThread?.subject,
        fallbackProjectId: linkedProjectIdEarly,
        fallbackJobId: workflow ? lastAppliedJobId(workflow) : undefined,
      },
    );
    const effective: AgentSuggestion = {
      ...s,
      title: override?.title ?? s.title,
      payload: mergedPayload,
    };

    let stepContext = workflow && workflowStep
      ? buildStepExecContext(workflow, workflowStep.step_id)
      : undefined;
    const linkedProjectId = linkedProjectIdEarly;
    if (linkedProjectId != null) {
      stepContext = {
        ...stepContext,
        project_id: linkedProjectId,
        job_id: stepContext?.job_id,
      };
    }

    const execContext = {
      threadRelated: {
        ...selectedThread?.related,
        project_id: linkedProjectId ?? selectedThread?.related?.project_id,
        job_id: stepContext?.job_id ?? selectedThread?.related?.job_id,
      },
      threadSubject: selectedThread?.subject,
      projects: resolveClientProjectList(getLiveCachedProjects()),
      workflowStepContext: stepContext,
    };

    const result = await executeAgentSuggestionClient(effective, execContext);
    if (!result.ok) {
      setToast(result.message);
      return null;
    }

    if (mailroomApiEnabled()) {
      try {
        await applySuggestionViaApi(effective, {
          context: {
            project_id: stepContext?.project_id ?? selectedThread?.related?.project_id,
            job_id: stepContext?.job_id ?? selectedThread?.related?.job_id,
          },
          title: effective.title,
          payload: effective.payload,
        });
      } catch (e) {
        console.warn("[mailroom] API apply log failed (workspace updated locally)", e);
      }
    }

    let next = setSuggestionStatus(s.id, "applied");
    const item = generatedItemFromSuggestion(effective, result);
    next = addGeneratedItem(item);
    const appliedVerb =
      s.kind.startsWith("update_") || s.kind === "log_packing_list" ? "Updated" : "Created";
    next = appendChat(
      makeAgentChat(
        s.thread_id,
        `${appliedVerb} **${labelForKind(item.kind)}** — “${item.title}”. ${result.message}`,
      ),
    );

    if (workflow && workflowStep) {
      next = updateMailroomWorkflow(selectedThread!.id, (wf) =>
        patchWorkflowStep(wf, workflowStep.step_id, {
          status: "applied",
          applied_project_id: result.projectId ?? stepContext?.project_id,
          applied_job_id: result.jobId ?? stepContext?.job_id,
        }),
      );
    }

    setState(next);
    dispatchWorkspaceDataChanged();
    if (isClientLiveBackend()) router.refresh();
    setToast(result.message);
    return item;
  }

  function suggestionFromWorkflowStep(step: MailroomWorkflowStep): AgentSuggestion {
    return {
      id: step.suggestion_id,
      thread_id: selectedThread!.id,
      kind: step.kind,
      title: step.title,
      payload: {
        ...step.payload,
        ...(step.auto_contact ? { auto_contact: step.auto_contact } : {}),
      },
      status: "pending",
      created_at: state?.workflows[selectedThread!.id]?.created_at ?? nowIso(),
    };
  }

  async function executeWorkflowStep(
    step: MailroomWorkflowStep,
    override?: { title?: string; payload?: Record<string, unknown> },
  ) {
    if (!selectedThread) return;
    const workflow =
      loadMailroomState().workflows[selectedThread.id] ??
      state?.workflows[selectedThread.id];
    if (!workflow) return;
    const liveStep = workflow.steps.find((s) => s.step_id === step.step_id) ?? step;
    if (liveStep.status !== "pending") return;

    const intake = state?.rfq_intake?.[selectedThread.id];
    if (mailroomNeedsRfqConfirm(summarized, workflow, intake)) {
      setState(setRfqPlanPanelOpen(selectedThread.id, true));
      setToast("Open Review and Run Plan to confirm RFQ details.");
      return;
    }

    if (
      liveStep.kind === "create_project" &&
      workflowProjectAlreadyCreated(workflow, existingProjectIds)
    ) {
      setToast("A project was already created for this workflow.");
      return;
    }

    const missingProject = workflowMissingProjectMessage(workflow, existingProjectIds);
    if (workflowStepNeedsProject(liveStep.kind) && missingProject) {
      setToast(missingProject);
      return;
    }

    if (
      liveStep.kind === "create_project" &&
      workflow.link_existing_project_id != null
    ) {
      let next = updateMailroomWorkflow(selectedThread.id, (wf) =>
        patchWorkflowStep(wf, liveStep.step_id, {
          status: "applied",
          applied_project_id: workflow.link_existing_project_id ?? undefined,
        }),
      );
      next = setSuggestionStatus(liveStep.suggestion_id, "applied");
      next = appendChat(
        makeAgentChat(
          selectedThread.id,
          `Linked existing project (step skipped). Continue with the next step.`,
        ),
      );
      setState(next);
      setToast("Using existing project for this workflow.");
      return;
    }

    await applyOneWith(suggestionFromWorkflowStep(liveStep), override, liveStep);
  }

  async function applyWorkflowStep(
    step: MailroomWorkflowStep,
    override?: { title?: string; payload?: Record<string, unknown> },
  ) {
    if (workflowApplying) {
      setToast("Still working on the previous step — please wait.");
      return;
    }
    setWorkflowApplying(step.step_id);
    try {
      await executeWorkflowStep(step, override);
    } finally {
      setWorkflowApplying(null);
    }
  }

  async function skipWorkflowStep(step: MailroomWorkflowStep) {
    if (!selectedThread) return;
    let next = updateMailroomWorkflow(selectedThread.id, (wf) =>
      patchWorkflowStep(wf, step.step_id, { status: "skipped" }),
    );
    next = appendChat(
      makeAgentChat(selectedThread.id, `Skipped step: “${step.title}”.`),
    );
    setState(next);
  }

  function handleSaveRfqIntakeDraft(draft: MailroomRfqIntake) {
    if (!selectedThread) return;
    setState(saveRfqIntakeDraft(selectedThread.id, draft));
  }

  function handleConfirmRfqIntake(draft: MailroomRfqIntake) {
    if (!selectedThread) return;
    const wasConfirmed = isRfqIntakeConfirmed(state?.rfq_intake?.[selectedThread.id]);
    let next = confirmRfqIntake(selectedThread.id, draft, nowIso());
    if (!draft.create_order) {
      next = updateMailroomWorkflow(selectedThread.id, (wf) => ({
        ...wf,
        steps: wf.steps.map((s) =>
          s.kind === "create_order" && s.status === "pending"
            ? { ...s, status: "skipped" as const }
            : s,
        ),
      }));
    }
    setState(next);
    setState(
      appendChat(
        makeAgentChat(
          selectedThread.id,
          `Confirmed RFQ for **${draft.client_name.trim()}**${draft.client_po_tbd ? "" : ` (PO ${draft.client_po.trim()})`}. Workflow steps are ready to run.`,
        ),
      ),
    );
    setState(setRfqPlanPanelOpen(selectedThread.id, false));
    setState(setWorkflowPlanPanelOpen(selectedThread.id, true));
    setToast(
      wasConfirmed
        ? "RFQ details updated."
        : "RFQ details confirmed — workflow plan is ready.",
    );
  }

  /** Open RFQ fields on top of the workflow plan (keeps confirmation + plan visible underneath). */
  function handleEditRfqIntake() {
    if (!selectedThread) return;
    setState(setRfqPlanPanelOpen(selectedThread.id, true));
  }

  function handleOpenRfqPlanPanel() {
    if (!selectedThread) return;
    setState(setRfqPlanPanelOpen(selectedThread.id, true));
  }

  function handleDismissRfqPlanPanel() {
    if (!selectedThread) return;
    setState(setRfqPlanPanelOpen(selectedThread.id, false));
  }

  function handleOpenWorkflowPlanPanel() {
    if (!selectedThread) return;
    setState(setWorkflowPlanPanelOpen(selectedThread.id, true));
  }

  function openWorkflowSuccessModal(summary: WorkflowSuccessSummary) {
    if (!selectedThread) return;
    setWorkflowSuccess(summary);
    setState(setWorkflowPlanPanelOpen(selectedThread.id, false));
  }

  function handleDismissWorkflowPlanPanel() {
    if (!selectedThread) return;
    setState(setWorkflowPlanPanelOpen(selectedThread.id, false));
  }

  function handleFinishWorkflow() {
    if (!selectedThread || workflowApplying) return;
    const wf = state?.workflows[selectedThread.id];
    if (!wf) {
      handleDismissWorkflowPlanPanel();
      return;
    }
    const summary = buildWorkflowSuccessSummary(wf, workflowProjects);
    if (summary) openWorkflowSuccessModal(summary);
    else handleDismissWorkflowPlanPanel();
  }

  function handleViewWorkflowProject(projectId: number) {
    setWorkflowSuccess(null);
    handleDismissWorkflowPlanPanel();
    router.push(`/projects/${projectId}`);
  }

  function handleStayInMailroomAfterSuccess() {
    setWorkflowSuccess(null);
  }

  function handleClearThreadAiResults() {
    if (!selectedThread || workflowApplying) return;
    const ok = window.confirm(
      "Clear all AI results for this thread? This removes the workflow plan, right-column drafts, summary, and agent chat. Then use Summarize with AI to rebuild — the new plan will include a Create project step.",
    );
    if (!ok) return;
    void invalidateMailroomSummarizeCache(selectedThread);
    setState(clearThreadMailroomAiResults(selectedThread.id));
    setState(setWorkflowPlanPanelOpen(selectedThread.id, false));
    setState(setRfqPlanPanelOpen(selectedThread.id, false));
    setPreviewSuggestion(null);
    setPreviewWorkflowStep(null);
    setSummarizing(false);
    setWorkflowSuccess(null);
    setToast("Cleared. Click Summarize with AI to rebuild the workflow plan.");
  }

  async function runAllRemainingWorkflowSteps() {
    if (!selectedThread) return;
    if (workflowApplying) {
      setToast("Still working — please wait.");
      return;
    }
    const workflow = state?.workflows[selectedThread.id];
    if (!workflow) return;
    const intake = state?.rfq_intake?.[selectedThread.id];
    if (mailroomNeedsRfqConfirm(summarized, workflow, intake)) {
      setState(setRfqPlanPanelOpen(selectedThread.id, true));
      setToast("Open Review and Run Plan to confirm RFQ details.");
      return;
    }
    setWorkflowApplying("all");
    try {
      for (const step of workflow.steps) {
        if (step.status !== "pending") continue;
        await executeWorkflowStep(step);
        const updated = loadMailroomState().workflows[selectedThread.id];
        const last = updated?.steps.find((s) => s.step_id === step.step_id);
        if (last?.status !== "applied") break;
      }
      const finalWorkflow = loadMailroomState().workflows[selectedThread.id];
      if (finalWorkflow) {
        const summary = buildWorkflowSuccessSummary(finalWorkflow, workflowProjects);
        if (summary) openWorkflowSuccessModal(summary);
      }
    } finally {
      setWorkflowApplying(null);
    }
  }

  function applyOne(s: AgentSuggestion) {
    applyOneWith(s);
  }

  function dismissOne(s: AgentSuggestion) {
    setState(removeSuggestion(s.id));
    setPreviewSuggestion((cur) => (cur?.id === s.id ? null : cur));
  }

  async function applyAllPendingSuggestions(threadId: string) {
    const toApply = pendingSuggestions;
    if (toApply.length === 0) {
      setState(appendChat(makeAgentChat(threadId, "Nothing pending right now.")));
      return;
    }
    let applied = 0;
    for (const s of toApply) {
      const item = await applyOneWith(s);
      if (item) applied++;
    }
    setState(
      appendChat(
        makeAgentChat(
          threadId,
          applied > 0
            ? `Applied ${applied} suggestion${applied === 1 ? "" : "s"}. They're on the right.`
            : "Nothing could be applied — check that a project and jobs exist where needed.",
        ),
      ),
    );
  }

  function postAgentChatTurn(
    thread: EmailThread,
    reply: string,
    proposal: MailroomChatResponse["propose_suggestion"],
  ) {
    if (proposal) {
      const wf = state?.workflows[thread.id];
      const newSug = suggestionFromChatProposal(thread, proposal, wf);
      addCustomSuggestion(newSug);
      const confirmHint =
        " Review the **suggestion card** on the right and tap **Generate**, or say **go ahead** to apply.";
      setState(appendChat(makeAgentChat(thread.id, `${reply}${confirmHint}`, [newSug.id])));
      return;
    }
    setState(appendChat(makeAgentChat(thread.id, reply)));
  }

  async function handleSendMessage(text: string) {
    if (!selectedThread || chatReplying) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const threadId = selectedThread.id;
    setState(appendChat(makeUserChat(threadId, trimmed)));

    const quick = detectMailroomChatIntent(trimmed);
    if (quick.applyAll) {
      void applyAllPendingSuggestions(threadId);
      return;
    }

    const priorChat = state?.chat[threadId] ?? [];
    const history = priorChat.map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      text: m.text,
    }));

    setChatReplying(true);
    try {
      const wsCtx = buildMailroomThreadWorkspaceContext({
        workflow: state?.workflows[selectedThread.id],
        projects: resolveClientProjectList(getLiveCachedProjects()),
        generatedItems:
          state?.generated_items.filter((i) => i.thread_id === selectedThread.id) ?? [],
        pendingSuggestions,
      });
      const data = await sendMailroomChatViaApi({
        thread: selectedThread,
        message: trimmed,
        history,
        pendingSuggestionTitles: pendingSuggestions.map((s) => s.title),
        scanSummary: state?.thread_summaries?.[selectedThread.id],
        workspaceContext: mailroomWorkspaceContextForPrompt(wsCtx),
      });

      if (data.apply_all) {
        void applyAllPendingSuggestions(threadId);
        return;
      }

      postAgentChatTurn(selectedThread, data.reply, data.propose_suggestion);
    } catch (e) {
      console.warn("[mailroom] chat API failed, using local intent", e);
      const intent = detectMailroomChatIntent(trimmed);
      if (intent.applyAll) {
        void applyAllPendingSuggestions(threadId);
        return;
      }
      if (intent.kind) {
        postAgentChatTurn(selectedThread, intent.reply, {
          kind: intent.kind,
          title: suggestionForKind(selectedThread, intent.kind).title,
          payload: enrichSuggestionPayloadForThread(
            intent.kind,
            selectedThread.related ?? {},
            {
              workflow: state?.workflows[selectedThread.id],
              threadSubject: selectedThread.subject,
            },
          ),
        });
        return;
      }
      setState(appendChat(makeAgentChat(threadId, intent.reply)));
    } finally {
      setChatReplying(false);
    }
  }

  const chatMessages = state.chat[selectedThread?.id ?? ""] ?? [];
  const generatedForThread = selectedThread
    ? state.generated_items.filter((i) => i.thread_id === selectedThread.id)
    : [];
  const generatedToShow = showAllThreads ? state.generated_items : generatedForThread;
  const suggestionById = new Map(allSuggestionsForThread.map((s) => [s.id, s]));
  const rfqIntakeForThread = selectedThread ? state.rfq_intake?.[selectedThread.id] : undefined;
  const needsRfqConfirm = mailroomNeedsRfqConfirm(
    summarized,
    selectedWorkflow,
    rfqIntakeForThread,
  );
  const rfqPlanPanelOpen = selectedThread
    ? Boolean(state?.rfq_plan_panel_open?.[selectedThread.id])
    : false;
  const workflowPlanPanelOpen = selectedThread
    ? Boolean(state?.workflow_plan_panel_open?.[selectedThread.id])
    : false;

  return (
    <MailroomShell onInfoClick={openCoverPage} infoLabel="About Mailroom">
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-light bg-surface-body/40 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            {gmailThreadsLoading && !isMock
              ? `Connected — loading emails${connectedEmail ? ` (${connectedEmail})` : "…"}`
              : `Mailroom is listening — ${connectedEmail}`}
          </span>
          {pendingTotal > 0 ? (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
              {pendingTotal} pending suggestion{pendingTotal === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {!isMock && inboxConnected ? (
            <button
              type="button"
              onClick={() => void refreshInbox()}
              disabled={gmailThreadsLoading}
              className="text-[11px] font-semibold text-text-secondary hover:text-accent hover:underline disabled:cursor-wait disabled:opacity-60"
            >
              {gmailThreadsLoading ? "Fetching…" : "Refresh inbox"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleDisconnectInbox()}
            className="text-[11px] font-semibold text-text-secondary hover:text-accent hover:underline"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px] grid-rows-[minmax(0,1fr)] divide-x divide-border-light">
        <div className="flex min-h-0 flex-col overflow-hidden">
          {!isMock && inboxConnected ? (
            <MailroomInboxSyncBar
              loadedCount={gmailThreads.length}
              estimatedTotal={gmailInboxEstimate}
              syncComplete={gmailSyncComplete}
              loadingMore={gmailLoadingMore}
              initialLoading={gmailThreadsLoading}
              search={threadSearch}
              onSearchChange={(value) => {
                setThreadSearch(value);
                if (!value.trim()) {
                  setGmailSearchActive(false);
                  setGmailSearchResults([]);
                } else if (gmailSearchActive) {
                  setGmailSearchActive(false);
                  setGmailSearchResults([]);
                }
              }}
              onSearchSubmit={() => void runGmailInboxSearch()}
              searching={gmailSearching}
              gmailSearchActive={gmailSearchActive}
            />
          ) : null}
          <ThreadList
            threads={threads}
            selectedId={selectedThread?.id ?? null}
            onSelect={handleSelectThread}
            suggestionCounts={suggestionCountsByThread(threads, state)}
            canRemove={(t) => canRemoveThreadFromMailroom(t, state)}
            onRemove={handleRemovePromotedThread}
            loadingMore={!isMock && gmailLoadingMore}
            hasMore={!isMock && !gmailSearchActive && !gmailSyncComplete && Boolean(gmailNextPageToken)}
            initialLoading={
              !isMock &&
              ((gmailThreadsLoading && inboxThreadsForList.length === 0 && !gmailSearchActive) ||
                (gmailSearching && threads.length === 0))
            }
            fetchingInbox={!isMock && gmailThreadsLoading && inboxThreadsForList.length > 0 && !gmailSearchActive}
            emptyMessage={
              gmailSearchActive && !gmailSearching
                ? "No Gmail threads matched. Try different keywords or from:address."
                : undefined
            }
            onLoadMore={
              !isMock && !gmailSearchActive && gmailNextPageToken && !gmailLoadingMore
                ? () => void loadNextGmailPage(gmailNextPageToken, gmailInboxEstimate)
                : undefined
            }
          />
        </div>
        <ConversationPane
          className="min-h-0"
          thread={selectedThread}
          inboxLoading={!isMock && gmailThreadsLoading && inboxThreadsForList.length === 0}
          threadDetailLoading={gmailThreadDetailLoading}
          canRemoveFromMailroom={
            selectedThread ? canRemoveThreadFromMailroom(selectedThread, state) : false
          }
          onRemoveFromMailroom={() => {
            if (selectedThread) handleRemovePromotedThread(selectedThread);
          }}
          chat={chatMessages}
          outbox={selectedThread ? state.outbox[selectedThread.id] ?? [] : []}
          suggestionById={suggestionById}
          workflow={selectedWorkflow}
          workflowProjects={workflowProjects}
          onWorkflowPreview={(step, suggestion, attachMode) => {
            setPreviewWorkflowStep(step);
            setPreviewAttachMode(attachMode ?? false);
            setPreviewSuggestion(suggestion);
          }}
          onWorkflowApprove={(step) => void applyWorkflowStep(step)}
          onWorkflowSkip={(step) => void skipWorkflowStep(step)}
          onWorkflowRunAll={() => void runAllRemainingWorkflowSteps()}
          onWorkflowLinkProject={(projectId) => {
            if (!selectedThread) return;
            setState((prev) => {
              if (!prev) return prev;
              return linkWorkflowToExistingProject(prev, selectedThread.id, projectId);
            });
            const name = workflowProjects.find((p) => p.id === projectId)?.name;
            setToast(
              name
                ? `Using existing project “${name}” — create-project step skipped. Run the next steps when ready.`
                : "Linked to existing project.",
            );
          }}
          onWorkflowCreateNew={() => {
            if (!selectedThread) return;
            setState((prev) => {
              if (!prev) return prev;
              return unlinkWorkflowFromExistingProject(prev, selectedThread.id);
            });
            setToast("Creating a new project from this thread — run the create-project step when ready.");
          }}
          rfqIntake={selectedThread ? state.rfq_intake?.[selectedThread.id] : undefined}
          onSaveRfqIntakeDraft={handleSaveRfqIntakeDraft}
          onConfirmRfqIntake={handleConfirmRfqIntake}
          onEditRfqIntake={handleEditRfqIntake}
          needsRfqConfirm={needsRfqConfirm}
          rfqPlanPanelOpen={rfqPlanPanelOpen}
          onOpenRfqPlanPanel={handleOpenRfqPlanPanel}
          onDismissRfqPlanPanel={handleDismissRfqPlanPanel}
          workflowPlanPanelOpen={workflowPlanPanelOpen}
          onOpenWorkflowPlanPanel={handleOpenWorkflowPlanPanel}
          onDismissWorkflowPlanPanel={handleDismissWorkflowPlanPanel}
          onFinishWorkflow={handleFinishWorkflow}
          onClearThreadAiResults={handleClearThreadAiResults}
          workflowApplying={workflowApplying}
          childOverlayOpen={Boolean(previewSuggestion)}
          connectedEmail={state.connected_email ?? "you@onpro.app"}
          pendingAttachments={pendingAttachments}
          onRemoveAttachment={removeAttachment}
          onOpenAttachmentPicker={() => setAttachPickerOpen(true)}
          summarized={summarized}
          summaryText={
            selectedThread ? state.thread_summaries?.[selectedThread.id] : undefined
          }
          summarizing={summarizing}
          onSummarize={() => void handleSummarize()}
          pane={pane}
          onPaneChange={setPane}
          onPreview={(s) => {
            setPreviewWorkflowStep(null);
            setPreviewAttachMode(false);
            setPreviewSuggestion(s);
          }}
          onQuickGenerate={(s) => {
            setPreviewWorkflowStep(null);
            setPreviewAttachMode(true);
            setPreviewSuggestion(s);
          }}
          onApply={applyOne}
          onDismiss={dismissOne}
          onSend={handleSendMessage}
          chatReplying={chatReplying}
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
          generatedItems={state.generated_items}
          onOpenGeneratedItem={(i) => setViewItem(i)}
        />
        <GeneratedItemsPanel
            items={generatedToShow}
            showAllThreads={showAllThreads}
            onToggleScope={() => setShowAllThreads((v) => !v)}
            onOpenItem={(i) => setViewItem(i)}
            onRemove={handleRemoveGeneratedItem}
            onAttach={selectedThread ? (i) => attachToReply(i, { switchToEmails: true }) : undefined}
            attachedSourceIds={new Set(pendingAttachments.map((a) => a.source_id))}
          />
      </div>

      {toast ? (
        <ToastViewport>
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
        </ToastViewport>
      ) : null}

      {viewItem ? (
        <GeneratedItemDetailModal item={viewItem} onClose={() => setViewItem(null)} />
      ) : null}

      {workflowSuccess ? (
        <MailroomWorkflowSuccessModal
          open
          summary={workflowSuccess}
          onStayInMailroom={handleStayInMailroomAfterSuccess}
          onViewProject={() => handleViewWorkflowProject(workflowSuccess.projectId)}
        />
      ) : null}

      {previewSuggestion ? (
        <DocPreviewModal
          suggestion={previewSuggestion}
          primaryMode={previewAttachMode ? "attach" : "default"}
          working={Boolean(workflowApplying && previewWorkflowStep)}
          onClose={() => {
            setPreviewSuggestion(null);
            setPreviewWorkflowStep(null);
            setPreviewAttachMode(false);
          }}
          onSave={(title, payload) => {
            const run = previewWorkflowStep
              ? applyWorkflowStep(previewWorkflowStep, { title, payload })
              : applyOneWith(previewSuggestion, { title, payload });
            void run.then(() => {
              setPreviewSuggestion(null);
              setPreviewWorkflowStep(null);
              setPreviewAttachMode(false);
            });
          }}
          onSaveAndAttach={(title, payload) => {
            const run = previewWorkflowStep
              ? applyWorkflowStep(previewWorkflowStep, { title, payload })
              : applyOneWith(previewSuggestion, { title, payload });
            void run.then((item) => {
              if (item) attachToReply(item, { switchToEmails: true });
              setPreviewSuggestion(null);
              setPreviewWorkflowStep(null);
              setPreviewAttachMode(false);
            });
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
    </MailroomShell>
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
    const pending = all.filter((s) => {
      if (isSuggestionRemoved(state, s.id)) return false;
      return (
        resolveSuggestionStatus(s, state.suggestion_status, state.generated_items) === "pending"
      );
    }).length;
    out[t.id] = pending;
  }
  return out;
}

function MailroomInboxSyncBar({
  loadedCount,
  estimatedTotal,
  syncComplete,
  loadingMore,
  initialLoading = false,
  search,
  onSearchChange,
  onSearchSubmit,
  searching,
  gmailSearchActive,
}: {
  loadedCount: number;
  estimatedTotal: number | null;
  syncComplete: boolean;
  loadingMore: boolean;
  initialLoading?: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  searching: boolean;
  gmailSearchActive: boolean;
}) {
  const progressPct =
    estimatedTotal && estimatedTotal > 0
      ? Math.min(100, Math.round((loadedCount / estimatedTotal) * 100))
      : null;

  return (
    <div className="shrink-0 border-b border-border-light bg-slate-50/80 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[10px] text-text-secondary">
        <span className="font-medium">
          {initialLoading
            ? "Fetching your inbox from Gmail…"
            : syncComplete
              ? `Inbox ready · ${loadedCount} thread${loadedCount === 1 ? "" : "s"}`
              : loadingMore
                ? `Loading more… ${loadedCount}${estimatedTotal ? ` / ~${estimatedTotal}` : ""}`
                : `${loadedCount} thread${loadedCount === 1 ? "" : "s"} loaded${estimatedTotal ? ` · ~${estimatedTotal} in inbox` : ""} — scroll for more`}
        </span>
        {initialLoading || loadingMore ? (
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-violet-500" />
        ) : null}
      </div>
      {initialLoading ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-violet-500" />
        </div>
      ) : null}
      {!syncComplete && progressPct != null && loadingMore ? (
        <div
          className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-violet-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      ) : null}
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSearchSubmit();
        }}
        placeholder="Filter imported… Enter searches all of Gmail"
        className="mt-2 w-full rounded-lg border border-border-light bg-white px-2.5 py-1.5 text-[11px] focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {gmailSearchActive ? (
        <p className="mt-1 text-[10px] leading-snug text-text-secondary">
          Showing Gmail search results (up to 40). Clear to return to imported inbox.
        </p>
      ) : null}
      {searching ? (
        <p className="mt-0.5 text-[10px] font-medium text-accent">Searching Gmail…</p>
      ) : null}
    </div>
  );
}

function MailroomPaneLoader({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center ${className ?? ""}`}
    >
      <span className="size-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
      <p className="text-sm font-medium text-text-secondary">{message}</p>
    </div>
  );
}

function ThreadList({
  threads,
  selectedId,
  onSelect,
  suggestionCounts,
  canRemove,
  onRemove,
  loadingMore = false,
  hasMore = false,
  initialLoading = false,
  fetchingInbox = false,
  emptyMessage,
  onLoadMore,
}: {
  threads: EmailThread[];
  selectedId: string | null;
  onSelect: (t: EmailThread) => void;
  suggestionCounts: Record<string, number>;
  canRemove?: (t: EmailThread) => boolean;
  onRemove?: (t: EmailThread) => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  initialLoading?: boolean;
  fetchingInbox?: boolean;
  emptyMessage?: string;
  onLoadMore?: () => void;
}) {
  const loadMoreSentinelRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore) return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root: node.closest("ul"), rootMargin: "120px", threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore, threads.length]);

  if (initialLoading && threads.length === 0) {
    return (
      <ul className="min-h-0 overflow-y-auto" aria-busy="true" aria-label="Loading inbox">
        {Array.from({ length: 8 }, (_, i) => (
          <li
            key={i}
            className="border-b border-border-light/70 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-2.5 w-10 animate-pulse rounded bg-slate-100" />
            </div>
            <div
              className="mt-1.5 h-3.5 animate-pulse rounded bg-slate-200"
              style={{ width: `${55 + ((i * 13) % 35)}%` }}
            />
            <div className="mt-1 h-2.5 w-full max-w-[85%] animate-pulse rounded bg-slate-100" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="min-h-0 overflow-y-auto">
      {fetchingInbox ? (
        <li className="sticky top-0 z-10 border-b border-violet-200 bg-violet-50/95 px-3 py-2 text-[11px] font-medium text-violet-800">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-violet-600" />
            Fetching latest emails…
          </span>
        </li>
      ) : null}
      {threads.length === 0 && !initialLoading ? (
        <li className="px-3 py-8 text-center text-[12px] text-text-secondary">
          {emptyMessage ?? "No emails loaded yet. Try Refresh inbox above."}
        </li>
      ) : null}
      {threads.map((t) => {
        const lastMsg = t.messages[t.messages.length - 1];
        const sender = lastMsg?.from.name ?? "Unknown";
        const active = t.id === selectedId;
        const unread = t.status === "unread";
        const sugCount = suggestionCounts[t.id] ?? 0;
        const removable = canRemove?.(t) ?? false;
        return (
          <li key={t.id} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(t)}
              className={`block w-full border-b border-border-light/70 px-3 py-2.5 text-left transition ${
                removable ? "pr-9" : ""
              } ${
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
                {lastMsg ? emailBodyPreview(lastMsg.body) : ""}
              </p>
              {sugCount > 0 ? (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  {sugCount} pending
                </span>
              ) : null}
            </button>
            {removable && onRemove ? (
              <button
                type="button"
                title="Remove from Mailroom"
                aria-label={`Remove ${t.subject} from Mailroom`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(t);
                }}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-lg p-1.5 text-text-secondary opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </li>
        );
      })}
      {hasMore ? (
        <li
          ref={loadMoreSentinelRef}
          className="border-b border-border-light/70 px-3 py-3 text-center text-[11px] text-text-secondary"
        >
          {loadingMore ? "Loading more…" : "Scroll for more inbox threads"}
        </li>
      ) : null}
    </ul>
  );
}

function MailroomThreadSummaryBlock({
  summaryText,
  summarized,
  summarizing,
  onSummarize,
}: {
  summaryText?: string;
  summarized: boolean;
  summarizing?: boolean;
  onSummarize: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-violet-200 bg-violet-50 px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-accent">AI summary</p>
        <button
          type="button"
          onClick={onSummarize}
          disabled={summarizing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/30 bg-white px-3 py-1.5 text-[11px] font-semibold text-accent shadow-sm hover:bg-violet-100 disabled:opacity-50"
        >
          <span aria-hidden>{summarizing ? "…" : summarized ? "↻" : "✨"}</span>
          {summarizing
            ? "Working…"
            : summarized
              ? "Regenerate summary"
              : "Summarize with AI"}
        </button>
      </div>
      <p className="mt-1 text-sm text-text-primary">
        {summarized
          ? summaryText?.trim() || "Summary saved — regenerate if new emails arrived."
          : "Summarize with AI when you want to scan your original email. New mail is never summarized automatically."}
      </p>
    </div>
  );
}

function MailroomWorkflowReadyBar({
  border,
  onOpenRfqPlan,
  onOpenWorkflowPlan,
}: {
  border: "top" | "bottom";
  onOpenRfqPlan?: () => void;
  onOpenWorkflowPlan?: () => void;
}) {
  const borderClass = border === "top" ? "border-t" : "border-b";
  const isRfq = Boolean(onOpenRfqPlan);

  return (
    <div
      className={`shrink-0 flex flex-wrap items-center justify-between gap-2 ${borderClass} border-violet-200 bg-violet-50/90 px-5 py-2.5`}
    >
      <p className="text-[11px] font-medium text-violet-950">
        {isRfq ? "Workflow is ready when you are." : "Workflow plan is ready — review steps and run tasks."}
      </p>
      <button
        type="button"
        onClick={isRfq ? onOpenRfqPlan : onOpenWorkflowPlan}
        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-95"
      >
        {isRfq ? "Review and Run Plan" : "View workflow plan"}
      </button>
    </div>
  );
}

function ConversationPane({
  thread,
  chat,
  outbox,
  suggestionById,
  workflow,
  workflowProjects,
  onWorkflowPreview,
  onWorkflowApprove,
  onWorkflowSkip,
  onWorkflowRunAll,
  onWorkflowLinkProject,
  onWorkflowCreateNew,
  rfqIntake,
  onSaveRfqIntakeDraft,
  onConfirmRfqIntake,
  onEditRfqIntake,
  needsRfqConfirm,
  rfqPlanPanelOpen,
  onOpenRfqPlanPanel,
  onDismissRfqPlanPanel,
  workflowPlanPanelOpen,
  onOpenWorkflowPlanPanel,
  onDismissWorkflowPlanPanel,
  onFinishWorkflow,
  onClearThreadAiResults,
  workflowApplying = null,
  childOverlayOpen = false,
  connectedEmail,
  pendingAttachments,
  onRemoveAttachment,
  onOpenAttachmentPicker,
  summarized,
  summaryText,
  summarizing,
  onSummarize,
  pane,
  onPaneChange,
  onPreview,
  onQuickGenerate,
  onApply,
  onDismiss,
  onSend,
  chatReplying = false,
  onReply,
  canRemoveFromMailroom,
  onRemoveFromMailroom,
  generatedItems,
  onOpenGeneratedItem,
  className,
  inboxLoading = false,
  threadDetailLoading = false,
}: {
  thread: EmailThread | null;
  className?: string;
  chat: AgentChatMessage[];
  outbox: EmailMessage[];
  suggestionById: Map<string, AgentSuggestion>;
  workflow?: MailroomWorkflow;
  workflowProjects: Array<{ id: number; name: string; client: string }>;
  onWorkflowPreview: (
    step: MailroomWorkflowStep,
    suggestion: AgentSuggestion,
    attachMode?: boolean,
  ) => void;
  onWorkflowApprove: (step: MailroomWorkflowStep) => void;
  onWorkflowSkip: (step: MailroomWorkflowStep) => void;
  onWorkflowRunAll: () => void;
  onWorkflowLinkProject: (projectId: number) => void;
  onWorkflowCreateNew: () => void;
  rfqIntake?: MailroomRfqIntake;
  onSaveRfqIntakeDraft: (draft: MailroomRfqIntake) => void;
  onConfirmRfqIntake: (draft: MailroomRfqIntake) => void;
  onEditRfqIntake: () => void;
  needsRfqConfirm: boolean;
  rfqPlanPanelOpen: boolean;
  onOpenRfqPlanPanel: () => void;
  onDismissRfqPlanPanel: () => void;
  workflowPlanPanelOpen: boolean;
  onOpenWorkflowPlanPanel: () => void;
  onDismissWorkflowPlanPanel: () => void;
  onFinishWorkflow: () => void;
  onClearThreadAiResults: () => void;
  workflowApplying?: string | null;
  /** Doc preview / other stack above workflow plan — suppress workflow Escape & backdrop. */
  childOverlayOpen?: boolean;
  connectedEmail: string;
  pendingAttachments: EmailAttachment[];
  onRemoveAttachment: (id: string) => void;
  onOpenAttachmentPicker: () => void;
  summarized: boolean;
  summaryText?: string;
  summarizing?: boolean;
  onSummarize: () => void;
  pane: "chat" | "emails";
  onPaneChange: (p: "chat" | "emails") => void;
  onPreview: (s: AgentSuggestion) => void;
  onQuickGenerate: (s: AgentSuggestion) => void;
  onApply: (s: AgentSuggestion) => void;
  onDismiss: (s: AgentSuggestion) => void;
  onSend: (text: string) => void | Promise<void>;
  chatReplying?: boolean;
  onReply: (body: string) => void;
  canRemoveFromMailroom?: boolean;
  onRemoveFromMailroom?: () => void;
  generatedItems: GeneratedItem[];
  onOpenGeneratedItem: (item: GeneratedItem) => void;
  inboxLoading?: boolean;
  threadDetailLoading?: boolean;
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
    if (inboxLoading) {
      return <MailroomPaneLoader message="Fetching your emails from Gmail…" className={className} />;
    }
    return (
      <div className={`flex items-center justify-center text-text-secondary ${className ?? ""}`}>
        Select a thread or refresh inbox to load mail.
      </div>
    );
  }

  const fullThreadMessages: Array<EmailMessage & { __outbound?: boolean }> = [
    ...thread.messages.map((m) => ({ ...m })),
    ...outbox.map((m) => ({ ...m, __outbound: true })),
  ].sort((a, b) => new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime());
  const lastInboundReply = [...thread.messages].reverse().find((m) => m.from.email !== connectedEmail);
  const replyTo = lastInboundReply?.from.email ?? thread.participants[0]?.email ?? "";
  const showWorkflowPlan = Boolean(
    summarized && workflow && (!needsRfqConfirm || isRfqIntakeConfirmed(rfqIntake)),
  );
  const showWorkflowModal = showWorkflowPlan && workflowPlanPanelOpen && Boolean(workflow);
  const rfqEditOverWorkflow =
    rfqPlanPanelOpen && workflowPlanPanelOpen && isRfqIntakeConfirmed(rfqIntake);
  const showRfqModal =
    rfqPlanPanelOpen &&
    Boolean(workflow) &&
    (needsRfqConfirm || isRfqIntakeConfirmed(rfqIntake));
  const workflowChildOverlay =
    childOverlayOpen || rfqEditOverWorkflow || Boolean(workflowApplying);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || chatReplying) return;
    void onSend(input);
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
    <div
      className={`grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden ${className ?? ""}`}
    >
      {threadDetailLoading ? (
        <div className="shrink-0 border-b border-violet-200 bg-violet-50 px-5 py-2 text-[11px] font-medium text-violet-800">
          <span className="inline-flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-violet-600" />
            Loading full email content…
          </span>
        </div>
      ) : null}
      <div className="border-b border-border-light px-5 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex flex-wrap items-center gap-2">
            {thread.channel === "in_app" ? (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                💬 Promoted from In-app
              </span>
            ) : null}
            <h2 className="text-lg font-bold text-text-primary">{thread.subject}</h2>
          </div>
          {canRemoveFromMailroom && onRemoveFromMailroom ? (
            <button
              type="button"
              onClick={onRemoveFromMailroom}
              className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
            >
              Remove from Mailroom
            </button>
          ) : null}
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

      <div
        role="tablist"
        aria-label="Conversation view"
        className="border-b border-border-light bg-white px-5 py-2.5"
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

      <div className="min-h-0 overflow-hidden flex flex-col">
      {pane === "chat" ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollerRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4"
          >
            <MailroomThreadSummaryBlock
              summaryText={summaryText}
              summarized={summarized}
              summarizing={summarizing}
              onSummarize={onSummarize}
            />
            {chat.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                suggestionById={suggestionById}
                hideInlineSuggestions={Boolean(workflow)}
                onApply={onApply}
                onQuickGenerate={onQuickGenerate}
                onDismiss={onDismiss}
                onPreview={onPreview}
              />
            ))}
            {chatReplying ? (
              <p className="text-xs text-text-secondary">Agent is thinking…</p>
            ) : null}
          </div>

          {needsRfqConfirm && !rfqPlanPanelOpen ? (
            <MailroomWorkflowReadyBar onOpenRfqPlan={onOpenRfqPlanPanel} border="top" />
          ) : showWorkflowPlan && !workflowPlanPanelOpen ? (
            <MailroomWorkflowReadyBar onOpenWorkflowPlan={onOpenWorkflowPlanPanel} border="top" />
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-border-light bg-surface-body/40 px-5 py-3"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={chatReplying}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask about this thread or ask to draft something — e.g. “any client tasks here?” or “add a task to confirm ship date”"
                rows={2}
                className="min-h-0 flex-1 resize-none rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={chatReplying}
                className="shrink-0 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {chatReplying ? "…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {needsRfqConfirm && !rfqPlanPanelOpen ? (
            <MailroomWorkflowReadyBar onOpenRfqPlan={onOpenRfqPlanPanel} border="bottom" />
          ) : showWorkflowPlan && !workflowPlanPanelOpen ? (
            <MailroomWorkflowReadyBar onOpenWorkflowPlan={onOpenWorkflowPlanPanel} border="bottom" />
          ) : null}
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-surface-body/30 px-5 py-3">
            {fullThreadMessages.map((m) => (
              <EmailRow
                key={m.id}
                message={m}
                outbound={Boolean(m.__outbound)}
                generatedItems={generatedItems}
                onOpenGeneratedItem={onOpenGeneratedItem}
              />
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
        </div>
      )}
      </div>

      {showWorkflowModal ? (
        <MailroomWorkflowPlanModal
          open
          workflow={workflow!}
          projects={workflowProjects}
          rfqIntake={rfqIntake}
          workflowApplying={workflowApplying}
          workflowLocked={needsRfqConfirm}
          lockReason="Use Review and Run Plan to unlock workflow steps."
          childOverlayOpen={workflowChildOverlay}
          onDismiss={onDismissWorkflowPlanPanel}
          onFinishWorkflow={onFinishWorkflow}
          onEditRfqIntake={onEditRfqIntake}
          onClearAiResults={onClearThreadAiResults}
          onPreview={onWorkflowPreview}
          onApproveStep={onWorkflowApprove}
          onSkipStep={onWorkflowSkip}
          onRunAllRemaining={onWorkflowRunAll}
          onLinkExistingProject={onWorkflowLinkProject}
          onCreateNewProject={onWorkflowCreateNew}
        />
      ) : null}

      {showRfqModal ? (
        <MailroomRfqReviewModal
          open
          stackedOverWorkflow={rfqEditOverWorkflow}
          thread={thread}
          workflow={workflow!}
          intake={rfqIntake ?? null}
          onSaveDraft={onSaveRfqIntakeDraft}
          onConfirm={onConfirmRfqIntake}
          onEdit={onEditRfqIntake}
          onDismissPanel={onDismissRfqPlanPanel}
        />
      ) : null}
    </div>
  );
}

function generatedItemForAttachment(
  items: GeneratedItem[],
  attachment: EmailAttachment,
): GeneratedItem | undefined {
  return items.find((i) => i.id === attachment.source_id);
}

function EmailRow({
  message,
  outbound,
  generatedItems,
  onOpenGeneratedItem,
}: {
  message: EmailMessage;
  outbound?: boolean;
  generatedItems: GeneratedItem[];
  onOpenGeneratedItem: (item: GeneratedItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const plainBody = normalizeEmailBody(message.body);
  const preview = emailBodyPreview(plainBody, 100);
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
          <div className="whitespace-pre-wrap break-words">{plainBody}</div>
          {message.inlineImages && message.inlineImages.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {message.inlineImages.map((img) => (
                <li key={img.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.filename ?? "Email image"}
                    className="max-h-48 max-w-full rounded-md border border-border-light object-contain"
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {message.attachments && message.attachments.length > 0 ? (
            <div className="mt-2 border-t border-border-light pt-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                {message.attachments.length} attachment
                {message.attachments.length === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {message.attachments.map((a) => {
                  const linkedItem = generatedItemForAttachment(generatedItems, a);
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
                      {linkedItem ? (
                        <button
                          type="button"
                          onClick={() => onOpenGeneratedItem(linkedItem)}
                          className="hover:opacity-80"
                        >
                          {chip}
                        </button>
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
  hideInlineSuggestions,
  onApply,
  onQuickGenerate,
  onDismiss,
  onPreview,
}: {
  message: AgentChatMessage;
  suggestionById: Map<string, AgentSuggestion>;
  hideInlineSuggestions?: boolean;
  onApply: (s: AgentSuggestion) => void;
  onQuickGenerate: (s: AgentSuggestion) => void;
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
        {proposed.length > 0 && !hideInlineSuggestions ? (
          <div className="space-y-2">
            {proposed.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                onApply={onApply}
                onQuickGenerate={onQuickGenerate}
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
  onQuickGenerate,
  onDismiss,
  onPreview,
}: {
  s: AgentSuggestion;
  onApply: (s: AgentSuggestion) => void;
  onQuickGenerate: (s: AgentSuggestion) => void;
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
                onQuickGenerate(s);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onQuickGenerate(s);
                }
              }}
              className="cursor-pointer rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
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
  const entries = orderedPayloadEntries(payload).filter(
    ([, v]) => v !== undefined && v !== "",
  );
  if (entries.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 text-[11px]">
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-3">
          <span className="font-semibold uppercase text-text-secondary">{k.replaceAll("_", " ")}</span>
          <span className="max-w-[58%] text-right font-mono text-text-primary">
            {formatPayloadValue(v)}
          </span>
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
          {items.length} item{items.length === 1 ? "" : "s"} · tap for details
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
                            <button
                              type="button"
                              onClick={() => onOpenItem(i)}
                              className="font-semibold text-accent hover:underline"
                            >
                              Show details
                            </button>
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
              className="block text-center text-sm font-semibold text-accent hover:underline"
            >
              Open in workspace →
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
  const entries = orderedPayloadEntries(payload);
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
  primaryMode = "default",
  working = false,
  onClose,
  onSave,
  onSaveAndAttach,
}: {
  suggestion: AgentSuggestion;
  /** `attach` — opened from Quick generate; primary CTA is Generate & attach. */
  primaryMode?: "default" | "attach";
  working?: boolean;
  onClose: () => void;
  onSave: (title: string, payload: Record<string, unknown>) => void;
  onSaveAndAttach: (title: string, payload: Record<string, unknown>) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const kind = generatedKindFromSuggestion(suggestion.kind);
  const [title, setTitle] = useState(suggestion.title);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({ ...suggestion.payload }));
  const [fieldOrder, setFieldOrder] = useState(() => ensurePayloadFieldOrder(suggestion.payload));
  const [generating, setGenerating] = useState(true);
  const docNumber = useMemo(() => generateDocNumber(kind), [kind]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setGenerating(false), 750);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  function finalizePayload(): Record<string, unknown> {
    return payloadWithFieldOrder(draft, fieldOrder);
  }

  function setField(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (isPayloadFieldKey(key)) {
      setFieldOrder((prev) => appendKeyToFieldOrder(prev, key));
    }
  }

  function removeField(key: string) {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFieldOrder((prev) => removeKeyFromFieldOrder(prev, key));
  }

  function moveField(key: string, direction: "up" | "down") {
    setFieldOrder((prev) => movePayloadField(prev, key, direction));
  }

  const previewPayload = useMemo(
    () => payloadWithFieldOrder(draft, fieldOrder),
    [draft, fieldOrder],
  );
  const entries = orderedPayloadEntries(previewPayload);
  const safeTitle = title.trim() || suggestion.title;
  const emphasizeAttach = primaryMode === "attach";

  if (!mounted) return null;

  const overlay = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
      style={{ zIndex: MAILROOM_Z_DOC_PREVIEW }}
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
                Updates the preview live. Use ↑↓ to reorder fields.
              </p>
              <ul className="mt-3 space-y-2">
                {entries.map(([k, v], index) => (
                  <PayloadField
                    key={k}
                    fieldKey={k}
                    value={v}
                    canMoveUp={index > 0}
                    canMoveDown={index < entries.length - 1}
                    onMoveUp={() => moveField(k, "up")}
                    onMoveDown={() => moveField(k, "down")}
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
                <DocPreview kind={kind} title={safeTitle} payload={previewPayload} docNumber={docNumber} />
              </div>
            )}
          </section>
        </div>

        {working ? (
          <p
            className="flex shrink-0 items-center gap-2 border-t border-violet-200 bg-violet-50/90 px-6 py-2.5 text-sm font-medium text-violet-950"
            role="status"
            aria-live="polite"
          >
            <span
              className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-violet-300 border-t-accent"
              aria-hidden
            />
            Working… creating project and documents. Please wait.
          </p>
        ) : null}

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          {emphasizeAttach ? (
            <p className="mr-auto text-[11px] text-slate-500">
              Edit fields, then generate and attach to your reply.
            </p>
          ) : null}
          <button
            type="button"
            disabled={generating || working}
            onClick={() => onSave(safeTitle, finalizePayload())}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${
              emphasizeAttach
                ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                : "border border-violet-300 text-violet-700 hover:bg-violet-50"
            }`}
          >
            Generate only
          </button>
          <button
            type="button"
            disabled={generating || working}
            onClick={() => onSaveAndAttach(safeTitle, finalizePayload())}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-40 ${
              emphasizeAttach
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                : "border border-violet-300 bg-white text-violet-700 hover:bg-violet-50"
            }`}
          >
            <span aria-hidden>✨</span> Generate &amp; attach
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function PayloadFieldMoveButtons({
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5">
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={onMoveUp}
        aria-label="Move field up"
        className="rounded px-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        disabled={!canMoveDown}
        onClick={onMoveDown}
        aria-label="Move field down"
        className="rounded px-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-30"
      >
        ↓
      </button>
    </div>
  );
}

function PayloadField({
  fieldKey,
  value,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onChange,
  onRemove,
}: {
  fieldKey: string;
  value: unknown;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChange: (next: unknown) => void;
  onRemove: () => void;
}) {
  const label = fieldKey.replaceAll("_", " ");
  const moveButtons = (
    <PayloadFieldMoveButtons
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
    />
  );
  if (typeof value === "boolean") {
    return (
      <li className="flex items-center justify-between gap-2 rounded-lg border border-border-light bg-white px-3 py-2">
        {moveButtons}
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
      <li className="flex gap-2 rounded-lg border border-border-light bg-white px-3 py-2">
        {moveButtons}
        <div className="min-w-0 flex-1">
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
        </div>
      </li>
    );
  }
  const text = value == null ? "" : String(value);
  const isLong = text.length > 60 || text.includes("\n");
  return (
    <li className="flex gap-2 rounded-lg border border-border-light bg-white px-3 py-2">
      {moveButtons}
      <div className="min-w-0 flex-1">
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
      </div>
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
