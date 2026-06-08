"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { AssistantMessageParts } from "@/components/assistant-message-parts";
import { useCurrentUser } from "@/components/profile-provider";
import { dispatchOpenNewProject } from "@/lib/onpro-events";
import { sendAssistantMessageViaApi } from "@/lib/data/assistant-api";
import { assistantReplyPlain } from "@/lib/mock/overview-briefing";
import type { BriefingPart } from "@/lib/mock/overview-briefing";
import {
  detectWorkspaceWelcomeIntents,
  type WorkspaceQuickActionId,
} from "@/lib/workspace-welcome-intent";
import {
  enrichWelcomeAssistantReply,
  welcomeAssistantFallback,
} from "@/lib/workspace-welcome-reply";

type QuickAction = {
  id: WorkspaceQuickActionId;
  title: string;
  description: string;
  recommended?: boolean;
  icon: React.ReactNode;
  iconClass: string;
};

const ALL_ACTIONS: QuickAction[] = [
  {
    id: "gmail",
    title: "Connect Gmail",
    description: "Sync your inbox so we can learn your workflow and prep projects and documents for you.",
    recommended: true,
    icon: <GmailMark />,
    iconClass: "bg-[#ede9fe] text-[#7c3aed]",
  },
  {
    id: "contacts",
    title: "Import contacts",
    description: "Add your team and client contacts in seconds.",
    icon: <ContactsMark />,
    iconClass: "bg-[#dcfce7] text-[#16a34a]",
  },
  {
    id: "project",
    title: "Start a project",
    description: "Create your first project and kick things off.",
    icon: <ProjectMark />,
    iconClass: "bg-[#ffedd5] text-[#ea580c]",
  },
  {
    id: "calendar",
    title: "Add event on calendar",
    description: "Schedule your first event and stay on track.",
    icon: <CalendarMark />,
    iconClass: "bg-[#dbeafe] text-[#2563eb]",
  },
];

const PROMPT_CHIPS: { label: string; intent: WorkspaceQuickActionId; icon: React.ReactNode }[] = [
  { label: "I want to start a new project", intent: "project", icon: <ProjectMark className="size-3.5" /> },
  { label: "I want to connect my Gmail", intent: "gmail", icon: <GmailMark className="size-3.5" /> },
  { label: "I need to add my team or clients", intent: "contacts", icon: <ContactsMark className="size-3.5" /> },
  { label: "I want to schedule an event", intent: "calendar", icon: <CalendarMark className="size-3.5" /> },
];

type ChatLine = {
  role: "user" | "assistant";
  text: string;
  parts?: BriefingPart[];
};

type Props = {
  onDismiss: () => void;
};

export function WorkspaceWelcomeModal({ onDismiss }: Props) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const firstName = user?.firstName ?? "there";
  const [focusedIntents, setFocusedIntents] = useState<WorkspaceQuickActionId[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const visibleActions = useMemo(() => {
    if (focusedIntents.length === 0) return ALL_ACTIONS;
    return ALL_ACTIONS.filter((a) => focusedIntents.includes(a.id));
  }, [focusedIntents]);

  const applyIntentsFromText = useCallback((text: string) => {
    const intents = detectWorkspaceWelcomeIntents(text);
    if (intents.length > 0) setFocusedIntents(intents);
  }, []);

  const openNewProject = useCallback(() => {
    onDismiss();
    router.push("/projects");
    dispatchOpenNewProject();
  }, [onDismiss, router]);

  const scrollChat = useCallback(() => {
    requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  const runAssistant = useCallback(
    async (userText: string) => {
      applyIntentsFromText(userText);

      setChat((prev) => [...prev, { role: "user", text: userText }]);
      setSending(true);
      scrollChat();

      try {
        const history = [...chat, { role: "user" as const, text: userText }].map((m) => ({
          role: m.role,
          text: m.text,
        }));
        const res = await sendAssistantMessageViaApi({
          message: userText,
          userName: firstName,
          todayYmd: new Date().toISOString().slice(0, 10),
          history: history.slice(0, -1),
        });
        const enriched = enrichWelcomeAssistantReply(res.reply);
        applyIntentsFromText(userText);
        applyIntentsFromText(assistantReplyPlain(enriched));
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            text: assistantReplyPlain(enriched),
            parts: enriched.parts,
          },
        ]);
      } catch {
        const fallback = welcomeAssistantFallback(userText);
        setChat((prev) => [
          ...prev,
          {
            role: "assistant",
            text: assistantReplyPlain(fallback),
            parts: fallback.parts,
          },
        ]);
      } finally {
        setSending(false);
        scrollChat();
      }
    },
    [applyIntentsFromText, chat, firstName, scrollChat],
  );

  function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    void runAssistant(text);
  }

  function handleChip(label: string, intent: WorkspaceQuickActionId) {
    setFocusedIntents([intent]);
    void runAssistant(label);
  }

  function goAction(id: WorkspaceQuickActionId) {
    onDismiss();
    if (id === "gmail") router.push("/mailroom");
    else if (id === "contacts") router.push("/people");
    else if (id === "calendar") router.push("/calendar");
    else if (id === "project") {
      router.push("/projects");
      dispatchOpenNewProject();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-welcome-title"
        className="relative flex max-h-[min(680px,90vh)] w-full max-w-[940px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          ×
        </button>

        <div className="flex min-h-0 min-w-0 flex-1">
          {/* Left — quick actions */}
          <aside className="flex w-[48%] min-w-0 shrink-0 flex-col border-r border-slate-100 px-8 pb-7 pt-9">
            <div className="flex items-start gap-3">
              <SparkleIcon className="mt-1 size-5 shrink-0 text-[#7c3aed]" />
              <div>
                <h2 id="workspace-welcome-title" className="text-xl font-bold leading-snug text-slate-900">
                  Let&apos;s get you started
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  {focusedIntents.length > 0
                    ? "Here are the best next steps based on what you said."
                    : "Here are some quick ways to get things moving."}
                </p>
              </div>
            </div>

            {focusedIntents.length > 0 ? (
              <button
                type="button"
                onClick={() => setFocusedIntents([])}
                className="mt-3 text-left text-sm font-semibold text-[#7c3aed] hover:underline"
              >
                ← Show all quick actions
              </button>
            ) : null}

            <ul className="mt-6 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {visibleActions.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    onClick={() => goAction(action.id)}
                    className={`group relative flex w-full items-center gap-4 rounded-xl border bg-white px-4 py-4 text-left transition hover:border-violet-200 hover:shadow-sm ${
                      action.recommended && focusedIntents.length === 0
                        ? "border-[#a78bfa] shadow-[0_0_0_1px_rgba(124,58,237,0.12)]"
                        : "border-slate-200"
                    }`}
                  >
                    {action.recommended && focusedIntents.length === 0 ? (
                      <span className="absolute right-3 top-3 rounded-md bg-[#7c3aed] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Recommended
                      </span>
                    ) : null}
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${action.iconClass}`}
                    >
                      {action.icon}
                    </span>
                    <span className="min-w-0 flex-1 pr-7">
                      <span className="block text-base font-semibold text-slate-900">{action.title}</span>
                      <span className="mt-1 block text-sm leading-snug text-slate-500">
                        {action.description}
                      </span>
                    </span>
                    <ChevronIcon className="size-4 shrink-0 text-slate-300 group-hover:text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex shrink-0 items-center gap-2.5 rounded-xl bg-[#f5f3ff] px-4 py-3.5">
              <SparkleIcon className="size-[18px] shrink-0 text-[#7c3aed]" />
              <p className="text-sm leading-relaxed text-slate-600">
                You can always access these from the{" "}
                <span className="font-semibold text-[#7c3aed]">OnPro AI</span> tab.
              </p>
            </div>
          </aside>

          {/* Right — AI */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f8f7fc]">
            <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-4 pt-11">
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">Hi there! 👋</h3>
              <p className="mt-2.5 max-w-md text-[15px] leading-relaxed text-slate-600">
                I&apos;m <span className="font-semibold text-slate-800">OnPro AI</span>, your operations
                assistant. Let&apos;s get you set up and ready to go.
              </p>

              <div className="mt-6 flex gap-3 rounded-xl border border-violet-100/80 bg-[#f3efff] px-4 py-4">
                <SparkleIcon className="mt-0.5 size-[18px] shrink-0 text-[#7c3aed]" />
                <div>
                  <p className="text-base font-semibold text-slate-900">What are you trying to do today?</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    You can type anything — I&apos;ll help you get started or point you in the right
                    direction.
                  </p>
                </div>
              </div>

              {chat.length === 0 ? (
                <div className="mt-5 flex flex-col gap-2.5">
                  {PROMPT_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleChip(chip.label, chip.intent)}
                      className="flex w-fit max-w-full items-center gap-2.5 rounded-full border border-slate-200/90 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-violet-200 hover:bg-white hover:shadow"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-50">
                        {chip.icon}
                      </span>
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : (
                <ul className="mt-5 space-y-3">
                  {chat.map((m, i) => (
                    <li
                      key={i}
                      className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "ml-auto bg-[#7c3aed] text-white"
                          : "border border-slate-200/80 bg-white text-slate-800"
                      }`}
                    >
                      {m.role === "assistant" && m.parts?.length ? (
                        <AssistantMessageParts
                          parts={m.parts}
                          onCreateProject={openNewProject}
                        />
                      ) : (
                        m.text
                      )}
                    </li>
                  ))}
                  {sending ? (
                    <li className="text-sm text-slate-400">OnPro AI is thinking…</li>
                  ) : null}
                </ul>
              )}
              <div ref={chatEndRef} className="h-0 w-full" aria-hidden />
            </div>

            <div className="shrink-0 px-8 pb-7 pt-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-200/90 bg-white py-2 pl-5 pr-2 shadow-sm">
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus-visible:outline-none"
                  placeholder="Type your message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!draft.trim() || sending}
                  onClick={handleSend}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-sm transition hover:bg-[#6d28d9] focus:outline-none focus:ring-0 disabled:opacity-40"
                  aria-label="Send"
                >
                  <SendIcon />
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                OnPro AI can make mistakes. Check important info.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.2 4.4L17.6 8l-4.4 1.2L12 14l-1.2-4.8L6.4 8l4.4-1.6L12 2zm0 10l.9 3.3L16.2 16l-3.3.9L12 20l-.9-3.1L7.8 16l3.3-.7L12 12z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
      <path d="M5 12h12M14 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GmailMark({ className = "size-5" }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center font-bold ${className}`} aria-hidden>
      M
    </span>
  );
}

function ContactsMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <circle cx="9" cy="8" r="2.5" />
      <path d="M4 18c0-2.5 2.2-4 5-4s5 1.5 5 4M15 10v5M12.5 12.5H17.5" strokeLinecap="round" />
    </svg>
  );
}

function ProjectMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className} aria-hidden>
      <path d="M12 6v12M6 12h12" strokeLinecap="round" />
    </svg>
  );
}

function CalendarMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 3v3M16 3v3M4 10h16" strokeLinecap="round" />
    </svg>
  );
}
