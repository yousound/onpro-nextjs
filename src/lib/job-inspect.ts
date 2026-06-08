/** Deep-link to open a job in Projects or Production. */

export function parseInspectJob(raw: string | null): { projectId: number; jobId: string } | null {
  if (!raw) return null;
  const [pid, jid] = raw.split(":");
  const projectId = Number(pid);
  if (!Number.isFinite(projectId) || !jid) return null;
  return { projectId, jobId: decodeURIComponent(jid) };
}

export function formatInspectJobParam(projectId: number, jobId: string): string {
  return `${projectId}:${encodeURIComponent(jobId)}`;
}

export function buildJobSharePath(
  projectId: number,
  jobId: string,
  context: "project" | "production",
): string {
  const param = formatInspectJobParam(projectId, jobId);
  if (context === "production") {
    return `/production?inspectJob=${param}`;
  }
  return `/projects/${projectId}?inspectJob=${param}`;
}

export function buildJobShareUrl(
  origin: string,
  projectId: number,
  jobId: string,
  context: "project" | "production",
): string {
  return `${origin.replace(/\/$/, "")}${buildJobSharePath(projectId, jobId, context)}`;
}
