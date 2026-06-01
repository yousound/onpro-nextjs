"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Conversation,
  ConversationParticipant,
} from "@/lib/types/messages";
import type { ThreadMessage } from "@/lib/mock/message-threads";
import type { EmailMessage, EmailThread } from "@/lib/types/agent";
import {
  addPromotedThread,
  appendOutboundReply,
  markThreadSummarized,
} from "@/lib/mailroom-state";

type Category = NonNullable<EmailThread["category"]>;

const CATEGORY_OPTIONS: Array<{ value: Category; label: string }> = [
  { value: "client", label: "Client" },
  { value: "vendor_quote", label: "Vendor" },
  { value: "internal", label: "Internal" },
  { value: "shipping", label: "Shipping" },
  { value: "other", label: "Other" },
];

function nowIso() {
  return new Date().toISOString();
}

function makeEmailFromMessage(
  msg: ThreadMessage,
  peer: ConversationParticipant | null,
  me: string,
): EmailMessage {
  const fromName = msg.side === "incoming" ? peer?.name ?? "Unknown" : "You";
  const fromEmail =
    msg.side === "incoming"
      ? slugifyEmail(peer?.name) || "unknown@in-app"
      : me;
  return {
    id: `msg-${msg.id}`,
    from: { name: fromName, email: fromEmail },
    at: nowIso(),
    body: msg.body,
  };
}

function slugifyEmail(name: string | undefined | null): string | null {
  if (!name) return null;
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return slug ? `${slug}@in-app` : null;
}

function detectCategory(conv: Conversation): Category {
  const blob = `${conv.name} ${conv.participants.map((p) => `${p.name} ${p.company_name ?? ""}`).join(" ")}`.toLowerCase();
  if (/vendor|factory|mill|printer|emb|cap/.test(blob)) return "vendor_quote";
  if (/internal|team|crew|@connectdots/.test(blob)) return "internal";
  if (/dhl|fedex|ups|tracking|ship/.test(blob)) return "shipping";
  return "client";
}

function defaultSubject(conv: Conversation, messages: ThreadMessage[]): string {
  const last = messages[messages.length - 1];
  const seed = last?.body.split("\n")[0]?.replace(/[*_`]/g, "").trim();
  if (seed && seed.length > 4) {
    const trimmed = seed.length > 80 ? `${seed.slice(0, 80)}…` : seed;
    return `${conv.name} — ${trimmed}`;
  }
  return `${conv.name} — In-app chat`;
}

function defaultSummaryBody(
  messages: ThreadMessage[],
  peer: ConversationParticipant | null,
): string {
  const peerFirst = (peer?.name ?? "there").split(/\s+/)[0];
  const bullets = messages
    .filter((m) => m.body.trim().length > 8)
    .slice(-6)
    .map((m) => {
      const speaker = m.side === "incoming" ? peer?.name ?? "You" : "Us";
      const line = m.body.replace(/\s+/g, " ").trim();
      const trimmed = line.length > 140 ? `${line.slice(0, 140)}…` : line;
      return `• ${speaker}: ${trimmed}`;
    });
  const body = bullets.length
    ? bullets.join("\n")
    : "(No detailed messages yet — sharing this thread so we can continue here.)";
  return [
    `Hi ${peerFirst},`,
    "",
    "Quick recap of what we've covered so far so we have it on the record:",
    "",
    body,
    "",
    "Anything to add or correct? I'll loop back from this address from now on so we keep everything in one trail.",
    "",
    "Thanks,",
  ].join("\n");
}

function isProbablyValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function PromoteToMailroomModal({
  conversation,
  messages,
  connectedEmail,
  onClose,
  onPromoted,
}: {
  conversation: Conversation;
  messages: ThreadMessage[];
  connectedEmail: string;
  onClose: () => void;
  onPromoted: (threadId: string) => void;
}) {
  const router = useRouter();

  const peer = useMemo<ConversationParticipant | null>(
    () =>
      conversation.participants.find((p) => !/connectdots|^me$/i.test(p.name)) ??
      conversation.participants[0] ??
      null,
    [conversation.participants],
  );

  const [subject, setSubject] = useState(() => defaultSubject(conversation, messages));
  const [category, setCategory] = useState<Category>(() => detectCategory(conversation));
  const [includeAll, setIncludeAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(messages.map((m) => m.id)),
  );
  const [crossLink, setCrossLink] = useState(true);
  const [autoNavigate, setAutoNavigate] = useState(true);
  const [alsoEmail, setAlsoEmail] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState(
    () => slugifyEmail(peer?.name) ?? "",
  );
  const [summaryBody, setSummaryBody] = useState(() => defaultSummaryBody(messages, peer));

  function toggle(id: string) {
    setIncludeAll(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (includeAll) {
      setIncludeAll(false);
      setSelectedIds(new Set());
    } else {
      setIncludeAll(true);
      setSelectedIds(new Set(messages.map((m) => m.id)));
    }
  }

  const chosen = messages.filter((m) => selectedIds.has(m.id));
  const recipientValid = !alsoEmail || isProbablyValidEmail(recipientEmail);
  const bodyValid = !alsoEmail || summaryBody.trim().length > 0;
  const canSubmit =
    subject.trim().length > 0 && chosen.length > 0 && recipientValid && bodyValid;

  function handleSubmit() {
    if (!canSubmit) return;
    const id = `prom-msg-${conversation.id}-${Date.now().toString(36)}`;
    const baseParticipants = conversation.participants.map((p) => ({
      name: p.name,
      email: slugifyEmail(p.name) ?? `${p.id}@in-app`,
    }));
    // If we're emailing the peer and the typed address differs from what we synthesized,
    // prefer the user-entered address for that peer.
    const participants =
      alsoEmail && peer
        ? baseParticipants.map((p) =>
            p.name === peer.name ? { ...p, email: recipientEmail.trim() } : p,
          )
        : baseParticipants;
    const thread: EmailThread = {
      id,
      subject: subject.trim(),
      participants,
      messages: chosen.map((m) => makeEmailFromMessage(m, peer, connectedEmail)),
      status: "unread",
      category,
      channel: "in_app",
      linked_message_conversation_id: crossLink ? conversation.id : undefined,
      related:
        conversation.project_id != null ? { project_id: conversation.project_id } : undefined,
    };
    addPromotedThread(thread, crossLink ? conversation.id : undefined);
    markThreadSummarized(id);
    if (alsoEmail) {
      const summaryMsg: EmailMessage = {
        id: `outbound-summary-${Date.now()}`,
        from: { name: "You", email: connectedEmail },
        at: nowIso(),
        body: summaryBody.trim(),
      };
      appendOutboundReply(id, summaryMsg);
    }
    onPromoted(id);
    if (autoNavigate) {
      router.push(`/mailroom?thread=${encodeURIComponent(id)}`);
    } else {
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="promote-modal-title"
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
            ✨ Promote to Mailroom
          </p>
          <h3 id="promote-modal-title" className="mt-0.5 text-base font-bold text-slate-900">
            {conversation.name}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Creates a Mailroom thread from this conversation and runs the agent on it.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className="block text-xs font-medium text-slate-600">
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">
                Include messages ({chosen.length}/{messages.length})
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] font-semibold text-violet-700 hover:underline"
              >
                {includeAll ? "Unselect all" : "Select all"}
              </button>
            </div>
            <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/40 p-2">
              {messages.length === 0 ? (
                <li className="text-center text-[11px] text-slate-500">No messages in this thread.</li>
              ) : (
                messages.map((m) => {
                  const checked = selectedIds.has(m.id);
                  return (
                    <li key={m.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-[12px] ${
                          checked ? "bg-violet-50/70" : "hover:bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(m.id)}
                          className="mt-0.5 size-3.5 accent-violet-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500">
                            <span>{m.side === "incoming" ? peer?.name ?? "Them" : "You"}</span>
                            <span>·</span>
                            <span>{m.time_label}</span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-[12px] text-slate-700">{m.body}</span>
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={crossLink}
              onChange={(e) => setCrossLink(e.target.checked)}
              className="size-3.5 accent-violet-600"
            />
            Cross-link this Messages conversation with the Mailroom thread
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={autoNavigate}
              onChange={(e) => setAutoNavigate(e.target.checked)}
              className="size-3.5 accent-violet-600"
            />
            Open the new Mailroom thread after promoting
          </label>

          <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-xs font-semibold text-violet-800">
              <input
                type="checkbox"
                checked={alsoEmail}
                onChange={(e) => setAlsoEmail(e.target.checked)}
                className="mt-0.5 size-3.5 accent-violet-600"
              />
              <span className="min-w-0 flex-1">
                <span className="block">
                  Also send a recap email to {peer?.name ?? "the participant"}
                </span>
                <span className="mt-0.5 block text-[11px] font-normal text-violet-700/80">
                  Sends the AI summary as the first outbound message on the new Mailroom thread.
                </span>
              </span>
            </label>
            {alsoEmail ? (
              <div className="mt-3 space-y-2">
                <label className="block text-[11px] font-medium text-slate-600">
                  To
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="client@example.com"
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                      recipientValid
                        ? "border-slate-200 focus:border-violet-500 focus:ring-violet-500"
                        : "border-red-300 focus:border-red-500 focus:ring-red-500"
                    }`}
                  />
                  {!recipientValid ? (
                    <span className="mt-1 block text-[11px] text-red-600">
                      Enter a valid email address.
                    </span>
                  ) : null}
                </label>
                <div className="flex items-center justify-between gap-2">
                  <label className="block flex-1 text-[11px] font-medium text-slate-600">
                    Recap body
                  </label>
                  <button
                    type="button"
                    onClick={() => setSummaryBody(defaultSummaryBody(chosen, peer))}
                    className="text-[10px] font-semibold text-violet-700 hover:underline"
                    title="Regenerate from the currently selected messages"
                  >
                    ✨ Regenerate
                  </button>
                </div>
                <textarea
                  value={summaryBody}
                  onChange={(e) => setSummaryBody(e.target.value)}
                  rows={7}
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[12px] leading-snug text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <p className="text-[10px] text-slate-500">
                  Mock send — added to the Mailroom outbox for the new thread. No real email leaves
                  your machine.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {alsoEmail ? "Promote & send recap" : "Promote"}
          </button>
        </div>
      </div>
    </div>
  );
}
