import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { resolveClientProjectList } from "@/lib/mock/project-session";
import { loadProjectJobs } from "@/lib/project-wip-edits";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { readSessionProjects } from "@/lib/mock/project-session";

export type ClientJobOverlayRow = {
  id: string;
  project_id: number;
  project_name: string;
  name: string;
  job_number: string | null;
  style_number: string;
};

/** Jobs visible in the browser (live-cache + localStorage) — may be ahead of Supabase. */
export function buildClientJobsOverlay(): ClientJobOverlayRow[] {
  const projects = isClientLiveBackend()
    ? resolveClientProjectList(getLiveCachedProjects())
    : readSessionProjects();
  const rows: ClientJobOverlayRow[] = [];
  for (const p of projects) {
    for (const j of loadProjectJobs(p.id, p)) {
      rows.push({
        id: j.id,
        project_id: p.id,
        project_name: p.name,
        name: j.name,
        job_number: j.job_number ?? null,
        style_number: j.style_number ?? "",
      });
    }
  }
  return rows;
}

export function mergeClientJobsIntoPromptContext(
  promptContext: string,
  clientJobs: ClientJobOverlayRow[],
): string {
  if (clientJobs.length === 0) return promptContext;
  try {
    const parsed = JSON.parse(promptContext) as Record<string, unknown>;
    const serverJobs = Array.isArray(parsed.jobs) ? (parsed.jobs as ClientJobOverlayRow[]) : [];
    const byKey = new Map<string, ClientJobOverlayRow>();
    for (const j of serverJobs) {
      byKey.set(`${j.project_id}:${j.id}`, j);
    }
    for (const j of clientJobs) {
      byKey.set(`${j.project_id}:${j.id}`, j);
    }
    parsed.jobs = [...byKey.values()];
    parsed.clientJobsOverlay = {
      count: clientJobs.length,
      note:
        "Includes jobs saved in this browser session that may not be in Supabase yet. Prefer these rows when the user asks about jobs they just created.",
    };
    return JSON.stringify(parsed, null, 2);
  } catch {
    return promptContext;
  }
}
