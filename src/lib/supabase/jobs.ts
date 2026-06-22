import { ensureUuid, resolveDbOrderId, supabaseErrorMessage } from "@/lib/id-uuid";
import { projectJobFromRow } from "@/lib/supabase/mappers/job";
import type { ProjectJobRowDb } from "@/lib/supabase/types-db";
import type { ProjectJob } from "@/lib/types/wip";
import type { SupabaseClient } from "@supabase/supabase-js";

function projectJobToRow(job: ProjectJob, userId: string) {
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

  return {
    id: ensureUuid(id),
    user_id: userId,
    project_id,
    order_id: resolveDbOrderId(order_id),
    job_number: job_number ?? null,
    name: name.trim() || "Untitled job",
    subtitle: subtitle ?? "",
    job_type: job_type ?? "custom",
    status,
    due_date,
    updated_at: updated_at ?? new Date().toISOString(),
    wip: rest,
  };
}

export async function fetchJobsForProjectFromSupabase(projectId: number): Promise<ProjectJob[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_jobs")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return [];
    }
    console.error("[supabase] fetchJobsForProject", error.message);
    throw error;
  }

  return (data as ProjectJobRowDb[]).map(projectJobFromRow);
}

export async function upsertProjectJobForUser(
  supabase: SupabaseClient,
  job: ProjectJob,
  userId: string,
): Promise<ProjectJob> {
  const row = projectJobToRow(job, userId);
  const { data, error } = await supabase.from("project_jobs").upsert(row).select("*").single();
  if (error) throw error;
  return projectJobFromRow(data as ProjectJobRowDb);
}

/** Replace project jobs in Supabase — returns rows with stable UUID ids. */
export async function syncProjectJobsForUser(
  supabase: SupabaseClient,
  projectId: number,
  ownerUserId: string,
  jobs: ProjectJob[],
): Promise<ProjectJob[]> {
  const { data: orderRows, error: orderListError } = await supabase
    .from("project_orders")
    .select("id")
    .eq("project_id", projectId);

  if (orderListError) throw new Error(supabaseErrorMessage(orderListError));

  const validOrderIds = new Set((orderRows ?? []).map((row) => row.id as string));

  const saved: ProjectJob[] = [];
  const keptIds = new Set<string>();

  for (const job of jobs) {
    const row = projectJobToRow(job, ownerUserId);
    if (row.order_id && !validOrderIds.has(row.order_id)) {
      row.order_id = null;
    }
    const { data, error } = await supabase.from("project_jobs").upsert(row).select("*").single();
    if (error) throw new Error(supabaseErrorMessage(error));
    const mapped = projectJobFromRow(data as ProjectJobRowDb);
    saved.push(mapped);
    keptIds.add(mapped.id);
  }

  const { data: existing, error: listError } = await supabase
    .from("project_jobs")
    .select("id")
    .eq("project_id", projectId);

  if (listError) throw new Error(supabaseErrorMessage(listError));

  const removeIds = (existing ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keptIds.has(id));

  if (removeIds.length > 0) {
    const { error: deleteError } = await supabase.from("project_jobs").delete().in("id", removeIds);
    if (deleteError) throw new Error(supabaseErrorMessage(deleteError));
  }

  return saved;
}

/** @deprecated Use upsertProjectJobForUser with an explicit client. */
export async function upsertProjectJobToSupabase(
  job: ProjectJob,
  userId: string,
): Promise<ProjectJob> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  return upsertProjectJobForUser(supabase, job, userId);
}
