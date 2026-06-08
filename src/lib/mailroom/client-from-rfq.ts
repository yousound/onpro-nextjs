import { inferBrandFromProductLine } from "@/lib/mailroom/project-from-thread";

/** Workspace operator names — not end-customer brands on RFQ projects. */
const OPERATOR_CLIENT_ALIASES = ["connect dots", "connectdots"];

/** Client PO from subject, e.g. `PO#ZOE260104 - ZOE Conference…` → `ZOE260104`. */
export function extractClientPoFromSubject(subject: string): string | null {
  const sub = subject.trim();
  if (!sub) return null;
  const match =
    sub.match(/\bPO#?\s*([A-Z][A-Z0-9-]{2,})\b/i) ??
    sub.match(/^PO#?\s*([A-Z0-9][-A-Z0-9]*)/i);
  return match?.[1]?.trim() ?? null;
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
): Record<string, unknown> {
  const subject = (threadSubject ?? "").trim();
  const poFromSubject = extractClientPoFromSubject(subject);
  const next: Record<string, unknown> = { ...payload };
  if (poFromSubject && !String(next.client_po_number ?? "").trim()) {
    next.client_po_number = poFromSubject;
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
