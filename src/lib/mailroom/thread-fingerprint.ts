import type { EmailThread } from "@/lib/types/agent";

/** Detect when thread content changed so a new Summarize scan is required. */
export function mailroomThreadFingerprint(thread: EmailThread): string {
  const n = thread.messages.length;
  const last = thread.messages[n - 1];
  return `${n}:${last?.id ?? ""}:${last?.at ?? ""}:${thread.subject}`;
}
