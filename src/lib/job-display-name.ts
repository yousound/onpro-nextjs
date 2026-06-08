/** Strip Mailroom / agent prefixes so jobs show as style names only. */
export function sanitizeJobDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const stripped = trimmed
    .replace(/^create\s+job\s+for\s*:?\s*/i, "")
    .replace(/^add\s+job\s*:?\s*/i, "")
    .replace(/^create\s+job\s*:?\s*/i, "")
    .trim();

  return stripped || trimmed;
}
