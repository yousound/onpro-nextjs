import type { WorkspaceMatch } from "@/lib/types/workspace";
import type { WorkspaceView } from "@/lib/workspace-context";

/** Drop false self-invites and pending rows when already joined on that operator. */
export function splitWorkspaceTeams(
  teams: WorkspaceMatch[],
  authUserId: string | null,
): { joined: WorkspaceMatch[]; pending: WorkspaceMatch[] } {
  const joinedRaw = teams.filter((t) => t.alreadyJoined);

  const joinedByOperator = new Map<string, WorkspaceMatch>();
  for (const t of joinedRaw) {
    const prev = joinedByOperator.get(t.operatorUserId);
    if (!prev || t.projectCount > prev.projectCount) {
      joinedByOperator.set(t.operatorUserId, t);
    }
  }
  const joined = [...joinedByOperator.values()].sort((a, b) =>
    a.workspaceName.localeCompare(b.workspaceName),
  );
  const joinedOperatorIds = new Set(joined.map((t) => t.operatorUserId));

  const pending = teams
    .filter((t) => !t.alreadyJoined)
    .filter((t) => !authUserId || t.operatorUserId !== authUserId)
    .filter((t) => !joinedOperatorIds.has(t.operatorUserId))
    .sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));

  return { joined, pending };
}

export function isActiveTeamWorkspace(active: WorkspaceView, team: WorkspaceMatch): boolean {
  return active.mode === "team" && active.operatorUserId === team.operatorUserId;
}
