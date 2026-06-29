import { jobColorwayTotalQty } from "@/lib/mailroom/job-ingest";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { mergeProjectLists, readSessionProjects } from "@/lib/mock/project-session";
import { collectAllAppRecordNumbers } from "@/lib/po-context";
import { normalizePo } from "@/lib/po-duplicate";
import { projectPoNumber } from "@/lib/po-number";
import { jobSeqFromJobNumber } from "@/lib/job-number";
import { loadProjectJobs } from "@/lib/project-wip-edits";
import type { Project } from "@/lib/types/project";
import type { ProjectJob, VendorQuote } from "@/lib/types/wip";

/** Jerry model: DW260607-1A (project + job seq + vendor letter). */
const VENDOR_PO_PATTERN = /^(.+)-(\d+)([A-Z])$/;

export function formatVendorPo(
  projectNumber: string,
  jobSeq: number,
  vendorLetter: string,
): string {
  const base = projectNumber.trim().toUpperCase();
  const letter = vendorLetter.trim().toUpperCase().slice(0, 1) || "A";
  return `${base}-${jobSeq}${letter}`;
}

export function parseVendorPo(
  value: string,
): { projectNumber: string; jobSeq: number; vendorLetter: string } | null {
  const m = value.trim().toUpperCase().match(VENDOR_PO_PATTERN);
  if (!m) return null;
  const jobSeq = parseInt(m[2], 10);
  if (!Number.isFinite(jobSeq) || jobSeq < 1) return null;
  return { projectNumber: m[1]!, jobSeq, vendorLetter: m[3]! };
}

function allProjects(extra: Project[] = []): Project[] {
  if (isClientLiveBackend()) {
    return [...getLiveCachedProjects(), ...extra];
  }
  if (typeof window === "undefined") return extra;
  return mergeProjectLists([], [...readSessionProjects(), ...extra]);
}

function vendorPoFromQuotes(jobs: ProjectJob[]): string[] {
  const out: string[] = [];
  for (const j of jobs) {
    for (const q of j.vendor_quotes ?? []) {
      if (q.po_number?.trim()) out.push(q.po_number.trim());
    }
  }
  return out;
}

/** All vendor PO strings in the workspace (quotes + legacy record fields). */
export function collectAllVendorPoNumbers(extraProjects: Project[] = []): string[] {
  const projects = allProjects(extraProjects);
  const out = new Set<string>(
    collectAllAppRecordNumbers(extraProjects).map((v) => normalizePo(v)),
  );
  for (const p of projects) {
    const jobs = loadProjectJobs(p.id, p);
    for (const po of vendorPoFromQuotes(jobs)) {
      out.add(normalizePo(po));
    }
  }
  return [...out];
}

function maxVendorLetterForJob(
  projectNumber: string,
  jobSeq: number,
  existing: string[],
): number {
  const base = projectNumber.trim().toUpperCase();
  const prefix = `${base}-${jobSeq}`;
  let max = -1;
  for (const raw of existing) {
    const key = normalizePo(raw);
    if (!key.startsWith(prefix)) continue;
    const tail = key.slice(prefix.length);
    if (tail.length !== 1 || tail < "A" || tail > "Z") continue;
    const idx = tail.charCodeAt(0) - 65;
    if (idx > max) max = idx;
  }
  return max;
}

export function nextVendorPoLetter(
  projectNumber: string,
  jobSeq: number,
  existingPos: string[] = [],
): string {
  const idx = maxVendorLetterForJob(projectNumber, jobSeq, existingPos) + 1;
  if (idx > 25) throw new Error("Vendor PO letters exhausted (A–Z) for this job.");
  return String.fromCharCode(65 + idx);
}

export function generateVendorPo(
  projectNumber: string,
  jobSeq: number,
  existingPos: string[] = [],
): string {
  const letter = nextVendorPoLetter(projectNumber, jobSeq, existingPos);
  return formatVendorPo(projectNumber, jobSeq, letter);
}

export function vendorQuotesForSend(
  project: Project,
  job: ProjectJob,
  vendorNames: string[],
  existingPos: string[] = [],
): { quotes: VendorQuote[]; usedPos: string[] } {
  const projectNumber = projectPoNumber(project);
  if (!projectNumber) {
    throw new Error("Project must have a project number before sending vendor quotes.");
  }
  const jobSeq = jobSeqFromJobNumber(job, projectNumber);
  const pending = [...existingPos];
  const quotes: VendorQuote[] = [];
  const now = new Date().toISOString();

  for (const vendor of vendorNames) {
    const po = generateVendorPo(projectNumber, jobSeq, pending);
    pending.push(po);
    quotes.push({
      id: `vq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      vendor,
      item_description: job.name?.trim() || job.style_name?.trim() || "Quote request",
      unit_cost: 0,
      qty: jobColorwayTotalQty(job) || 1,
      po_number: po,
      status: "draft",
      job_seq: jobSeq,
      received_at: now,
      source: { kind: "manual" },
    });
  }
  return { quotes, usedPos: pending };
}

export function buildVendorQuoteRequests(
  project: Project,
  jobs: ProjectJob[],
  jobIds: string[],
  vendorNames: string[],
): Map<string, VendorQuote[]> {
  const projectNumber = projectPoNumber(project);
  if (!projectNumber) {
    throw new Error("Project must have a project number before sending vendor quotes.");
  }
  let pending = collectAllVendorPoNumbers([project]);
  const byJob = new Map<string, VendorQuote[]>();

  for (const jobId of jobIds) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) continue;
    const { quotes, usedPos } = vendorQuotesForSend(project, job, vendorNames, pending);
    pending = usedPos;
    byJob.set(jobId, quotes);
  }
  return byJob;
}
