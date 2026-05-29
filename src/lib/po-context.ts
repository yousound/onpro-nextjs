import { collectAllPoNumbers, generatePoNumber } from "@/lib/po-number";
import { getProjects } from "@/lib/mock/projects";
import { mergeProjectLists, readSessionProjects } from "@/lib/mock/project-session";
import { loadProjectJobs } from "@/lib/project-wip-edits";
import { clientCodeByName } from "@/lib/reference/client-codes";
import type { Project } from "@/lib/types/project";

function allProjects(extra: Project[] = []): Project[] {
  const base = getProjects();
  if (typeof window === "undefined") return mergeProjectLists(base, extra);
  return mergeProjectLists(base, [...readSessionProjects(), ...extra]);
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
  const clientCode = clientCodeByName(project.client.name) ?? "XX";
  return generatePoNumber(clientCode, collectAllAppPoNumbers(extraProjects));
}

export function generatePoForJob(project: Project, extraProjects: Project[] = []): string {
  return generatePoForProject(project, extraProjects);
}
