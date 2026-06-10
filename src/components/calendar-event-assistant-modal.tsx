"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { applyCalendarChatProposal } from "@/lib/calendar-chat-apply";
import { findLinkedProject } from "@/lib/calendar-project-match";
import { buildCalendarEventContext } from "@/lib/calendar-event-snapshot";
import { calendarChatFallbackReply } from "@/lib/calendar-chat-intent";
import { loadProjectJobs } from "@/lib/project-wip-edits";
import { formatTimeRange } from "@/lib/calendar-utils";
import { removeCalendarEvent } from "@/lib/calendar-events-store";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { sendCalendarChatViaApi } from "@/lib/data/calendar-api";
import { listResolvableProjects } from "@/lib/agent-suggestion-resolve";
import type { CalendarChatProposal } from "@/lib/openai/calendar-chat-reply";
import type { CalendarEvent } from "@/lib/types/calendar";
import type { Project } from "@/lib/types/project";

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposal?: CalendarChatProposal | null;
};

const PROMPT_CHIPS = [
  "Scan linked project for shipping, carrier, and job info",
  "Fill this event from the project shipping fields",
  "Add shipping for 11 am pickup",
] as const;

type Props = {
  event: CalendarEvent;
  seedIds: ReadonlySet<number>;
  onClose: () => void;
  onEventUpdated: (event: CalendarEvent) => void;
  onEventDeleted?: () => void;
  onRefreshGoogle?: () => void;
};

export function CalendarEventAssistantModal({
  event,
  seedIds,
  onClose,
  onEventUpdated,
  onEventDeleted,
  onRefreshGoogle,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>(() => [
    {
      id: "intro",
      role: "assistant",
      text: `You're on “${event.name}”. I can scan a linked project for shipping & carrier info, fill calendar fields from the project, or apply updates like “add shipping for 11 am pickup”.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [linkedProject, setLinkedProject] = useState<Project | null>(null);
  const [linkReason, setLinkReason] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const projects = listResolvableProjects();
    const link = findLinkedProject(event, projects);
    setLinkedProject(link?.project ?? null);
    setLinkReason(link?.reason ?? null);
  }, [event]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, replying]);

  const pendingTitles = useMemo(
    () =>
      chat
        .filter((m) => m.proposal)
        .map((m) => m.proposal!.title),
    [chat],
  );

  const handleDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await removeCalendarEvent(event, {
        live: isClientLiveBackend(),
        onRefreshGoogle,
      });
      setDeleteConfirm(false);
      onEventDeleted?.();
      onClose();
      window.dispatchEvent(new Event("onpro-calendar-changed"));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete event");
    } finally {
      setDeleting(false);
    }
  }, [deleting, event, onClose, onEventDeleted, onRefreshGoogle]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || replying) return;
      setDraft("");
      setApplyError(null);
      const userLine: ChatLine = { id: `u-${Date.now()}`, role: "user", text: trimmed };
      const history = [...chat, userLine].map((m) => ({ role: m.role, text: m.text }));
      setChat((prev) => [...prev, userLine]);
      setReplying(true);

      try {
        const data = await sendCalendarChatViaApi({
          event,
          message: trimmed,
          history: history.slice(0, -1),
          pendingProposalTitles: pendingTitles,
        });
        if (data.linked_project_id && !linkedProject) {
          const p = listResolvableProjects().find((x) => x.id === data.linked_project_id);
          if (p) setLinkedProject(p);
        }
        if (data.link_reason) setLinkReason(data.link_reason);
        setChat((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: data.reply,
            proposal: data.propose_update,
          },
        ]);
      } catch (e) {
        console.warn("[calendar-assistant] API failed", e);
        const projects = listResolvableProjects();
        const link = findLinkedProject(event, projects);
        const jobs = link ? loadProjectJobs(link.project.id, link.project) : [];
        const ctx = buildCalendarEventContext(
          event,
          link?.project ?? null,
          jobs,
          link?.reason ?? null,
        );
        const fallback = calendarChatFallbackReply(trimmed, ctx);
        setChat((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: fallback.reply,
            proposal: fallback.proposeUpdate,
          },
        ]);
      } finally {
        setReplying(false);
      }
    },
    [chat, event, linkedProject, pendingTitles, replying],
  );

  async function applyProposal(proposal: CalendarChatProposal) {
    setApplying(true);
    setApplyError(null);
    try {
      const result = await applyCalendarChatProposal({
        event,
        proposal,
        seedIds,
        linkedProject,
      });
      if (!result.ok) {
        setApplyError(result.message);
        return;
      }
      onEventUpdated(result.event);
      if (result.project) setLinkedProject(result.project);
      setChat((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: "assistant",
          text: result.message,
        },
      ]);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not apply");
    } finally {
      setApplying(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-2 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-event-assistant-title"
        className="flex max-h-[min(720px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-border-light px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Calendar · OnPro AI</p>
              <h2 id="calendar-event-assistant-title" className="truncate text-lg font-semibold text-text-primary">
                {event.name}
              </h2>
              <p className="mt-0.5 text-xs text-text-secondary">
                {formatTimeRange(event.start_time, event.end_time)}
                {event.po ? ` · PO ${event.po}` : ""}
              </p>
              {linkedProject ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Linked:{" "}
                  <Link
                    href={`/projects/${linkedProject.id}`}
                    className="font-semibold text-accent hover:underline"
                    onClick={onClose}
                  >
                    {linkedProject.name}
                  </Link>
                  {linkReason ? <span className="text-text-secondary"> ({linkReason})</span> : null}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-800/90">No project matched — mention a PO or project name in chat.</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {deleteConfirm ? (
                <>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                    className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setDeleteConfirm(false)}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-text-secondary hover:bg-slate-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
          {deleteError ? (
            <p className="mt-2 text-xs font-medium text-red-600" role="alert">
              {deleteError}
            </p>
          ) : null}
          {deleteConfirm && !deleteError ? (
            <p className="mt-2 text-xs text-text-secondary">
              {event.external_id
                ? `Removes from Google Calendar (${event.calendar_owner_name ?? event.calendar_owner_email ?? "connected account"}).`
                : "Removes this event from your calendar in this browser."}
            </p>
          ) : null}
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-2 pb-3">
            {PROMPT_CHIPS.map((label) => (
              <button
                key={label}
                type="button"
                disabled={replying}
                onClick={() => void sendMessage(label)}
                className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-left text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>
          <ul className="space-y-3">
            {chat.map((line) => (
              <li
                key={line.id}
                className={`flex ${line.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    line.role === "user"
                      ? "bg-accent text-white"
                      : "bg-slate-100 text-text-primary"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{line.text}</p>
                  {line.proposal ? (
                    <div className="mt-3 rounded-xl border border-violet-200 bg-white p-3 text-text-primary shadow-sm">
                      <p className="text-xs font-semibold text-violet-800">{line.proposal.title}</p>
                      <button
                        type="button"
                        disabled={applying}
                        onClick={() => void applyProposal(line.proposal!)}
                        className="mt-2 w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        {applying ? "Applying…" : "Apply to calendar & project"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
            {replying ? (
              <li className="text-sm text-text-secondary">Thinking…</li>
            ) : null}
          </ul>
          {applyError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {applyError}
            </p>
          ) : null}
        </div>

        <form
          className="shrink-0 border-t border-border-light bg-slate-50/80 p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(draft);
          }}
        >
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Scan project shipping… or “add shipping for 11 am pickup”"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              disabled={replying}
            />
            <button
              type="submit"
              disabled={replying || !draft.trim()}
              className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (!mounted) return modal;
  return createPortal(modal, document.body);
}
