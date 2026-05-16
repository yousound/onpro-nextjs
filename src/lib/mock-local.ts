/**
 * Browser-only persistence for mocked CRUD flows (no API).
 * Namespaced keys so they are easy to clear under Application → Local Storage.
 */
export const MOCK_LS = {
  /** Pending email invites on People (mock). */
  pendingInvites: "onpro.mock.v1.pendingInvites",
  calendarEvents: "onpro.mock.v1.calendarEvents",
  documents: "onpro.mock.v1.documents",
  project: (id: number) => `onpro.mock.v1.project.${id}`,
  projectJobs: (id: number) => `onpro.mock.v1.projectJobs.${id}`,
  projectTimeline: (id: number) => `onpro.mock.v1.projectTimeline.${id}`,
  projectRolePermissions: (id: number) => `onpro.mock.v1.projectRolePermissions.${id}`,
  /** Legacy global extras — merged into every project's Internal roster until cleared. */
  internalTeamMembersExtra: "onpro.mock.v1.internalTeamMembersExtra",
  /** Per-project extras for Internal assignee menus (`mergeProjectLists` ids). */
  internalTeamMembersExtraForProject: (id: number) =>
    `onpro.mock.v1.project.${id}.internalTeamExtras`,
} as const;

export function readMockLs<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === "") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeMockLs(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function clearMockLs(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
