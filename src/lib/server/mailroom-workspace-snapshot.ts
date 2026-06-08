import { contactDisplayName, clientContacts } from "@/lib/contacts-store";
import { fetchContacts } from "@/lib/data/contacts";
import { fetchProjects } from "@/lib/data/projects";

export type MailroomWorkspaceSnapshot = {
  clients: Array<{ id: string; name: string; email: string; company_code: string }>;
  projects: Array<{
    id: number;
    name: string;
    project_number: string | null;
    client: string;
    due_date: string | null;
  }>;
};

export async function buildMailroomWorkspaceSnapshot(): Promise<MailroomWorkspaceSnapshot> {
  const contacts = await fetchContacts();
  const projects = await fetchProjects();

  return {
    clients: clientContacts(contacts).map((c) => ({
      id: c.id,
      name: contactDisplayName(c),
      email: c.email,
      company_code: c.company_code,
    })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      project_number: p.project_number ?? p.po_number ?? null,
      client: p.client.name,
      due_date: p.due_date,
    })),
  };
}

export function workspaceSnapshotForPrompt(snapshot: MailroomWorkspaceSnapshot): string {
  const clients =
    snapshot.clients.length > 0
      ? snapshot.clients
          .slice(0, 40)
          .map((c) => `- ${c.name} (${c.email}) [id=${c.id}]`)
          .join("\n")
      : "(no client contacts)";
  const projects =
    snapshot.projects.length > 0
      ? snapshot.projects
          .slice(0, 40)
          .map(
            (p) =>
              `- #${p.id} “${p.name}” client=${p.client} number=${p.project_number ?? "—"} due=${p.due_date ?? "—"}`,
          )
          .join("\n")
      : "(no projects)";

  return `Workspace clients:\n${clients}\n\nWorkspace projects:\n${projects}`;
}
