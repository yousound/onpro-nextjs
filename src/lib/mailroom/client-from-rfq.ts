import { inferBrandFromProductLine } from "@/lib/mailroom/project-from-thread";
import type { EmailThread } from "@/lib/types/agent";

/** Workspace operator names — not end-customer brands on RFQ projects. */
const OPERATOR_CLIENT_ALIASES = ["connect dots", "connectdots"];

/** Client PO tokens in free text — subject, body, or LLM payload. */
export function extractClientPoFromText(text: string): string | null {
  const sub = text.trim();
  if (!sub) return null;
  const explicit =
    sub.match(/\bPO#?\s*([A-Z][A-Z0-9-]{2,})\b/i) ??
    sub.match(/\b(?:PO|Project)\s*#?\s*[:.]?\s*([A-Z]{2,4}\d{6,})\b/i) ??
    sub.match(/^PO#?\s*([A-Z0-9][-A-Z0-9]*)/i);
  if (explicit?.[1]) return explicit[1].trim().toUpperCase();
  const compact = sub.match(/\b([A-Z]{2,4}\d{6,})\b/);
  return compact?.[1]?.trim().toUpperCase() ?? null;
}

/** Client PO from subject, e.g. `PO#ZOE260104 - ZOE Conference…` → `ZOE260104`. */
export function extractClientPoFromSubject(subject: string): string | null {
  return extractClientPoFromText(subject);
}

/** Search message bodies newest-first when the subject has no PO. */
export function extractClientPoFromBodies(bodies: string[]): string | null {
  for (const body of bodies) {
    const po = extractClientPoFromText(body);
    if (po) return po;
  }
  return null;
}

/** Subject first, then email bodies (newest message first). */
export function extractClientPoFromThread(
  thread: Pick<EmailThread, "subject" | "messages">,
): string | null {
  const fromSubject = extractClientPoFromSubject(thread.subject ?? "");
  if (fromSubject) return fromSubject;
  const bodies = [...thread.messages].reverse().map((m) => m.body ?? "");
  return extractClientPoFromBodies(bodies);
}

export function isWorkspaceOperatorClientName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  if (!lower) return false;
  return OPERATOR_CLIENT_ALIASES.some((op) => lower.includes(op));
}

/** Infer end-customer brand from project title / email subject (e.g. ZOE Conference). */
export function inferBrandClientName(projectName: string, threadSubject?: string): string | null {
  const pn = projectName.trim();
  const sub = (threadSubject ?? "").trim();

  const fromSubject =
    sub.match(/(?:PO#?\s*)?ZOE\s*Conference/i)?.[0]?.replace(/^PO#?\s*/i, "") ??
    sub.match(/[-–]\s*(ZOE\s+Conference[^-+]*)/i)?.[1]?.trim();
  if (fromSubject) {
    const cleaned = fromSubject.replace(/\s+(Tees|Hoodie).*$/i, "").trim();
    return cleaned || "ZOE Conference";
  }

  if (!pn) return null;

  const conference = pn.match(/^(.+?\s+Conference)\b/i);
  if (conference) return conference[1].trim();

  if (/^ZOE\b/i.test(pn)) return "ZOE Conference";

  const beforeProduct = pn.match(/^([A-Za-z0-9][\w\s&'.-]*?)\s+(?:Tees|Hoodie|Drop|Collection)\b/i);
  if (beforeProduct) return beforeProduct[1].trim();

  return null;
}

/**
 * RFQ forwarded to the operator (Connect Dots) should attach the brand as project client,
 * not the operator's own company.
 */
export function normalizeRfqProjectPayload(
  payload: Record<string, unknown>,
  threadSubject?: string,
  threadBodies?: string[],
): Record<string, unknown> {
  const subject = (threadSubject ?? "").trim();
  const poFromThread =
    extractClientPoFromSubject(subject) ??
    (threadBodies?.length ? extractClientPoFromBodies(threadBodies) : null);
  const next: Record<string, unknown> = { ...payload };
  if (poFromThread && !String(next.client_po_number ?? "").trim()) {
    next.client_po_number = poFromThread;
  }

  const projectName = String(next.name ?? next.project_name ?? "").trim();
  const clientHint = String(
    next.client ?? next.client_name ?? next.company ?? "",
  ).trim();

  if (!isWorkspaceOperatorClientName(clientHint)) {
    return next;
  }

  const brand =
    inferBrandClientName(projectName, subject) ??
    inferBrandClientName(clientHint, subject) ??
    (projectName ? inferBrandFromProductLine(projectName) : null);

  if (!brand) return next;

  const auto = next.auto_contact as Record<string, unknown> | undefined;

  return {
    ...next,
    client: brand,
    client_name: brand,
    auto_contact: auto
      ? {
          ...auto,
          company: brand,
        }
      : { company: brand },
  };
}
