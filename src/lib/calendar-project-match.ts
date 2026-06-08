import type { CalendarEvent } from "@/lib/types/calendar";
import type { Project } from "@/lib/types/project";

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Best-effort link from calendar PO / client / title to a workspace project. */
export function findLinkedProject(
  event: CalendarEvent,
  projects: Project[],
): { project: Project; reason: string } | null {
  if (projects.length === 0) return null;

  const po = norm(event.po);
  if (po) {
    const byPo = projects.find(
      (p) =>
        norm(p.po_number) === po ||
        norm(p.project_number) === po ||
        norm(p.po_number).includes(po) ||
        po.includes(norm(p.po_number)),
    );
    if (byPo) return { project: byPo, reason: `Matched PO ${event.po}` };
  }

  const clientHint = norm(event.link_to_client) || norm(event.received_by?.company_name);
  if (clientHint) {
    const byClient = projects.find(
      (p) =>
        norm(p.client.name) === clientHint ||
        norm(p.client.name).includes(clientHint) ||
        clientHint.includes(norm(p.client.name)),
    );
    if (byClient) return { project: byClient, reason: `Matched client ${event.link_to_client ?? event.received_by?.company_name}` };
  }

  const title = norm(event.name);
  if (title) {
    const byName = projects.find(
      (p) =>
        norm(p.name) === title ||
        title.includes(norm(p.name)) ||
        norm(p.name).includes(title),
    );
    if (byName) return { project: byName, reason: `Matched title to project “${byName.name}”` };
  }

  return null;
}
