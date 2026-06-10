import { createClient } from "@/lib/supabase/server";
import { projectFromRow, projectPatchToDbRow } from "@/lib/supabase/mappers/project";
import type { ProjectRowDb } from "@/lib/supabase/types-db";
import type { Project, ProjectStatus } from "@/lib/types/project";
import type { SupabaseClient } from "@supabase/supabase-js";

const PROJECT_SELECT = `
  *,
  client:contacts!client_id (
    id,
    name,
    avatar_url
  )
`;

export type CreateProjectInput = {
  name: string;
  description: string | null;
  clientId: number;
  status: ProjectStatus;
  projectNumber: string | null;
  dueDate: string | null;
  leadTeamMember: string | null;
  leadVendor: string | null;
};

export async function fetchProjectsFromSupabase(workspaceOwnerId?: string): Promise<Project[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let ownerId = workspaceOwnerId;
  if (!ownerId && user) {
    const { resolveWorkspaceOwnerId } = await import("@/lib/server/resolve-workspace-context");
    ownerId = await resolveWorkspaceOwnerId(supabase, user.id);
  }

  let query = supabase.from("projects").select(PROJECT_SELECT);
  if (ownerId) {
    query = query.eq("user_id", ownerId);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    console.error("[supabase] fetchProjects", error.message);
    throw error;
  }

  return (data as ProjectRowDb[]).map(projectFromRow);
}

export async function fetchProjectByIdFromSupabase(id: number): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[supabase] fetchProjectById", error.message);
    throw error;
  }

  if (!data) return null;
  return projectFromRow(data as ProjectRowDb);
}

export async function deleteProjectFromSupabase(id: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    console.error("[supabase] deleteProject", error.message);
    throw error;
  }
}

export async function insertProjectForUser(
  supabase: SupabaseClient,
  userId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      client_id: input.clientId,
      name: input.name,
      description: input.description,
      project_number: input.projectNumber,
      due_date: input.dueDate,
      status: input.status,
      lead_team_member: input.leadTeamMember,
      lead_vendor: input.leadVendor,
      colorways: [],
      in_development: [],
    })
    .select(PROJECT_SELECT)
    .single();

  if (error) {
    console.error("[supabase] insertProject", error.message);
    throw error;
  }

  return projectFromRow(data as ProjectRowDb);
}

export async function updateProjectForUser(
  supabase: SupabaseClient,
  userId: string,
  projectId: number,
  patch: Partial<Project>,
): Promise<Project> {
  const updates = projectPatchToDbRow(patch);
  if (Object.keys(updates).length === 0) {
    const existing = await fetchProjectByIdFromSupabase(projectId);
    if (!existing) throw new Error("Project not found");
    return existing;
  }

  const { data, error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId)
    .eq("user_id", userId)
    .select(PROJECT_SELECT)
    .single();

  if (error) {
    console.error("[supabase] updateProject", error.message);
    throw error;
  }

  return projectFromRow(data as ProjectRowDb);
}
