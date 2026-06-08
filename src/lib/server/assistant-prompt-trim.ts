import type { EmailMessage, EmailThread } from "@/lib/types/agent";

export const PROMPT_BODY_MAX = 600;
/** Per-message body cap when user taps Summarize on one Mailroom thread (full thread, all messages). */
export const MAILROOM_SCAN_BODY_MAX = 5000;
export const PROMPT_EMAIL_THREADS_MAX = 12;
export const PROMPT_EMAIL_MESSAGES_MAX = 6;

export function trimPromptText(value: string | null | undefined, max = PROMPT_BODY_MAX): string {
  if (!value) return "";
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function compactEmailThreadForPrompt(thread: EmailThread) {
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    category: thread.category ?? null,
    channel: thread.channel ?? "email",
    project_id: thread.related?.project_id ?? null,
    job_id: thread.related?.job_id ?? null,
    participants: thread.participants.slice(0, 6).map((p) => ({
      name: p.name,
      email: p.email,
    })),
    messages: thread.messages.slice(-PROMPT_EMAIL_MESSAGES_MAX).map((m) => compactEmailMessage(m)),
  };
}

function compactEmailMessage(m: EmailMessage) {
  return {
    id: m.id,
    from: m.from,
    at: m.at,
    body: trimPromptText(m.body),
    attachment_labels: (m.attachments ?? []).map((a) => a.label).slice(0, 5),
  };
}

/** Full thread text for Mailroom Summarize only (all messages, 5000 chars each). */
export function mailroomThreadContextForPrompt(thread: EmailThread): string {
  const participants = thread.participants.slice(0, 12).map((p) => p.email).join(", ");
  const messages = thread.messages
    .map(
      (m, i) =>
        `[${i + 1}] From: ${m.from.name} <${m.from.email}> @ ${m.at}\n${trimPromptText(m.body, MAILROOM_SCAN_BODY_MAX)}`,
    )
    .join("\n\n---\n\n");
  const related = thread.related
    ? `\nRelated: project_id=${thread.related.project_id ?? "none"}, job_id=${thread.related.job_id ?? "none"}, vendor=${thread.related.vendor ?? "none"}`
    : "";
  return `Subject: ${thread.subject}\nParticipants: ${participants}${related}\n\n${messages}`;
}

/** Compact thread text for overview assistant (summarized-thread refs only). */
export function threadContextForPrompt(thread: EmailThread): string {
  const compact = compactEmailThreadForPrompt(thread);
  const messages = compact.messages
    .map(
      (m, i) =>
        `[${i + 1}] From: ${m.from.name} <${m.from.email}> @ ${m.at}\n${m.body}`,
    )
    .join("\n\n---\n\n");
  const related = compact.project_id || compact.job_id
    ? `\nRelated: project_id=${compact.project_id ?? "none"}, job_id=${compact.job_id ?? "none"}`
    : thread.related?.vendor
      ? `\nRelated: vendor=${thread.related.vendor}`
      : "";
  const participants = compact.participants.map((p) => p.email).join(", ");
  return `Subject: ${compact.subject}\nParticipants: ${participants}${related}\n\n${messages}`;
}
