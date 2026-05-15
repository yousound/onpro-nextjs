import type { Project } from "@/lib/types/project";

const SESSION_KEY = "onpro-session-projects-v1";

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
  const ids = new Set(base.map((p) => p.id));
  return [...base, ...session.filter((p) => !ids.has(p.id))];
}
