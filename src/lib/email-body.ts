/** Strip HTML emails to readable plain text for UI and AI prompts. */
export function isLikelyHtml(text: string): boolean {
  const t = text.trim().slice(0, 500).toLowerCase();
  if (t.startsWith("<!doctype") || t.startsWith("<html")) return true;
  if (/<head[\s>]/.test(t) && /<body[\s>]/.test(t)) return true;
  if (/<\/?(div|p|span|table|tr|td|a|meta|style|script)\b/i.test(t)) return true;
  return false;
}

const ENTITY_MAP: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export function htmlToPlainText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  for (const [entity, ch] of Object.entries(ENTITY_MAP)) {
    s = s.split(entity).join(ch);
  }
  s = s.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, i, arr) => line.length > 0 || (arr[i - 1]?.length ?? 0) > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

export function normalizeEmailBody(body: string): string {
  const raw = body?.trim() ?? "";
  if (!raw) return "";
  if (isLikelyHtml(raw)) return htmlToPlainText(raw);
  return raw.replace(/\r\n/g, "\n");
}

/** One-line preview for thread lists. */
export function emailBodyPreview(body: string, maxLen = 120): string {
  const plain = normalizeEmailBody(body).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen)}…`;
}
