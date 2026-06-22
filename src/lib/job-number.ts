import { parsePoNumber, projectPoNumber } from "@/lib/po-number";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

const JOB_SUFFIX_PATTERN = /^(.+)-(\d{2})$/;
const JOB_NUMBER_LEGACY = /^([A-Z0-9]{2,4})-(\d{2})-(\d{1,})$/;

/** Parse legacy compact (GG260601) or dashed (GG-26-001) job numbers for display only. */
export function parseJobNumber(
  jn: string,
): { clientCode: string; year: number; month: number; seq: number } | null {
  const compact = parsePoNumber(jn);
  if (compact) return compact;

  const m = jn.trim().toUpperCase().match(JOB_NUMBER_LEGACY);
  if (!m) return null;
  const seq = parseInt(m[3], 10);
  if (!Number.isFinite(seq) || seq < 1) return null;
  return {
    clientCode: m[1],
    year: 2000 + parseInt(m[2], 10),
    month: 0,
    seq,
  };
}

/** Per-project job number: DW260607-01, DW260607-02, … */
export function formatJobNumber(projectNumber: string, seq: number): string {
  const base = projectNumber.trim().toUpperCase();
  if (!base) return String(seq).padStart(2, "0");
  return `${base}-${String(seq).padStart(2, "0")}`;
}

function parseJobSuffix(jn: string, projectNumber?: string): number | null {
  const trimmed = jn.trim().toUpperCase();
  const base = projectNumber?.trim().toUpperCase();
  if (base && trimmed.startsWith(`${base}-`)) {
    const suffix = parseInt(trimmed.slice(base.length + 1), 10);
    if (Number.isFinite(suffix) && suffix >= 1) return suffix;
  }
  const m = trimmed.match(JOB_SUFFIX_PATTERN);
  if (!m) return null;
  const suffix = parseInt(m[2], 10);
  return Number.isFinite(suffix) && suffix >= 1 ? suffix : null;
}

/** Next job sequence within a project (1-based). */
export function nextJobSeqForProject(projectNumber: string, jobs: ProjectJob[]): number {
  let max = 0;
  for (const j of jobs) {
    const jn = j.job_number?.trim();
    if (!jn) continue;
    const suffix = parseJobSuffix(jn, projectNumber);
    if (suffix != null && suffix > max) max = suffix;
  }
  return max + 1;
}

/**
 * Next job number for a project — suffix under the project number (DW260607-01).
 */
export function generateJobNumberForProject(
  project: Project,
  existingJobs: ProjectJob[],
): string {
  const projectNumber = projectPoNumber(project);
  if (!projectNumber) {
    const seq = nextJobSeqForProject("", existingJobs);
    return String(seq).padStart(2, "0");
  }
  const seq = nextJobSeqForProject(projectNumber, existingJobs);
  return formatJobNumber(projectNumber, seq);
}

/** Job sequence suffix used for vendor PO numbering (DW260607-02-01 → job seq 2). */
export function jobSeqFromJobNumber(
  job: Pick<ProjectJob, "job_number">,
  projectNumber?: string | null,
): number {
  const jn = job.job_number?.trim();
  if (!jn) return 1;
  return parseJobSuffix(jn, projectNumber ?? undefined) ?? 1;
}
