import type { EmailThread } from "@/lib/types/agent";
import { emailBodyPreview } from "@/lib/email-body";

/** Filter already-imported threads (subject, participants, body preview). */
export function filterImportedGmailThreads(
  threads: EmailThread[],
  query: string,
): EmailThread[] {
  const q = query.trim().toLowerCase();
  if (!q) return threads;

  return threads.filter((t) => {
    if (t.subject.toLowerCase().includes(q)) return true;
    if (
      t.participants.some(
        (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
      )
    ) {
      return true;
    }
    const last = t.messages[t.messages.length - 1];
    if (last) {
      const preview = emailBodyPreview(last.body).toLowerCase();
      if (preview.includes(q)) return true;
      if (last.body.toLowerCase().includes(q)) return true;
    }
    return false;
  });
}
