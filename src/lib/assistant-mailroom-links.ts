/** Resolve Mailroom email-thread links for the OnPro assistant. */

export type AssistantEmailThreadRef = {
  id: string;
  subject: string;
};

export function mailroomThreadHref(threadId?: string): string {
  if (!threadId) return "/mailroom";
  return `/mailroom?thread=${encodeURIComponent(threadId)}`;
}

function normalizeMatchText(value: string): string {
  return value.toLowerCase().replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

/** Match assistant link label or user query to an email thread from the ops snapshot. */
export function findEmailThreadByQuery(
  threads: AssistantEmailThreadRef[],
  query: string,
): AssistantEmailThreadRef | undefined {
  const q = normalizeMatchText(query);
  if (!q || threads.length === 0) return undefined;

  const byId = threads.find((t) => q.includes(t.id.toLowerCase()));
  if (byId) return byId;

  for (const t of threads) {
    const subj = normalizeMatchText(t.subject);
    if (q.includes(subj) || subj.includes(q)) return t;
  }

  const tokens = q.split(/\s+/).filter((w) => w.length > 3);
  if (tokens.length === 0) return undefined;

  let best: { thread: AssistantEmailThreadRef; score: number } | null = null;
  for (const t of threads) {
    const subj = normalizeMatchText(t.subject);
    const score = tokens.filter((w) => subj.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { thread: t, score };
  }

  return best?.thread;
}

export function labelLooksLikeMailroomEmail(label: string): boolean {
  const l = normalizeMatchText(label);
  return (
    l.includes("mailroom") ||
    l.includes("gmail") ||
    l.includes("inbox") ||
    /\b(api usage|usage limit|openai|google account)\b/.test(l)
  );
}
