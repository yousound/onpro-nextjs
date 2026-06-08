import { deriveCompanyCode } from "@/lib/types/contact";
import type { ParsedImportContactRow } from "@/lib/types/contact-import";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Pull every RFC-like email out of free text (comma lists, notes, etc.). */
export function extractEmailsFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.matchAll(EMAIL_RE)) {
    const email = match[0].trim().toLowerCase();
    if (!seen.has(email)) {
      seen.add(email);
      out.push(email);
    }
  }
  return out;
}

function stripEmailsFromText(text: string): string {
  return text
    .replace(EMAIL_RE, " ")
    .replace(/[,;|/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contactNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._+-]+/g, " ").trim();
  if (!cleaned) return email;
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function uniqueCodeForSplit(base: ParsedImportContactRow, email: string, index: number): string {
  if (index === 0 && base.company_code?.trim()) {
    return base.company_code.trim().toUpperCase().slice(0, 3);
  }
  const hint = base.contact_name?.trim() || contactNameFromEmail(email);
  const fromHint = deriveCompanyCode(`${base.name} ${hint}`);
  if (index === 0) return fromHint;
  const fromEmail = deriveCompanyCode(email.split("@")[0] ?? hint);
  return fromEmail !== fromHint ? fromEmail : deriveCompanyCode(`${hint} ${index + 1}`);
}

/**
 * One import row per distinct email. Fixes AI/CSV cells that glued multiple addresses
 * (or names) into a single contact — including rows that only share a mail domain.
 */
export function expandParsedImportRows(rows: ParsedImportContactRow[]): ParsedImportContactRow[] {
  const expanded: ParsedImportContactRow[] = [];

  for (const row of rows) {
    const sources = [row.email, ...(row.other_emails ?? [])].filter((s) => s?.trim());
    const emails = new Set<string>();
    for (const src of sources) {
      for (const email of extractEmailsFromText(src)) emails.add(email);
    }

    const remainder = stripEmailsFromText(row.email);
    const trailingName = remainder && !remainder.includes("@") ? remainder : "";

    if (emails.size === 0) {
      expanded.push({
        ...row,
        contact_name: row.contact_name || trailingName || undefined,
        other_emails: undefined,
      });
      continue;
    }

    if (emails.size === 1) {
      const email = [...emails][0];
      expanded.push({
        ...row,
        email,
        contact_name: row.contact_name || trailingName || undefined,
        other_emails: undefined,
      });
      continue;
    }

    const list = [...emails];
    list.forEach((email, index) => {
      const splitWarning = "Split from a row with multiple emails — confirm name and type.";
      expanded.push({
        ...row,
        email,
        contact_name:
          index === 0
            ? row.contact_name || trailingName || contactNameFromEmail(email)
            : row.contact_name || contactNameFromEmail(email),
        company_code: uniqueCodeForSplit(row, email, index),
        other_emails: undefined,
        warnings: row.warnings?.includes(splitWarning)
          ? row.warnings
          : [...(row.warnings ?? []), splitWarning],
      });
    });
  }

  return expanded;
}
