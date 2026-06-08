import { clientContacts, loadContacts } from "@/lib/contacts-store";
import { sanitizeClientEmail } from "@/lib/client-email";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

export function clientEmailForProject(project: Project): string | undefined {
  const contacts = clientContacts(loadContacts());
  const idKey = String(project.client.id);
  const candidates = [
    contacts.find((c) => String(c.id) === idKey),
    contacts.find(
      (c) => c.name.trim().toLowerCase() === project.client.name.trim().toLowerCase(),
    ),
    contacts.find(
      (c) =>
        c.name.trim().toLowerCase().includes(project.client.name.trim().toLowerCase()) ||
        project.client.name.trim().toLowerCase().includes(c.name.trim().toLowerCase()),
    ),
  ];
  for (const c of candidates) {
    const email = sanitizeClientEmail(c?.email);
    if (email) return email;
  }
  return undefined;
}

export function jobShareEmailDraft(params: {
  project: Project;
  job: ProjectJob;
  link: string;
}): { to: string; subject: string; body: string } | null {
  const to = clientEmailForProject(params.project);
  if (!to) return null;
  const label = params.job.job_number?.trim() || params.job.name.trim() || "Job";
  const subject = `${label} — ${params.project.name}`;
  const body = [
    `Hi,`,
    ``,
    `Sharing job details for ${params.project.name}:`,
    `${label}${params.job.name && params.job.job_number ? ` (${params.job.name})` : ""}`,
    ``,
    params.link,
    ``,
    `— Sent from OnPro`,
  ].join("\n");
  return { to, subject, body };
}
