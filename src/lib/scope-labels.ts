import type { JobScopeKind } from "@/lib/types/wip";

export const JOB_SCOPE_LABELS: Record<JobScopeKind, string> = {
  original: "Original deliverable",
  addon: "Reorder",
};

export function jobScopeLabel(kind: JobScopeKind | undefined): string {
  return JOB_SCOPE_LABELS[kind ?? "original"];
}
