import type { ProjectStatus } from "@/lib/types/project";

/** High-level project funnel — detailed steps live on job WIP. */
export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "Intake",
  "On Hold",
  "Development",
  "Production",
  "Completed",
];

const LEGACY_STATUS_MAP: Record<string, ProjectStatus> = {
  PENDING: "Intake",
  "IN DEVELOPMENT": "Development",
  "IN-PROGRESS": "Production",
  COMPLETED: "Completed",
  DELIVERED: "Completed",
  Intake: "Intake",
  "On Hold": "On Hold",
  Development: "Development",
  Production: "Production",
  Completed: "Completed",
};

export function migrateProjectStatus(value: string | null | undefined): ProjectStatus {
  const raw = (value ?? "").trim();
  if (!raw) return "Intake";
  return LEGACY_STATUS_MAP[raw] ?? LEGACY_STATUS_MAP[raw.toUpperCase()] ?? "Intake";
}

export function isActiveProjectStatus(status: ProjectStatus): boolean {
  return status === "Intake" || status === "Development" || status === "Production";
}

export function isAtRiskProjectStatus(status: ProjectStatus): boolean {
  return status === "On Hold";
}

export function projectStatusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-800";
    case "Production":
      return "bg-violet-100 text-violet-700";
    case "Development":
      return "bg-sky-100 text-sky-800";
    case "On Hold":
      return "bg-amber-100 text-amber-900";
    case "Intake":
    default:
      return "bg-slate-100 text-slate-700";
  }
}
