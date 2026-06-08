import { clientContacts, contactDisplayName, loadContacts } from "@/lib/contacts-store";
import { resolveClientProjectList } from "@/lib/mock/project-session";
import { loadProjectJobs } from "@/lib/project-wip-edits";
import type { Contact } from "@/lib/types/contact";
import type { AgentSuggestion } from "@/lib/types/agent";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

export type SuggestionResolveContext = {
  threadRelated?: { project_id?: number; job_id?: string; vendor?: string };
  projects?: Project[];
  workflowStepContext?: { project_id?: number; job_id?: string; job_ids?: string[] };
  threadSubject?: string;
};

function asNumber(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  return undefined;
}

export function listResolvableProjects(extra: Project[] = []): Project[] {
  return resolveClientProjectList(extra);
}

export function findClientByPayload(
  contacts: Contact[],
  payload: Record<string, unknown>,
): Contact | undefined {
  const clients = clientContacts(contacts);
  if (clients.length === 0) return undefined;
  const raw = String(payload.client ?? payload.client_name ?? payload.company ?? "").trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  return (
    clients.find(
      (c) =>
        contactDisplayName(c).toLowerCase() === lower ||
        c.name.toLowerCase() === lower ||
        c.company_code.toLowerCase() === lower,
    ) ??
    clients.find((c) => contactDisplayName(c).toLowerCase().includes(lower)) ??
    undefined
  );
}

export function resolveProjectForSuggestion(
  suggestion: AgentSuggestion,
  ctx: SuggestionResolveContext,
): Project | null {
  const projects = ctx.projects ?? listResolvableProjects();
  if (projects.length === 0) return null;

  const payload = suggestion.payload ?? {};
  const wf = ctx.workflowStepContext;
  const id =
    wf?.project_id ??
    ctx.threadRelated?.project_id ??
    asNumber(payload.project_id) ??
    asNumber(payload.projectId);

  if (id != null) {
    return projects.find((p) => p.id === id) ?? null;
  }

  const client = findClientByPayload(loadContacts(), payload);
  if (client) {
    const match = projects.find((p) => p.client.id === Number(client.id));
    if (match) return match;
  }

  const nameHint = String(payload.name ?? payload.project_name ?? "").trim().toLowerCase();
  if (nameHint) {
    const byName = projects.find((p) => p.name.toLowerCase().includes(nameHint));
    if (byName) return byName;
  }

  return null;
}

export function findJobOnProject(
  project: Project,
  opts: { jobId?: string; hint?: string },
): ProjectJob | null {
  const jobs = loadProjectJobs(project.id, project);
  if (jobs.length === 0) return null;

  if (opts.jobId) {
    const direct = jobs.find((j) => j.id === opts.jobId);
    if (direct) return direct;
  }

  const hint = opts.hint?.trim().toLowerCase();
  if (hint) {
    const match = jobs.find(
      (j) =>
        j.job_number?.toLowerCase().includes(hint) ||
        j.name?.toLowerCase().includes(hint) ||
        j.style_number?.toLowerCase().includes(hint) ||
        j.subtitle?.toLowerCase().includes(hint),
    );
    if (match) return match;
  }

  return jobs[0] ?? null;
}

export function resolveJobForSuggestion(
  suggestion: AgentSuggestion,
  ctx: SuggestionResolveContext,
  project: Project | null,
): ProjectJob | null {
  if (!project) return null;
  const payload = suggestion.payload ?? {};
  const wf = ctx.workflowStepContext;
  const jobId =
    wf?.job_id ??
    ctx.threadRelated?.job_id ??
    String(payload.job_id ?? payload.jobId ?? "");
  const hint = String(
    payload.job_hint ?? payload.job_number ?? payload.style_number ?? payload.name ?? "",
  ).trim();
  return findJobOnProject(project, { jobId: jobId || undefined, hint: hint || undefined });
}
