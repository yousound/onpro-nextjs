/** Parsed numbered email rows from assistant plain-text replies. */

export type EmailSummaryItem = {
  index: number;
  subject: string;
  date: string;
  summary: string;
};

function stripMarkdown(value: string): string {
  return value.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Detects replies like:
 * `1. **Subject: ** … **Date: ** 2026-06-02 **Summary: ** … 2. **Subject: ** …`
 */
export function parseEmailSummaryItems(text: string): EmailSummaryItem[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (!/\d+\.\s+.*Subject:/i.test(trimmed)) return [];

  const chunks = trimmed.split(/(?=\d+\.\s)/).map((c) => c.trim()).filter(Boolean);
  const items: EmailSummaryItem[] = [];

  for (const chunk of chunks) {
    const head = chunk.match(/^(\d+)\.\s+([\s\S]*)$/);
    if (!head) continue;
    const body = head[2];
    const subject = body.match(/\*{0,2}Subject:\s*\*{0,2}\s*([\s\S]+?)\s*\*{0,2}Date:/i)?.[1];
    const date = body.match(/\*{0,2}Date:\s*\*{0,2}\s*([^\s*]+)/i)?.[1];
    const summary = body.match(/\*{0,2}Summary:\s*\*{0,2}\s*([\s\S]+)$/i)?.[1];
    if (!subject || !date || !summary) continue;
    items.push({
      index: Number(head[1]),
      subject: stripMarkdown(subject),
      date: stripMarkdown(date),
      summary: stripMarkdown(summary),
    });
  }

  return items;
}

/** Text before the first numbered email row (optional intro). */
export function emailSummaryIntro(text: string): string | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^([\s\S]+?)(?=\d+\.\s+\*{0,2}Subject:)/i);
  const intro = m?.[1]?.trim();
  if (!intro || parseEmailSummaryItems(intro).length > 0) return null;
  return stripMarkdown(intro);
}

export function formatEmailSummaryDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const dt = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function emailSummaryPlainText(items: EmailSummaryItem[]): string {
  return items
    .map(
      (item) =>
        `${item.index}. ${item.subject} (${item.date}) — ${item.summary}`,
    )
    .join("\n");
}
