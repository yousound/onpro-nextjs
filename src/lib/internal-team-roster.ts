import { MOCK_INTERNAL_TEAM_MEMBERS } from "@/lib/mock-internal-team";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";

function mergeDedupeSorted(parts: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const arr of parts) {
    for (const s of arr) {
      const k = s.trim();
      if (!k) continue;
      const low = k.toLowerCase();
      if (seen.has(low)) continue;
      seen.add(low);
      out.push(k);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function readLegacyGlobalInternalExtras(): string[] {
  const raw = readMockLs<string[]>(MOCK_LS.internalTeamMembersExtra);
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

export function readProjectInternalExtras(projectId: number): string[] {
  const raw = readMockLs<string[]>(MOCK_LS.internalTeamMembersExtraForProject(projectId));
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

/** Names shown in Internal tab assignee dropdowns for this project (seed + legacy global + per-project extras). */
export function mergedInternalTeamRoster(projectId: number): string[] {
  return mergeDedupeSorted([
    MOCK_INTERNAL_TEAM_MEMBERS,
    readLegacyGlobalInternalExtras(),
    readProjectInternalExtras(projectId),
  ]);
}

/** Returns false if empty, duplicate (case-insensitive), or already in seed/global/project roster. */
export function addInternalTeamMemberToProject(projectId: number, rawName: string): boolean {
  const t = rawName.trim();
  if (!t) return false;
  const existing = new Set(mergedInternalTeamRoster(projectId).map((x) => x.toLowerCase()));
  if (existing.has(t.toLowerCase())) return false;
  const prev = readProjectInternalExtras(projectId);
  writeMockLs(MOCK_LS.internalTeamMembersExtraForProject(projectId), [...prev, t]);
  return true;
}
