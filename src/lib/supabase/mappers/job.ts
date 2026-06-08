import type { ProjectJob } from "@/lib/types/wip";
import type { ProjectJobRowDb } from "@/lib/supabase/types-db";

export function projectJobFromRow(row: ProjectJobRowDb): ProjectJob {
  const wip = (row.wip ?? {}) as Partial<ProjectJob>;
  return {
    ...wip,
    id: row.id,
    project_id: row.project_id,
    order_id: row.order_id ?? wip.order_id,
    job_number: row.job_number ?? wip.job_number,
    name: row.name,
    subtitle: row.subtitle ?? wip.subtitle ?? "",
    type: String(wip.type ?? row.job_type ?? "custom"),
    job_type: wip.job_type ?? (row.job_type as ProjectJob["job_type"]) ?? "custom",
    lead_vendor: String(wip.lead_vendor ?? ""),
    category: String(wip.category ?? ""),
    style_number: String(wip.style_number ?? ""),
    status: (row.status as ProjectJob["status"]) ?? wip.status ?? "In progress",
    due_date: row.due_date ?? wip.due_date ?? null,
    updated_at: row.updated_at,
    timeline: Array.isArray(wip.timeline) ? wip.timeline : [],
  };
}
