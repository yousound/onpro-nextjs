import type { Project } from "@/lib/types/project";

/** Last occurrence wins when the same numeric id appears more than once. */
export function dedupeProjectsById(projects: Project[]): Project[] {
  const byId = new Map<number, Project>();
  for (const p of projects) byId.set(p.id, p);
  return [...byId.values()];
}
