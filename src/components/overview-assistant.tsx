"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import { JobDetailsModal } from "@/components/job-details-modal";
import { normalizeJob } from "@/lib/job-defaults";
import { clientCodeByName } from "@/lib/reference/client-codes";
import { loadContacts, vendorContacts } from "@/lib/contacts-store";
import {
  buildAssistantContext,
  buildOvernightBriefing,
  greetingForHour,
  mockAssistantReply,
  assistantReplyPlain,
  type BriefingBlock,
  type BriefingLinkAction,
  type BriefingPart,
} from "@/lib/mock/overview-briefing";
import { getProjectById } from "@/lib/mock/projects";
import {
  hasBriefingAnimatedThisPageLoad,
  loadOverviewChatCache,
  markAssistantMessageAnimated,
  markBriefingAnimatedThisPageLoad,
  saveOverviewChatCache,
  shouldAnimateAssistantMessage,
  type OverviewChatMessage,
} from "@/lib/overview-assistant-session";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";

const MOCK_USER = { firstName: "Jerry" };

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

function AssistantMessageBody({
  msg,
  typing,
  onOpenJob,
  onTypingComplete,
}: {
  msg: ChatMessage;
  typing: boolean;
  onOpenJob: (projectId: number, jobId: string) => void;
  onTypingComplete: () => void;
}) {
  if (msg.parts?.length) {
    if (typing) {
      return (
        <TypewriterPartsMessage
          parts={msg.parts}
          active
          onComplete={onTypingComplete}
          onOpenJob={onOpenJob}
        />
      );
    }
    return (
      <TypewriterParts
        parts={msg.parts}
        charIndex={partsCharCount(msg.parts)}
        showCursor={false}
        onOpenJob={onOpenJob}
      />
    );
  }

  if (typing) {
    return <TypewriterText text={msg.text} active onComplete={onTypingComplete} />;
  }

  return <>{msg.text}</>;
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

export function OverviewAssistant() {
  const todayYmd = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hour = new Date().getHours();
  const greeting = greetingForHour(hour);
  const briefing = useMemo(() => buildOvernightBriefing(MOCK_USER.firstName, todayYmd), [todayYmd]);
  const ctx = useMemo(() => buildAssistantContext(todayYmd), [todayYmd]);

  const [chat, setChat] = useState<ChatMessage[]>(loadOverviewChatCache);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [briefingPhase, setBriefingPhase] = useState<"thinking" | "typing" | "done">(() =>
    hasBriefingAnimatedThisPageLoad() ? "done" : "thinking",
  );
  const [briefingChars, setBriefingChars] = useState(0);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [modalJob, setModalJob] = useState<{ project: Project; job: ProjectJob } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const vendors = useMemo(() => vendorContacts(loadContacts()), []);

  const briefingStream = useMemo(() => buildBriefingStream(briefing), [briefing]);
  const briefingTotal = useMemo(() => briefingCharCount(briefingStream), [briefingStream]);

  const openJob = useCallback((projectId: number, jobId: string) => {
    const project = getProjectById(projectId);
    if (!project) return;
    const job = loadProjectJobs(project.id, project).find((j) => j.id === jobId);
    if (!job) return;
    setModalJob({ project, job });
  }, []);

  useLayoutEffect(() => {
    if (hasBriefingAnimatedThisPageLoad()) {
      setBriefingPhase("done");
      setBriefingChars(briefingTotal);
    }
  }, [briefingTotal]);

  useEffect(() => {
    if (hasBriefingAnimatedThisPageLoad()) return;

    setBriefingPhase("thinking");
    setBriefingChars(0);
    const t = window.setTimeout(() => setBriefingPhase("typing"), 750);
    return () => window.clearTimeout(t);
  }, [briefingTotal]);

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
    saveOverviewChatCache(chat);
  }, [chat]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, thinking, briefingChars, typingMessageId]);

  function sendMessage() {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft("");
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
    setChat((prev) => [...prev, userMsg]);
    setThinking(true);
    window.setTimeout(() => {
      const reply = mockAssistantReply(text, ctx);
      const id = `a-${Date.now()}`;
      setChat((prev) => [
        ...prev,
        { id, role: "assistant", text: assistantReplyPlain(reply), parts: reply.parts },
      ]);
      setTypingMessageId(id);
      setThinking(false);
    }, 700 + Math.random() * 400);
  }

  return (
    <>
      <section
        className="relative overflow-hidden rounded-3xl border border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-slate-50 shadow-lg ring-1 ring-violet-100/80"
        aria-label="OnPro assistant"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 size-40 rounded-full bg-indigo-200/25 blur-3xl" />

        <div className="relative border-b border-violet-100/80 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-bold text-white shadow-md shadow-violet-500/30"
              aria-hidden
            >
              AI
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-violet-600/90">OnPro assistant</p>
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                {greeting}, {MOCK_USER.firstName}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">Your overnight brief — tap links to jump in.</p>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="relative max-h-[min(420px,52vh)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex gap-3">
            <div className="mt-1 size-2 shrink-0 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.6)]" />
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-violet-100 bg-white/90 px-4 py-3 shadow-sm">
              {briefingPhase === "thinking" ? (
                <p className="text-sm text-slate-600">
                  Catching up on overnight activity
                  <ThinkingDots />
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

          {chat.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {msg.role === "assistant" ? (
                <div className="mt-1 size-2 shrink-0 rounded-full bg-violet-500" />
              ) : (
                <div className="mt-1 size-8 shrink-0 rounded-full bg-slate-200" aria-hidden />
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
          <p className="mt-2 text-center text-[11px] text-slate-500">
            Concept preview — replies use mock data until AI is connected.
          </p>
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
        />
      ) : null}
    </>
  );
}
