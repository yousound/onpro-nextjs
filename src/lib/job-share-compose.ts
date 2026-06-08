import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

export const JOB_SHARE_COMPOSE_SESSION_KEY = "onpro.job-share-compose.v1";

export type JobShareComposeSession = {
  contactId: string;
  body: string;
};

export function jobShareMessageBody(params: {
  project: Project;
  job: ProjectJob;
  link: string;
}): string {
  const label = params.job.job_number?.trim() || params.job.name.trim() || "Job";
  return [
    `Sharing job details for ${params.project.name}:`,
    `${label}${params.job.name && params.job.job_number ? ` (${params.job.name})` : ""}`,
    "",
    params.link,
  ].join("\n");
}

export function stashJobShareCompose(session: JobShareComposeSession): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(JOB_SHARE_COMPOSE_SESSION_KEY, JSON.stringify(session));
}

export function readJobShareCompose(): JobShareComposeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(JOB_SHARE_COMPOSE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JobShareComposeSession;
    if (!parsed?.contactId || !parsed.body) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearJobShareCompose(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(JOB_SHARE_COMPOSE_SESSION_KEY);
}

export function messagesComposeHref(): string {
  return "/messages?compose=job";
}
