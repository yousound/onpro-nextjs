import { isClientLiveBackend } from "@/lib/config/backend-mode";
import type { CreateProjectInput } from "@/lib/supabase/projects";
import type { Project } from "@/lib/types/project";

/** Persist a new project to Supabase in Live mode. */
export async function persistProjectToDb(input: CreateProjectInput): Promise<Project> {
  if (!isClientLiveBackend()) {
    throw new Error("Live backend required");
  }

  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as { error?: string; project?: Project };
  if (!res.ok) throw new Error(data.error ?? "Could not create project");
  if (!data.project) throw new Error("No project returned");
  return data.project;
}

/** Patch an existing project in Supabase in Live mode. */
export async function updateProjectInDb(id: number, patch: Partial<Project>): Promise<Project> {
  if (!isClientLiveBackend()) {
    throw new Error("Live backend required");
  }

  const res = await fetch("/api/projects", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, patch }),
  });
  const data = (await res.json()) as { error?: string; project?: Project };
  if (!res.ok) throw new Error(data.error ?? "Could not update project");
  if (!data.project) throw new Error("No project returned");
  return data.project;
}
