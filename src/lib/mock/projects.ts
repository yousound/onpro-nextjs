import type { Project } from "@/lib/types/project";
import { demoProjects } from "@/lib/mock/generated/demo-projects";

/** Demo projects from Connect Dots masterlist — regenerate with `npm run import-masterlist`. */
export const mockProjects: Project[] = demoProjects;

export function getProjects(): Project[] {
  return mockProjects;
}

export function getProjectById(id: number): Project | undefined {
  return mockProjects.find((p) => p.id === id);
}
