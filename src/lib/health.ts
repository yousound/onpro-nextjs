import type { Project } from "@/lib/types/project";

export type HealthBand = "on_track" | "at_risk" | "delayed";

const MS_DAY = 86400000;

function parseDue(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Rules use only `Project` fields: status + due_date + milestone fill ratio. */
export function projectHealth(project: Project): HealthBand {
  const now = Date.now();
  const due = parseDue(project.due_date);
  const terminal =
    project.status === "DELIVERED" || project.status === "COMPLETED";

  if (terminal) return "on_track";

  if (due != null && due < now) {
    return "delayed";
  }

  if (due != null) {
    const days = (due - now) / MS_DAY;
    if (days <= 14 && (project.status === "PENDING" || project.status === "IN-PROGRESS")) {
      return "at_risk";
    }
  }

  if (project.status === "PENDING" && due != null) {
    const days = (due - now) / MS_DAY;
    if (days <= 30) return "at_risk";
  }

  return "on_track";
}

export function healthLabel(band: HealthBand): string {
  switch (band) {
    case "on_track":
      return "On track";
    case "at_risk":
      return "At risk";
    case "delayed":
      return "Delayed";
  }
}

export interface ProjectKpis {
  total: number;
  byStatus: Record<string, number>;
  onTrack: number;
  atRisk: number;
  delayed: number;
}

export function computeProjectKpis(projects: Project[]): ProjectKpis {
  const byStatus: Record<string, number> = {};
  let onTrack = 0;
  let atRisk = 0;
  let delayed = 0;

  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    const h = projectHealth(p);
    if (h === "on_track") onTrack += 1;
    else if (h === "at_risk") atRisk += 1;
    else delayed += 1;
  }

  return {
    total: projects.length,
    byStatus,
    onTrack,
    atRisk,
    delayed,
  };
}
