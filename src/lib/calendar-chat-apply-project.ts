"use client";

import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { upsertLiveProject } from "@/lib/data/live-cache";
import { readSessionProjects } from "@/lib/mock/project-session";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import type { Project } from "@/lib/types/project";

/** Mock/live overlay patch for project fields from calendar assistant. */
export function patchProjectOverlay(project: Project, patch: Partial<Project>): Project {
  const merged = { ...project, ...patch };
  const prev = readMockLs<Partial<Project>>(MOCK_LS.project(project.id)) ?? {};
  writeMockLs(MOCK_LS.project(project.id), { ...prev, ...patch });

  const session = readSessionProjects();
  if (session.some((p) => p.id === project.id)) {
    const next = session.map((p) => (p.id === project.id ? { ...p, ...patch } : p));
    if (typeof window !== "undefined") {
      localStorage.setItem("onpro-session-projects-v1", JSON.stringify(next));
    }
  }

  if (isClientLiveBackend()) {
    upsertLiveProject(merged);
  }
  return merged;
}
