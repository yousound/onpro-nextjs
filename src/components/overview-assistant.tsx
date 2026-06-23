"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import { JobDetailsModal } from "@/components/job-details-modal";
import { normalizeJob } from "@/lib/job-defaults";
import { clientCodeByName } from "@/lib/reference/client-codes";
import { isClientLiveBackend, isClientMockBackend } from "@/lib/config/backend-mode";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { loadContacts, vendorContacts } from "@/lib/contacts-store";
import {
  buildClientAssistantFallbackSnapshot,
  buildOvernightBriefing,
  greetingForHour,
  mockAssistantReply,
  assistantReplyPlain,
  type BriefingBlock,
  type BriefingLinkAction,
  type BriefingPart,
} from "@/lib/mock/overview-briefing";
import {
  loadAssistantPrefsFromSession,
  saveAssistantPrefsToSession,
} from "@/lib/assistant/prefs-session";
import { mergeAssistantPrefs } from "@/lib/assistant/prefs";
import {
  fetchAssistantBriefingViaApi,
  sendAssistantMessageViaApi,
} from "@/lib/data/assistant-api";
import type { AssistantPrefs } from "@/lib/types/assistant-prefs";
import { readSessionProjects } from "@/lib/mock/project-session";
import {
  clearBriefingAnimatedThisPageLoad,
  hasBriefingAnimatedThisPageLoad,
  hydrateOverviewChatFromStorage,
  markAssistantMessageAnimated,
  markBriefingAnimatedThisPageLoad,
  saveOverviewChatCache,
  shouldAnimateAssistantMessage,
  type OverviewChatMessage,
} from "@/lib/overview-assistant-session";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";

import { AssistantEmailSummaryCards } from "@/components/assistant-email-summary-cards";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { useCurrentUser } from "@/components/profile-provider";
import {
  emailSummaryIntro,
  parseEmailSummaryItems,
} from "@/lib/assistant-email-summary";
import { buildClientJobsOverlay } from "@/lib/assistant/client-jobs-overlay";
import {
  applyWorkspaceProposal,
  ASSISTANT_CONFIRM_PHRASE,
  findPendingWorkspaceProposal,
  pickerJobsPreview,
  planWorkspaceActionFromMessage,
  type WorkspaceProposal,
} from "@/lib/assistant/workspace-split-jobs";

const MOCK_FIRST_NAME = "Jerry";

type ChatMessage = OverviewChatMessage;

type BriefingStreamSegment =
  | { kind: "text"; blockId: string; value: string }
  | { kind: "link"; blockId: string; action: BriefingLinkAction; label: string };

function buildBriefingStream(blocks: BriefingBlock[]): BriefingStreamSegment[] {
  const out: BriefingStreamSegment[] = [];
  for (const block of blocks) {
    for (const part of block.parts) {
      if (part.type === "text") {
        out.push({ kind: "text", blockId: block.id, value: part.value });
      } else {
        out.push({ kind: "link", blockId: block.id, action: part.action, label: part.action.label });
      }
    }
  }
  return out;
}

function briefingCharCount(stream: BriefingStreamSegment[]): number {
  return stream.reduce((n, s) => n + (s.kind === "text" ? s.value.length : s.label.length), 0);
}

function BriefingLinkButton({
  action,
  onOpenJob,
}: {
  action: BriefingLinkAction;
  onOpenJob: (projectId: number, jobId: string) => void;
}) {
  const className = "font-bold text-violet-700 underline decoration-violet-400/80 underline-offset-2 hover:text-violet-900";

  if (action.kind === "job") {
    return (
      <button type="button" className={className} onClick={() => onOpenJob(action.projectId, action.jobId)}>
        {action.label}
      </button>
    );
  }
  if (action.kind === "project") {
    return (
      <Link href={`/projects/${action.projectId}`} className={className}>
        {action.label}
      </Link>
    );
  }
  if (action.kind === "messages") {
    return (
      <Link href={action.href ?? "/messages"} className={className}>
        {action.label}
      </Link>
    );
  }
  if (action.kind === "calendar") {
    return (
      <Link href="/calendar" className={className}>
        {action.label}
      </Link>
    );
  }
  if (action.kind === "people") {
    return (
      <Link href="/people" className={className}>
        {action.label}
      </Link>
    );
  }
  if (action.kind === "production") {
    return (
      <Link href="/production" className={className}>
        {action.label}
      </Link>
    );
  }
  if (action.kind === "projects") {
    return (
      <Link href="/projects" className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <Link href="/documents" className={className}>
      {action.label}
    </Link>
  );
}

function partsCharCount(parts: BriefingPart[]): number {
  return parts.reduce((n, p) => n + (p.type === "text" ? p.value.length : p.action.label.length), 0);
}

function TypewriterParts({
  parts,
  charIndex,
  showCursor,
  onOpenJob,
  className = "",
}: {
  parts: BriefingPart[];
  charIndex: number;
  showCursor: boolean;
  onOpenJob: (projectId: number, jobId: string) => void;
  className?: string;
}) {
  const nodes = useMemo(() => {
    const out: ReactNode[] = [];
    let pos = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const len = part.type === "text" ? part.value.length : part.action.label.length;
      if (charIndex <= pos) break;

      if (part.type === "link") {
        out.push(
          <BriefingLinkButton key={`link-${i}-${pos}`} action={part.action} onOpenJob={onOpenJob} />,
        );
        pos += len;
        continue;
      }

      const visible = Math.min(len, charIndex - pos);
      if (visible > 0) {
        out.push(<span key={`t-${i}-${pos}`}>{part.value.slice(0, visible)}</span>);
      }
      pos += len;
    }
    return out;
  }, [parts, charIndex, onOpenJob]);

  return (
    <span className={className}>
      {nodes}
      <TypewriterCursor show={showCursor} />
    </span>
  );
}

function TypewriterCursor({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-violet-600"
      aria-hidden
    />
  );
}

function TypewriterBriefing({
  blocks,
  charIndex,
  showCursor,
  onOpenJob,
}: {
  blocks: BriefingBlock[];
  charIndex: number;
  showCursor: boolean;
  onOpenJob: (projectId: number, jobId: string) => void;
}) {
  const stream = useMemo(() => buildBriefingStream(blocks), [blocks]);
  const blockOrder = useMemo(() => [...new Set(stream.map((s) => s.blockId))], [stream]);

  const paragraphs = useMemo(() => {
    let globalPos = 0;
    return blockOrder
      .map((blockId) => {
        const segs = stream.filter((s) => s.blockId === blockId);
        const blockLen = segs.reduce(
          (n, s) => n + (s.kind === "text" ? s.value.length : s.label.length),
          0,
        );
        const blockStart = globalPos;
        globalPos += blockLen;

        if (charIndex <= blockStart) return null;

        const parts: BriefingPart[] = segs.map((s) =>
          s.kind === "text"
            ? { type: "text", value: s.value }
            : { type: "link", action: s.action },
        );
        const localChars = Math.min(blockLen, charIndex - blockStart);

        return (
          <p key={blockId}>
            <TypewriterParts
              parts={parts}
              charIndex={localChars}
              showCursor={false}
              onOpenJob={onOpenJob}
            />
          </p>
        );
      })
      .filter(Boolean);
  }, [stream, blockOrder, charIndex, onOpenJob]);

  return (
    <div className="text-[15px] leading-relaxed text-slate-800 sm:text-base">
      <div className="space-y-3">{paragraphs}</div>
      <TypewriterCursor show={showCursor} />
    </div>
  );
}

function TypewriterPartsMessage({
  parts,
  active,
  msPerChar = 12,
  onComplete,
  onOpenJob,
}: {
  parts: BriefingPart[];
  active: boolean;
  msPerChar?: number;
  onComplete?: () => void;
  onOpenJob: (projectId: number, jobId: string) => void;
}) {
  const total = partsCharCount(parts);
  const [count, setCount] = useState(active ? 0 : total);

  useEffect(() => {
    if (!active) {
      setCount(total);
      return;
    }
    setCount(0);
  }, [parts, active, total]);

  useEffect(() => {
    if (!active || count >= total) return;
    const id = window.setTimeout(() => setCount((c) => c + 1), msPerChar);
    return () => window.clearTimeout(id);
  }, [active, count, total, msPerChar]);

  useEffect(() => {
    if (active && count >= total && total > 0) onComplete?.();
  }, [active, count, total, onComplete]);

  return (
    <TypewriterParts
      parts={parts}
      charIndex={count}
      showCursor={active && count < total}
      onOpenJob={onOpenJob}
    />
  );
}

function emailItemsFromMessage(msg: ChatMessage) {
  const fromText = msg.text ? parseEmailSummaryItems(msg.text) : [];
  if (fromText.length > 0) return fromText;
  const joined =
    msg.parts
      ?.filter((p): p is { type: "text"; value: string } => p.type === "text")
      .map((p) => p.value)
      .join("") ?? "";
  return parseEmailSummaryItems(joined);
}

function WorkspaceProposalCard({
  proposal,
  onConfirm,
  onSelectSourceProject,
  busy,
}: {
  proposal: WorkspaceProposal;
  onConfirm: () => void;
  onSelectSourceProject?: (projectId: number) => void;
  busy: boolean;
}) {
  const { status, error } = proposal;
  if (status === "applied") {
    return (
      <p className="mt-3 text-xs font-medium text-emerald-700">Applied — check Projects to review.</p>
    );
  }
  if (status === "failed") {
    return (
      <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
        {error ?? "Could not apply this change."}
      </p>
    );
  }

  if (proposal.kind === "pick_source_project") {
    const { plan } = proposal;
    const selected = plan.projects.find((p) => p.id === plan.selectedProjectId);
    const previewJobs =
      plan.selectedProjectId != null ? pickerJobsPreview(plan, plan.selectedProjectId) : [];

    return (
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2.5 text-xs text-slate-800">
        <p className="font-semibold text-violet-900">Pick source project</p>
        <p className="mt-1 text-slate-700">
          Move <strong>{plan.jobToken}</strong> jobs into{" "}
          {plan.targetProjectExists ? (
            <>
              existing project <strong>{plan.targetProjectName}</strong>
            </>
          ) : (
            <>
              new project <strong>{plan.targetProjectName}</strong>
            </>
          )}
          . Which project should they come from?
        </p>
        {plan.targetProjectExists ? (
          <p className="mt-1 text-[11px] text-violet-800">
            A project named “{plan.targetProjectName}” already exists — confirm will move jobs
            there, not create a duplicate.
          </p>
        ) : null}
        {plan.projects.length === 0 ? (
          <p className="mt-2 text-slate-600">No projects in your workspace yet.</p>
        ) : (
          <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
            {plan.projects.map((p) => {
              const active = p.id === plan.selectedProjectId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSelectSourceProject?.(p.id)}
                    className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                      active
                        ? "border-accent bg-white ring-2 ring-accent/25"
                        : "border-violet-100 bg-white/80 hover:border-violet-300 hover:bg-white"
                    }`}
                  >
                    <span
                      className={`mt-0.5 size-3.5 shrink-0 rounded-full border-2 ${
                        active ? "border-accent bg-accent" : "border-slate-300 bg-white"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        {p.suggested ? (
                          <span className="rounded-full bg-violet-200/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-800">
                            Suggested
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-600">
                        {p.clientName} · {p.status.replace(/-/g, " ")}
                        {p.matchingJobCount > 0
                          ? ` · ${p.matchingJobCount} matching job${p.matchingJobCount === 1 ? "" : "s"}`
                          : p.jobCount > 0
                            ? ` · ${p.jobCount} job${p.jobCount === 1 ? "" : "s"}`
                            : " · no jobs"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {selected && previewJobs.length > 0 ? (
          <>
            <p className="mt-2 font-medium text-slate-800">
              {previewJobs.length} job{previewJobs.length === 1 ? "" : "s"} to move from{" "}
              {selected.name}:
            </p>
            <ul className="mt-1 list-inside list-disc text-slate-700">
              {previewJobs.map((j) => (
                <li key={j.id}>
                  {j.name}
                  {j.job_number ? ` (${j.job_number})` : ""}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {busy ? "Working…" : plan.targetProjectExists
                ? `Confirm — move jobs to ${plan.targetProjectName}`
                : `Confirm — create ${plan.targetProjectName} & move jobs`}
            </button>
          </>
        ) : selected && previewJobs.length === 0 ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-900">
            No {plan.jobToken} jobs on {selected.name}. Pick another project.
          </p>
        ) : null}
      </div>
    );
  }

  if (proposal.kind === "create_project") {
    const { plan } = proposal;
    return (
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2.5 text-xs text-slate-800">
        <p className="font-semibold text-violet-900">Confirm new project</p>
        {plan.existingProject ? (
          <>
            <p className="mt-1">
              Project <strong>{plan.name}</strong> already exists for{" "}
              <strong>{plan.existingProject.client.name}</strong>.
            </p>
            <p className="mt-1 text-[11px] text-violet-800">
              Confirm will not create a duplicate — it will use the existing project.
            </p>
          </>
        ) : (
          <p className="mt-1">
            Create <strong>{plan.name}</strong> for client <strong>{plan.client.name}</strong>.
          </p>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-95 disabled:opacity-50"
        >
          {busy
            ? "Working…"
            : plan.existingProject
              ? "Confirm — use existing project"
              : "Confirm — create project"}
        </button>
      </div>
    );
  }

  if (proposal.kind !== "split_jobs") return null;
  const { plan } = proposal;
  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2.5 text-xs text-slate-800">
      <p className="font-semibold text-violet-900">Confirm workspace change</p>
      <p className="mt-1">
        Remove {plan.jobsToMove.length} job{plan.jobsToMove.length === 1 ? "" : "s"} from{" "}
        <strong>{plan.sourceProject.name}</strong>, create <strong>{plan.targetProjectName}</strong>,
        and move them there:
      </p>
      <ul className="mt-1.5 list-inside list-disc text-slate-700">
        {plan.jobsToMove.map((j) => (
          <li key={j.id}>
            {j.name}
            {j.job_number ? ` (${j.job_number})` : ""}
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={busy}
        onClick={onConfirm}
        className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-95 disabled:opacity-50"
      >
        {busy ? "Working…" : "Confirm — create project & move jobs"}
      </button>
    </div>
  );
}

function AssistantMessageBody({
  msg,
  typing,
  onOpenJob,
  onTypingComplete,
  onConfirmWorkspaceProposal,
  onSelectSourceProject,
  workspaceProposalBusy,
}: {
  msg: ChatMessage;
  typing: boolean;
  onOpenJob: (projectId: number, jobId: string) => void;
  onTypingComplete: () => void;
  onConfirmWorkspaceProposal?: (messageId: string) => void;
  onSelectSourceProject?: (messageId: string, projectId: number) => void;
  workspaceProposalBusy?: boolean;
}) {
  const emailItems = emailItemsFromMessage(msg);
  if (emailItems.length > 0) {
    return (
      <AssistantEmailSummaryCards
        items={emailItems}
        intro={msg.text ? emailSummaryIntro(msg.text) : null}
      />
    );
  }

  if (msg.parts?.length) {
    if (typing) {
      return (
        <>
          <TypewriterPartsMessage
            parts={msg.parts}
            active
            onComplete={onTypingComplete}
            onOpenJob={onOpenJob}
          />
          {msg.workspaceProposal ? (
            <WorkspaceProposalCard
              proposal={msg.workspaceProposal}
              busy={workspaceProposalBusy ?? false}
              onConfirm={() => onConfirmWorkspaceProposal?.(msg.id)}
              onSelectSourceProject={(projectId) =>
                onSelectSourceProject?.(msg.id, projectId)
              }
            />
          ) : null}
        </>
      );
    }
    return (
      <>
        <TypewriterParts
          parts={msg.parts}
          charIndex={partsCharCount(msg.parts)}
          showCursor={false}
          onOpenJob={onOpenJob}
        />
        {msg.workspaceProposal ? (
          <WorkspaceProposalCard
            proposal={msg.workspaceProposal}
            busy={workspaceProposalBusy ?? false}
            onConfirm={() => onConfirmWorkspaceProposal?.(msg.id)}
            onSelectSourceProject={(projectId) =>
              onSelectSourceProject?.(msg.id, projectId)
            }
          />
        ) : null}
      </>
    );
  }

  if (typing) {
    return <TypewriterText text={msg.text} active onComplete={onTypingComplete} />;
  }

  return (
    <>
      {msg.text}
      {msg.workspaceProposal ? (
        <WorkspaceProposalCard
          proposal={msg.workspaceProposal}
          busy={workspaceProposalBusy ?? false}
          onConfirm={() => onConfirmWorkspaceProposal?.(msg.id)}
          onSelectSourceProject={(projectId) => onSelectSourceProject?.(msg.id, projectId)}
        />
      ) : null}
    </>
  );
}

function TypewriterText({
  text,
  active,
  onComplete,
}: {
  text: string;
  active: boolean;
  onComplete?: () => void;
}) {
  const [count, setCount] = useState(active ? 0 : text.length);

  useEffect(() => {
    if (!active) {
      setCount(text.length);
      return;
    }
    setCount(0);
  }, [text, active]);

  useEffect(() => {
    if (!active || count >= text.length) return;
    const id = window.setTimeout(() => setCount((c) => c + 1), 12);
    return () => window.clearTimeout(id);
  }, [active, count, text.length]);

  useEffect(() => {
    if (active && count >= text.length && text.length > 0) onComplete?.();
  }, [active, count, text.length, onComplete]);

  return (
    <span>
      {text.slice(0, count)}
      <TypewriterCursor show={active && count < text.length} />
    </span>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 pl-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block size-1.5 rounded-full bg-violet-500 animate-pulse"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

export function OverviewAssistant({ layout = "page" }: { layout?: "page" | "modal" }) {
  const router = useRouter();
  const showBriefing = layout === "page";
  const { user: profileUser, loading: profileLoading } = useCurrentUser();
  const firstName = isClientMockBackend()
    ? MOCK_FIRST_NAME
    : (profileUser?.firstName ?? "there");
  const userDisplayName = profileUser?.fullName ?? firstName;
  const userAvatarUrl =
    profileUser?.avatarUrl ?? (isClientMockBackend() ? "/user-avatar-demo.png" : null);

  const todayYmd = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const [briefing, setBriefing] = useState<BriefingBlock[]>(() =>
    showBriefing && isClientMockBackend()
      ? buildOvernightBriefing(MOCK_FIRST_NAME, todayYmd, loadAssistantPrefsFromSession())
      : [],
  );
  const [assistantLive, setAssistantLive] = useState(false);
  const [assistantPrefs, setAssistantPrefs] = useState<AssistantPrefs>(() =>
    loadAssistantPrefsFromSession(),
  );

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [briefingPhase, setBriefingPhase] = useState<"thinking" | "typing" | "done">(() =>
    !showBriefing || hasBriefingAnimatedThisPageLoad() ? "done" : "thinking",
  );
  const [briefingChars, setBriefingChars] = useState(0);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [modalJob, setModalJob] = useState<{ project: Project; job: ProjectJob } | null>(null);
  const [workspaceProposalBusy, setWorkspaceProposalBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const briefingLoadingRef = useRef(false);
  const vendors = useMemo(() => vendorContacts(loadContacts()), []);

  const refreshBriefing = useCallback(async (opts?: { forceRefresh?: boolean }) => {
    if (!showBriefing || briefingLoadingRef.current) return;
    if (isClientLiveBackend() && profileLoading) return;

    briefingLoadingRef.current = true;
    clearBriefingAnimatedThisPageLoad();
    setBriefingPhase("thinking");
    setBriefingChars(0);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const [, data] = await Promise.all([
        new Promise<void>((r) => window.setTimeout(r, 750)),
        fetchAssistantBriefingViaApi(firstName, todayYmd, assistantPrefs, {
          forceRefresh: opts?.forceRefresh === true,
        }).catch(() => null),
      ]);

      if (
        data &&
        (data.source === "openai" || data.source === "live") &&
        data.blocks.length > 0
      ) {
        setBriefing(data.blocks);
        setAssistantLive(data.source === "openai");
      } else if (isClientMockBackend()) {
        setBriefing(buildOvernightBriefing(MOCK_FIRST_NAME, todayYmd, assistantPrefs));
      }

      if (data?.assistantPrefs) {
        const merged = mergeAssistantPrefs(assistantPrefs, data.assistantPrefs);
        setAssistantPrefs(merged);
        saveAssistantPrefsToSession(merged);
      }

      setBriefingPhase("typing");
    } finally {
      briefingLoadingRef.current = false;
    }
  }, [showBriefing, firstName, todayYmd, profileLoading, assistantPrefs]);

  const briefingStream = useMemo(() => buildBriefingStream(briefing), [briefing]);
  const briefingTotal = useMemo(() => briefingCharCount(briefingStream), [briefingStream]);

  const openJob = useCallback((projectId: number, jobId: string) => {
    const project =
      (isClientLiveBackend()
        ? getLiveCachedProjects().find((p) => p.id === projectId)
        : readSessionProjects().find((p) => p.id === projectId)) ?? null;
    if (!project) return;
    const job = loadProjectJobs(project.id, project).find((j) => j.id === jobId);
    if (!job) return;
    setModalJob({ project, job });
  }, []);

  useLayoutEffect(() => {
    if (!showBriefing || hasBriefingAnimatedThisPageLoad()) {
      setBriefingPhase("done");
      setBriefingChars(briefingTotal);
    }
  }, [briefingTotal, showBriefing]);

  useEffect(() => {
    if (!showBriefing) return;
    if (hasBriefingAnimatedThisPageLoad()) return;
    void refreshBriefing();
  }, [showBriefing, profileLoading, refreshBriefing]);

  useEffect(() => {
    if (briefingPhase === "typing" || briefingPhase === "done") {
      markBriefingAnimatedThisPageLoad();
    }
  }, [briefingPhase]);

  useEffect(() => {
    return () => {
      if (briefingPhase !== "thinking") markBriefingAnimatedThisPageLoad();
    };
  }, [briefingPhase]);

  useEffect(() => {
    if (briefingPhase !== "typing") return;
    if (briefingChars >= briefingTotal) {
      setBriefingPhase("done");
      return;
    }
    const delay = briefingChars < 40 ? 18 : briefingChars < 120 ? 14 : 10;
    const id = window.setTimeout(() => setBriefingChars((c) => c + 1), delay);
    return () => window.clearTimeout(id);
  }, [briefingPhase, briefingChars, briefingTotal]);

  useEffect(() => {
    setChat(hydrateOverviewChatFromStorage());
    setChatHydrated(true);
  }, []);

  useEffect(() => {
    if (!chatHydrated) return;
    saveOverviewChatCache(chat);
  }, [chat, chatHydrated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, thinking, briefingChars, typingMessageId]);

  const selectSourceProject = useCallback((messageId: string, projectId: number) => {
    setChat((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || m.workspaceProposal?.kind !== "pick_source_project") return m;
        return {
          ...m,
          workspaceProposal: {
            ...m.workspaceProposal,
            plan: { ...m.workspaceProposal.plan, selectedProjectId: projectId },
            error: undefined,
          },
        };
      }),
    );
  }, []);

  const confirmWorkspaceProposal = useCallback(async (messageId: string) => {
    const msg = chat.find((m) => m.id === messageId);
    const proposal = msg?.workspaceProposal;
    if (!proposal || proposal.status !== "pending") return;

    setWorkspaceProposalBusy(true);
    try {
      const result = await applyWorkspaceProposal(proposal);
      setChat((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                workspaceProposal: {
                  ...proposal,
                  status: result.ok ? ("applied" as const) : ("failed" as const),
                  error: result.ok ? undefined : result.message,
                },
                text: result.ok ? `${m.text}\n\n${result.message}` : m.text,
              }
            : m,
        ),
      );
      if (result.ok && isClientLiveBackend()) {
        router.refresh();
      }
    } finally {
      setWorkspaceProposalBusy(false);
    }
  }, [chat, router]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");

    if (ASSISTANT_CONFIRM_PHRASE.test(text)) {
      const pending = findPendingWorkspaceProposal(chat);
      if (pending) {
        const pendingMsg = chat[pending.index];
        if (pendingMsg?.role === "assistant") {
          const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
          setChat((prev) => [...prev, userMsg]);
          await confirmWorkspaceProposal(pendingMsg.id);
          return;
        }
      }
    }

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
    const history = [...chat, userMsg].map((m) => ({
      role: m.role,
      text: m.text,
    }));
    setChat((prev) => [...prev, userMsg]);
    setThinking(true);

    const actionPlan = planWorkspaceActionFromMessage(text, {
      history: history.slice(0, -1),
    });
    const workspaceProposal = actionPlan.ok ? actionPlan.proposal : undefined;

    try {
      const data = await sendAssistantMessageViaApi({
        message: text,
        userName: firstName,
        todayYmd,
        history: history.slice(0, -1),
        assistantPrefs,
        clientJobs: buildClientJobsOverlay(),
      });
      if (data.assistantPrefs) {
        const merged = mergeAssistantPrefs(assistantPrefs, data.assistantPrefs);
        setAssistantPrefs(merged);
        saveAssistantPrefsToSession(merged);
      }
      if (data.source === "openai" || data.source === "live") {
        setAssistantLive(data.source === "openai");
      }
      const id = `a-${Date.now()}`;
      const emailList = parseEmailSummaryItems(data.text);
      let replyText = data.text;
      if (workspaceProposal?.kind === "pick_source_project") {
        const { plan } = workspaceProposal;
        const suggested = plan.projects.filter((p) => p.suggested).map((p) => p.name);
        const hint =
          suggested.length > 0
            ? ` I suggest ${suggested.slice(0, 2).join(" or ")} — tap the right project below.`
            : " Pick the source project below.";
        replyText = `${data.text}\n\nI'll create “${plan.targetProjectName}” and move ${plan.jobToken} jobs.${hint} Then confirm.`;
      } else if (workspaceProposal?.kind === "split_jobs") {
        const n = workspaceProposal.plan.jobsToMove.length;
        replyText = `${data.text}\n\nI found ${n} matching job${n === 1 ? "" : "s"} on “${workspaceProposal.plan.sourceProject.name}” in your browser. Tap Confirm below (or reply “confirm”) to create “${workspaceProposal.plan.targetProjectName}” and move them.`;
      } else if (workspaceProposal?.kind === "create_project") {
        replyText = `${data.text}\n\nReady to create “${workspaceProposal.plan.name}” for ${workspaceProposal.plan.client.name}. Tap Confirm below (or reply “confirm”).`;
      } else if (
        !actionPlan.ok &&
        actionPlan.error &&
        /\b(create|new|split|move|project|bau)\b/i.test(text)
      ) {
        replyText = `${data.text}\n\n${actionPlan.error}`;
      }
      setChat((prev) => [
        ...prev,
        {
          id,
          role: "assistant",
          text: replyText,
          parts: data.reply.parts,
          workspaceProposal,
        },
      ]);
      if (emailList.length === 0) setTypingMessageId(id);
    } catch (e) {
      console.warn("[overview-assistant] API failed", e);
      const id = `a-${Date.now()}`;
      const failText = isClientLiveBackend()
        ? "Could not reach the assistant. Check you're signed in and try again."
        : assistantReplyPlain(
            mockAssistantReply(
              text,
              buildClientAssistantFallbackSnapshot(firstName, todayYmd, assistantPrefs),
            ),
          );
      setChat((prev) => [...prev, { id, role: "assistant", text: failText }]);
      if (parseEmailSummaryItems(failText).length === 0) setTypingMessageId(id);
    } finally {
      setThinking(false);
    }
  }

  const scrollMaxClass =
    layout === "modal" ? "max-h-[min(520px,58vh)]" : "max-h-[min(420px,52vh)]";
  const sectionClass =
    layout === "modal"
      ? "relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-slate-50 shadow-2xl ring-1 ring-violet-100/80"
      : "relative overflow-hidden rounded-3xl border border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-slate-50 shadow-lg ring-1 ring-violet-100/80";

  return (
    <>
      <section
        className={sectionClass}
        aria-label="OnPro assistant"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full bg-indigo-200/25 blur-3xl" />

        <div className="relative border-b border-violet-100/80 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white shadow-md shadow-violet-500/30"
                aria-hidden
              >
                AI
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-600/90">OnPro assistant</p>
                <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                  {greeting}, {firstName}
                </h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  {showBriefing
                    ? "Your workspace brief — tap links to jump in."
                    : "Ask about projects, jobs, or anything in your workspace."}
                </p>
              </div>
            </div>
            {showBriefing ? (
              <button
                type="button"
                onClick={() => void refreshBriefing({ forceRefresh: true })}
                disabled={briefingPhase === "thinking"}
                className="shrink-0 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Refresh workspace brief"
              >
                {briefingPhase === "thinking" ? "Updating…" : "Update me"}
              </button>
            ) : null}
          </div>
        </div>

        <div ref={scrollRef} className={`relative min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6 ${scrollMaxClass}`}>
          {showBriefing ? (
            <div className="flex gap-3">
              <div className="mt-1 size-2 shrink-0 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.6)]" />
              <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-violet-100 bg-white/90 px-4 py-3 shadow-sm">
                {briefingPhase === "thinking" ? (
                  <p className="text-sm text-slate-600">
                    Pulling together your workspace
                    <ThinkingDots />
                  </p>
                ) : briefing.length === 0 && briefingPhase === "done" ? (
                  <p className="text-sm text-slate-600">
                    Ask me about projects, jobs, messages, or your team.
                  </p>
                ) : (
                  <TypewriterBriefing
                    blocks={briefing}
                    charIndex={briefingChars}
                    showCursor={briefingPhase === "typing"}
                    onOpenJob={openJob}
                  />
                )}
              </div>
            </div>
          ) : chat.length === 0 && !thinking ? (
            <p className="py-2 text-center text-sm text-slate-500">
              Ask about projects, jobs, messages, or your workspace.
            </p>
          ) : null}

          {chat.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {msg.role === "assistant" ? (
                <div className="mt-1 size-2 shrink-0 rounded-full bg-violet-500" />
              ) : (
                <div className="mt-0.5 shrink-0">
                  <DirectoryAvatar name={userDisplayName} avatarUrl={userAvatarUrl} size="sm" />
                </div>
              )}
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[85%] sm:text-[15px] ${
                  msg.role === "user"
                    ? "rounded-tr-md bg-accent text-white"
                    : "rounded-tl-md border border-slate-200 bg-white text-slate-800"
                }`}
              >
                {msg.role === "assistant" ? (
                  <AssistantMessageBody
                    msg={msg}
                    typing={
                      msg.id === typingMessageId && shouldAnimateAssistantMessage(msg.id)
                    }
                    onOpenJob={openJob}
                    workspaceProposalBusy={workspaceProposalBusy}
                    onConfirmWorkspaceProposal={(id) => void confirmWorkspaceProposal(id)}
                    onSelectSourceProject={selectSourceProject}
                    onTypingComplete={() => {
                      markAssistantMessageAnimated(msg.id);
                      setTypingMessageId(null);
                    }}
                  />
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {thinking ? (
            <div className="flex gap-3">
              <div className="mt-1 size-2 shrink-0 rounded-full bg-violet-500 animate-pulse" />
              <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Thinking
                <ThinkingDots />
              </div>
            </div>
          ) : null}
        </div>

        <form
          className="relative border-t border-violet-100/80 bg-white/80 px-4 py-3 backdrop-blur-sm sm:px-5"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about any project, job, or the team…"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-inner outline-none ring-violet-500/0 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              aria-label="Message OnPro assistant"
            />
            <button
              type="submit"
              disabled={!draft.trim() || thinking}
              className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </form>
      </section>

      {modalJob ? (
        <JobDetailsModal
          project={modalJob.project}
          job={normalizeJob(modalJob.job, modalJob.project)}
          allJobs={loadProjectJobs(modalJob.project.id, modalJob.project)}
          clientCode={clientCodeByName(modalJob.project.client.name) ?? "GG"}
          vendors={vendors}
          onClose={() => setModalJob(null)}
          onSave={(saved) => {
            const current = loadProjectJobs(modalJob.project.id, modalJob.project);
            const next = current.map((j) => (j.id === saved.id ? saved : j));
            saveProjectJobs(modalJob.project.id, next);
            setModalJob({ project: modalJob.project, job: saved });
          }}
          onDelete={() => {
            const label = modalJob.job.name.trim() || "this job";
            if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
            const current = loadProjectJobs(modalJob.project.id, modalJob.project);
            saveProjectJobs(
              modalJob.project.id,
              current.filter((j) => j.id !== modalJob.job.id),
            );
            setModalJob(null);
          }}
          onSwitchJob={(jobId) => {
            const j = loadProjectJobs(modalJob.project.id, modalJob.project).find((x) => x.id === jobId);
            if (j) setModalJob({ project: modalJob.project, job: j });
          }}
        />
      ) : null}
    </>
  );
}
