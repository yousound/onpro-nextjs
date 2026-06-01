/**
 * Browser-only persistence for mocked CRUD flows (no API).
 * Namespaced keys so they are easy to clear under Application → Local Storage.
 */
export const MOCK_LS = {
  /** Pending email invites on People (mock). */
  pendingInvites: "onpro.mock.v1.pendingInvites",
  /** Workspace contacts directory (clients, vendors, team). */
  contacts: "onpro.mock.v1.contacts",
  calendarEvents: "onpro.mock.v1.calendarEvents",
  documents: "onpro.mock.v1.documents",
  project: (id: number) => `onpro.mock.v1.project.${id}`,
  projectJobs: (id: number) => `onpro.mock.v1.projectJobs.${id}`,
  projectTimeline: (id: number) => `onpro.mock.v1.projectTimeline.${id}`,
  projectRolePermissions: (id: number) => `onpro.mock.v1.projectRolePermissions.${id}`,
  /** Per-person overrides on a project (key = contact id or `name:…`). */
  projectPersonPermissions: (id: number) => `onpro.mock.v1.projectPersonPermissions.${id}`,
  /** Legacy global extras — merged into every project's Internal roster until cleared. */
  internalTeamMembersExtra: "onpro.mock.v1.internalTeamMembersExtra",
  /** Per-project extras for Internal assignee menus (`mergeProjectLists` ids). */
  internalTeamMembersExtraForProject: (id: number) =>
    `onpro.mock.v1.project.${id}.internalTeamExtras`,
  selectedJobId: (projectId: number) => `onpro.mock.v1.project.${projectId}.selectedJobId`,
  /** Saved cost-sheet templates by category code. */
  costTemplates: "onpro.mock.v1.costTemplates",
  /** Vendor price book — recent prices per vendor. */
  vendorPrices: "onpro.mock.v1.vendorPrices",
  /** Mailroom agent state — OAuth + per-suggestion status. */
  mailroomState: "onpro.mock.v1.mailroomState",
  /** Bump when demo seed job ids / timelines change — ignores stale projectJobs in LS. */
  demoSeedVersion: "onpro.mock.v1.demoSeedVersion",
} as const;

/** Increment when regenerating demo projects/jobs so browsers drop stale WIP edits. */
export const MOCK_DEMO_SEED_VERSION = 3;

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
