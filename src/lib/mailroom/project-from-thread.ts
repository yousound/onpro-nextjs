import { inferBrandClientName, isWorkspaceOperatorClientName } from "@/lib/mailroom/client-from-rfq";

export type ThreadNameHints = {
  threadSubject?: string;
  jobTitle?: string;
  jobPayload?: Record<string, unknown>;
  summary?: string;
  projectName?: string;
};

const STYLE_REF = /\b(?:Ref\.?\s*)?([A-Z]{2,}\d{2,})\b/i;

const PRODUCT_LINE_TAIL =
  /\s+(Boxer Shorts|Boxer Short|T-?Shirts?|Tees?|Hoodies?|Shorts|Dress(?:es)?|Skirts?|Jackets?|Pants|Trousers|Caps?|Bags?|Collection|Drop)\s*$/i;

const SUBJECT_NOISE =
  /^(?:(?:re|fw|fwd)\s*:\s*)*(?:(?:comments?|fit comments?|update|sample)\s*(?:for|on|re)?\s*)*/i;

/** Style ref from subject, summary, or labels (e.g. BAU01). */
export function extractStyleRef(...texts: (string | undefined | null)[]): string | null {
  for (const raw of texts) {
    const t = raw?.trim();
    if (!t) continue;
    const m = t.match(STYLE_REF);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return null;
}

/** Strip leading style ref and trailing sample/comment noise from a job or subject label. */
export function productNameFromJobLabel(label: string): string | null {
  const t = label.trim();
  if (!t) return null;

  const name = t
    .replace(/^[A-Z]{2,}\d{2,}\s*[-–:]\s*/i, "")
    .replace(/\s*[-–]\s*(?:comments?|fit comments?|sample|rfq|update)\b.*$/i, "")
    .replace(/\s+(?:sample|comments?|rfq)\b.*$/i, "")
    .trim();

  if (name.length >= 3 && name !== t) return name;

  const product = t.match(
    /\b([A-Za-z][\w'&.-]*(?:\s+[A-Za-z][\w'&.-]*){0,5}\s+(?:Boxer Shorts|Boxer Short|T-?Shirts?|Tees?|Hoodies?|Shorts|Dress(?:es)?|Skirts?|Jackets?|Pants|Trousers|Caps?|Bags?))\b/i,
  );
  if (product?.[1]) return product[1].trim();

  return name.length >= 3 ? name : null;
}

/** Brand before product-type words, e.g. "Born Again Boxer Shorts" → "Born Again". */
export function inferBrandFromProductLine(projectName: string): string | null {
  const pn = projectName.trim();
  if (!pn) return null;
  const m = pn.match(new RegExp(`^(.+?)${PRODUCT_LINE_TAIL.source}`, "i"));
  const brand = m?.[1]?.trim();
  if (!brand || brand.length < 2) return null;
  if (isWorkspaceOperatorClientName(brand)) return null;
  return brand;
}

function jobLabelFromHints(hints: ThreadNameHints): string {
  const title = hints.jobTitle?.trim() ?? "";
  if (title) return title;
  const p = hints.jobPayload;
  if (!p) return "";
  return String(p.name ?? p.job_name ?? p.title ?? p.style ?? "").trim();
}

function cleanSubjectLine(subject: string): string | null {
  const sub = subject.trim();
  if (!sub) return null;
  let name = sub.replace(SUBJECT_NOISE, "").trim();
  name = name.replace(/^PO#?\s*\S+\s*[-–]\s*/i, "").trim();
  name = name.replace(/^[A-Z]{2,}\d{2,}\s*[-–:]\s*/i, "").trim();
  name = name.replace(/\s*[-–]\s*(?:comments?|fit comments?|sample|rfq)\b.*$/i, "").trim();
  if (name.length >= 3 && !/^new project$/i.test(name)) return name;
  return null;
}

/** Ops-facing project title from thread subject, job step, or AI summary. */
export function inferProjectNameFromThread(hints: ThreadNameHints): string | null {
  const existing = hints.projectName?.trim();
  if (existing && !/^new project$/i.test(existing)) return existing;

  const jobLabel = jobLabelFromHints(hints);
  if (jobLabel) {
    const fromJob = productNameFromJobLabel(jobLabel);
    if (fromJob && !/^new project$/i.test(fromJob)) return fromJob;
  }

  const fromSubject = hints.threadSubject ? cleanSubjectLine(hints.threadSubject) : null;
  if (fromSubject) return fromSubject;

  const summary = hints.summary?.trim() ?? "";
  if (summary) {
    const refLine = summary.match(
      /\b([A-Z]{2,}\d{2,})\s+([A-Za-z][\w\s'&.-]{3,48}?)(?:\s+sample\b|\.\s|,|\s+from\b)/i,
    );
    if (refLine?.[2]) {
      const name = refLine[2].trim();
      if (name.length >= 3) return name;
    }
    const product = summary.match(
      /\bfor (?:the )?([A-Za-z][\w\s'&.-]{3,48}?\s+(?:Boxer Shorts|Boxer Short|T-?Shirts?|Tees?|Hoodies?|Shorts))\b/i,
    );
    if (product?.[1]) return product[1].trim();
  }

  const brand = inferBrandClientName("", hints.threadSubject);
  if (brand) return brand;

  return null;
}

/** End-customer brand for create_project — never operator placeholders. */
export function inferClientNameForProject(hints: ThreadNameHints): string | null {
  const projectName =
    hints.projectName?.trim() ||
    inferProjectNameFromThread(hints) ||
    "";

  const payloadClient = String(
    hints.jobPayload?.client ?? hints.jobPayload?.client_name ?? "",
  ).trim();
  if (
    payloadClient &&
    !isWorkspaceOperatorClientName(payloadClient) &&
    !/^new client$/i.test(payloadClient)
  ) {
    return payloadClient;
  }

  const fromBrand =
    inferBrandClientName(projectName, hints.threadSubject) ??
    inferBrandClientName("", hints.threadSubject);
  if (fromBrand && !isWorkspaceOperatorClientName(fromBrand)) return fromBrand;

  if (projectName) {
    const fromProduct = inferBrandFromProductLine(projectName);
    if (fromProduct) return fromProduct;
  }

  return null;
}

export function isPlaceholderProjectName(name: string): boolean {
  return !name.trim() || /^new project$/i.test(name.trim());
}

export function isPlaceholderClientName(name: string): boolean {
  const n = name.trim();
  return !n || /^new client$/i.test(n) || isWorkspaceOperatorClientName(n);
}
