import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { collectAllPoNumbers, generatePoNumber } from "@/lib/po-number";
import { mergeProjectLists, readSessionProjects } from "@/lib/mock/project-session";
import { loadProjectJobs } from "@/lib/project-wip-edits";
import { resolveClientCode } from "@/lib/reference/client-codes";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

function allProjects(extra: Project[] = []): Project[] {
  if (isClientLiveBackend()) {
    return [...getLiveCachedProjects(), ...extra];
  }
  if (typeof window === "undefined") return extra;
  return mergeProjectLists([], [...readSessionProjects(), ...extra]);
}

/** Collect all PO strings from projects and persisted jobs (for sequence deduping). */
export function collectAllAppPoNumbers(extraProjects: Project[] = []): string[] {
  const projects = allProjects(extraProjects);
  const jobPos: string[] = [];
  for (const p of projects) {
    const jobs = loadProjectJobs(p.id, p);
    for (const j of jobs) {
      if (j.po_number) jobPos.push(j.po_number);
    }
  }
  return collectAllPoNumbers(projects, jobPos);
}

export function generatePoForProject(project: Project, extraProjects: Project[] = []): string {
  const clientCode = resolveClientCode(project.client.name);
  return generatePoNumber(clientCode, collectAllAppPoNumbers(extraProjects));
}

/**
 * Generate the next PO for a job, honoring an explicit client_po_number if set on the job.
 * Pass the in-progress job to skip auto-PO when the client supplied one.
 */
export function generatePoForJob(
  project: Project,
  job?: Pick<ProjectJob, "client_po_number"> | null,
  extraProjects: Project[] = [],
): string {
  const clientPo = job?.client_po_number?.trim();
  if (clientPo) return clientPo;
  return generatePoForProject(project, extraProjects);
}

/**
 * Effective PO for downstream use: prefers client PO when supplied, otherwise the existing po_number.
 */
export function effectivePoNumber(
  job: Pick<ProjectJob, "client_po_number" | "po_number">,
): string | null {
  const clientPo = job.client_po_number?.trim();
  if (clientPo) return clientPo;
  const ours = job.po_number?.trim();
  return ours || null;
}
