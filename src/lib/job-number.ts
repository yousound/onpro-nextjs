import { clientCodeByName } from "@/lib/reference/client-codes";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

const JOB_NUMBER_PATTERN = /^([A-Z0-9]{2,4})-(\d{2})-(\d{3})$/;

/** Parse a job number like "GG-26-001". */
export function parseJobNumber(
  jn: string,
): { clientCode: string; year: number; seq: number } | null {
  const m = jn.trim().match(JOB_NUMBER_PATTERN);
  if (!m) return null;
  return { clientCode: m[1], year: parseInt(m[2], 10), seq: parseInt(m[3], 10) };
}

/** Build a job number string. */
export function formatJobNumber(clientCode: string, year: number, seq: number): string {
  const code = clientCode.trim().toUpperCase();
  const yy = String(year % 100).padStart(2, "0");
  const ss = String(seq).padStart(3, "0");
  return `${code}-${yy}-${ss}`;
}

/**
 * Generate the next job number for a project.
 * Scans `existingJobs` (and any explicitly passed in across the app) for the highest seq.
 */
export function generateJobNumberForProject(
  project: Project,
  existingJobs: ProjectJob[],
  date: Date = new Date(),
): string {
  const code = (clientCodeByName(project.client.name) ?? "XX").toUpperCase();
  const year = date.getFullYear();
  const yy = year % 100;
  let maxSeq = 0;
  for (const j of existingJobs) {
    const jn = j.job_number?.trim();
    if (!jn) continue;
    const parts = parseJobNumber(jn);
    if (parts && parts.clientCode === code && parts.year === yy) {
      maxSeq = Math.max(maxSeq, parts.seq);
    }
  }
  return formatJobNumber(code, year, maxSeq + 1);
}
