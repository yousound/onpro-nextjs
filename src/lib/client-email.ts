/** Workspace / operator inboxes — not end-customer contacts. */
const OPERATOR_EMAIL_DOMAINS = ["connectdots.la", "connectdots.co", "connectdots.example"];

export function isOperatorWorkspaceEmail(email: string | null | undefined): boolean {
  const raw = email?.trim().toLowerCase();
  if (!raw || !raw.includes("@")) return false;
  const domain = raw.split("@")[1] ?? "";
  return OPERATOR_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function sanitizeClientEmail(email: string | null | undefined): string {
  const trimmed = email?.trim() ?? "";
  if (!trimmed || isOperatorWorkspaceEmail(trimmed)) return "";
  return trimmed;
}
