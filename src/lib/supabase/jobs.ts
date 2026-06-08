import { createClient } from "@/lib/supabase/server";
import { projectJobFromRow } from "@/lib/supabase/mappers/job";
import type { ProjectJobRowDb } from "@/lib/supabase/types-db";
import type { ProjectJob } from "@/lib/types/wip";

export async function fetchJobsForProjectFromSupabase(projectId: number): Promise<ProjectJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      // Table not migrated yet (Postgres or PostgREST schema cache)
      return [];
    }
    console.error("[supabase] fetchJobsForProject", error.message);
    throw error;
  }

  return (data as ProjectJobRowDb[]).map(projectJobFromRow);
}

export async function upsertProjectJobToSupabase(
  job: ProjectJob,
  userId: string,
): Promise<ProjectJob> {
  const supabase = await createClient();
  const {
    id,
    project_id,
    order_id,
    job_number,
    name,
    subtitle,
    job_type,
    status,
    due_date,
    updated_at,
    ...rest
  } = job;

  const row = {
    id,
    user_id: userId,
    project_id,
    order_id: order_id ?? null,
    job_number: job_number ?? null,
    name,
    subtitle: subtitle ?? "",
    job_type: job_type ?? "custom",
    status,
    due_date,
    updated_at: updated_at ?? new Date().toISOString(),
    wip: rest,
  };

  const { data, error } = await supabase
    .from("project_jobs")
    .upsert(row)
    .select("*")
    .single();

  if (error) throw error;
  return projectJobFromRow(data as ProjectJobRowDb);
}
