import { colorwayRowTotal } from "@/lib/job-colorways";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import type { DocumentRow } from "@/lib/types/documents";
import type { ProjectJob } from "@/lib/types/wip";

function line(text: string): string {
  return text.trim();
}

function jobHeader(job: ProjectJob): string {
  const style = job.style_number?.trim();
  const name = job.name?.trim() || job.style_name?.trim() || "Style";
  return style ? `${style} ${name}` : name;
}

function bodyBlankLine(job: ProjectJob): string | null {
  const brand = job.garment_brand?.trim();
  const styleNo = job.garment_style_number?.trim();
  const subtitle = job.subtitle?.trim();
  if (brand && styleNo) return `Body: ${brand} ${styleNo}`;
  if (subtitle) return `Body: ${subtitle}`;
  if (job.category?.trim()) return `Body: ${job.category.trim()}`;
  return null;
}

function printSpecLines(job: ProjectJob): string[] {
  const lines: string[] = [];
  const desc = job.description?.trim();
  if (desc) lines.push(desc);
  const subtitle = job.subtitle?.trim();
  if (subtitle && subtitle !== desc) lines.push(subtitle);
  const mockNotes = job.estimate?.mock_up_notes?.trim();
  if (mockNotes) lines.push(mockNotes);
  const sizeBreakdown = job.size_breakdown?.trim();
  if (sizeBreakdown) lines.push(`Sizing: ${sizeBreakdown}`);
  return lines;
}

function quantityLines(job: ProjectJob): string[] {
  const rows = job.colorway_rows ?? [];
  if (rows.length > 0) {
    const out: string[] = ["Quantities:"];
    for (const row of rows) {
      const total = colorwayRowTotal(row);
      if (total <= 0 && !row.name?.trim()) continue;
      const label = [row.name?.trim(), row.color_code?.trim()].filter(Boolean).join(" ");
      out.push(`${label || "Color"} - ${total || 0} pcs`);
    }
    if (out.length > 1) return out;
  }
  if (job.colorway?.trim()) {
    return [`Quantities:`, `${job.colorway.trim()} - see attached`];
  }
  return [];
}

import { finishingTasksToLines } from "@/lib/brand-products/finishing";

function finishingLines(job: ProjectJob): string[] {
  const structured = finishingTasksToLines(job.finishing_tasks ?? []);
  if (structured.length > 0) {
    return ["Finishing:", ...structured.map((x) => `- ${x}`)];
  }
  const extras = (job.custom_fields ?? [])
    .map((f) => (f.key && f.value ? `${f.key}: ${f.value}` : f.value?.trim()))
    .filter(Boolean) as string[];
  if (extras.length > 0) {
    return ["Finishing:", ...extras.map((x) => `- ${x}`)];
  }
  return [];
}

/** Plain-text spec block for one job (vendor RFQ). */
export function buildVendorQuoteJobSpec(job: ProjectJob, quoteNotes?: string): string {
  const blocks: string[] = [jobHeader(job)];
  const body = bodyBlankLine(job);
  if (body) blocks.push(body);
  blocks.push(...printSpecLines(job));
  const qty = quantityLines(job);
  if (qty.length > 0) blocks.push(...qty);
  const finish = finishingLines(job);
  if (finish.length > 0) blocks.push(...finish);
  if (quoteNotes?.trim()) blocks.push(`Notes: ${quoteNotes.trim()}`);
  return blocks.filter(Boolean).join("\n");
}

export function buildVendorQuoteEmailBody(
  jobs: ProjectJob[],
  options?: {
    greeting?: string;
    intro?: string;
    quoteNotesByJobId?: Map<string, string>;
    document?: ProductionDocument;
  },
): string {
  const greeting = options?.greeting?.trim() || "Hi,";
  const intro =
    options?.intro?.trim() ||
    "Can you provide a quote for Production / Sample pricing:";
  const specs = jobs.map((job) =>
    buildVendorQuoteJobSpec(job, options?.quoteNotesByJobId?.get(job.id)),
  );

  const poLines =
    options?.document?.documentNumber?.trim() &&
    jobs.length === 1
      ? [`\nReference: ${options.document.documentNumber.trim()}`]
      : [];

  return [greeting, "", intro, "", ...specs.join("\n\n").split("\n"), ...poLines, "", "Thank you,", "Connect Dots"]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML body for vendor RFQ — spec in markup, mockups attach as files. */
export function buildVendorQuoteHtmlBody(
  jobs: ProjectJob[],
  options?: {
    greeting?: string;
    intro?: string;
    quoteNotesByJobId?: Map<string, string>;
  },
): string {
  const greeting = escapeHtml(options?.greeting?.trim() || "Hi,");
  const intro = escapeHtml(
    options?.intro?.trim() ||
      "Can you provide a quote for Production / Sample pricing:",
  );

  const sections = jobs
    .map((job) => {
      const spec = buildVendorQuoteJobSpec(job, options?.quoteNotesByJobId?.get(job.id));
      const html = spec
        .split("\n")
        .map((l) => `<p style="margin:0 0 6px">${escapeHtml(l)}</p>`)
        .join("");
      return `<div style="margin:16px 0">${html}</div>`;
    })
    .join("");

  return `<div style="font-family:sans-serif;font-size:14px;line-height:1.45;color:#111">
<p>${greeting}</p>
<p>&nbsp;</p>
<p>${intro}</p>
${sections}
<p>&nbsp;</p>
<p>Thank you,<br/>Connect Dots</p>
</div>`;
}

export function defaultVendorQuoteSubject(
  jobs: ProjectJob[],
  document?: ProductionDocument,
): string {
  if (document?.documentNumber?.trim() && jobs.length === 1) {
    return `Quote request ${document.documentNumber.trim()} from Connect Dots`;
  }
  if (jobs.length === 1) {
    const style = jobs[0]!.style_number?.trim();
    const name = jobs[0]!.name?.trim();
    if (style && name) return `Quote request — ${style} ${name}`;
    if (name) return `Quote request — ${name}`;
  }
  return `Quote request — ${jobs.length} styles from Connect Dots`;
}

/** Document library rows attachable to a vendor quote (images, tech packs, other). */
export function isAttachableQuoteDocument(doc: DocumentRow): boolean {
  return doc.kind === "image" || doc.kind === "tech_pack" || doc.kind === "other";
}

export function filterJobDocuments(docs: DocumentRow[], projectId: number, jobId: string): DocumentRow[] {
  return docs.filter(
    (d) =>
      d.project_id === projectId &&
      d.job_id === jobId &&
      isAttachableQuoteDocument(d),
  );
}

export function filterJobsDocuments(
  docs: DocumentRow[],
  projectId: number,
  jobIds: string[],
): DocumentRow[] {
  const idSet = new Set(jobIds);
  return docs.filter(
    (d) =>
      d.project_id === projectId &&
      d.job_id != null &&
      idSet.has(d.job_id) &&
      isAttachableQuoteDocument(d),
  );
}
