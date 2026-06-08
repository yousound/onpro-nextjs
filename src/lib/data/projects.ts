import { cookies } from "next/headers";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import {
  filterVisibleProjects,
  readDeletedProjectIdsFromCookieHeader,
} from "@/lib/deleted-projects";
import { getProjectById, mockProjects } from "@/lib/mock/projects";
import { mergeProjectLists, readSessionProjects } from "@/lib/mock/project-session";
import {
  fetchProjectByIdFromSupabase,
  fetchProjectsFromSupabase,
} from "@/lib/supabase/projects";
import type { Project } from "@/lib/types/project";

function mockProjectsMerged(): Project[] {
  return mergeProjectLists(mockProjects, readSessionProjects());
}

async function filterServerProjects(projects: Project[]): Promise<Project[]> {
  const jar = await cookies();
  const deleted = readDeletedProjectIdsFromCookieHeader(jar.toString());
  return filterVisibleProjects(projects, deleted);
}

/** Server-side project list: Supabase in Live mode, demo + session in Mock mode. */
export async function fetchProjects(): Promise<Project[]> {
  if (!(await isLiveBackendEnabled())) {
    return filterServerProjects(mockProjectsMerged());
  }
  return filterServerProjects(await fetchProjectsFromSupabase());
}

export async function fetchProjectById(id: number): Promise<Project | undefined> {
  if (!(await isLiveBackendEnabled())) {
    const session = readSessionProjects().find((p) => p.id === id);
    if (session) return session;
    const demo = getProjectById(id);
    if (!demo) return undefined;
    const visible = await filterServerProjects([demo]);
    return visible[0];
  }
  return (await fetchProjectByIdFromSupabase(id)) ?? undefined;
}
