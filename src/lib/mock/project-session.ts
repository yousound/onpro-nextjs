import {
  filterVisibleProjects,
  markProjectDeleted,
  readDeletedProjectIds,
} from "@/lib/deleted-projects";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { dedupeProjectsById } from "@/lib/dedupe-projects";
import type { Project } from "@/lib/types/project";
import { MOCK_LS, clearMockLs } from "@/lib/mock-local";

const SESSION_KEY = "onpro-session-projects-v1";

export { markProjectDeleted };

export function readSessionProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Project[];
  } catch {
    return [];
  }
}

export function appendSessionProject(project: Project): void {
  if (typeof window === "undefined") return;
  const cur = readSessionProjects();
  cur.push(project);
  localStorage.setItem(SESSION_KEY, JSON.stringify(cur));
}

export function mergeProjectLists(base: Project[], session: Project[]): Project[] {
  return dedupeProjectsById([...base, ...session]);
}

export function removeSessionProject(id: number): void {
  if (typeof window === "undefined") return;
  const next = readSessionProjects().filter((p) => p.id !== id);
  localStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

function clearProjectMockKeys(id: number): void {
  clearMockLs(MOCK_LS.project(id));
  clearMockLs(MOCK_LS.projectJobs(id));
  clearMockLs(MOCK_LS.projectTimeline(id));
  clearMockLs(MOCK_LS.projectRolePermissions(id));
  clearMockLs(MOCK_LS.projectPersonPermissions(id));
  clearMockLs(MOCK_LS.internalTeamMembersExtraForProject(id));
  clearMockLs(MOCK_LS.selectedJobId(id));
}

/** Mock mode: hide demo projects and drop session-created ones. */
export function deleteProjectLocally(id: number): void {
  removeSessionProject(id);
  markProjectDeleted(id);
  clearProjectMockKeys(id);
}

/** Client-side project list: merge session creates and hide deleted ids. */
export function buildClientProjectList(base: Project[]): Project[] {
  return filterVisibleProjects(mergeProjectLists(base, readSessionProjects()));
}

/** Client project list including session storage and live in-memory cache. */
export function resolveClientProjectList(base: Project[]): Project[] {
  let list = dedupeProjectsById(buildClientProjectList(base));
  if (typeof window !== "undefined" && isClientLiveBackend()) {
    list = dedupeProjectsById(
      filterVisibleProjects(mergeProjectLists(list, getLiveCachedProjects())),
    );
  }
  return list;
}
