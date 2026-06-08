/**
 * Browser-only persistence for mocked CRUD flows (no API).
 * Namespaced keys so they are easy to clear under Application → Local Storage.
 */
export const MOCK_LS = {
  /** Pending email invites on People (mock). */
  pendingInvites: "onpro.mock.v1.pendingInvites",
  /** Post-onboarding workspace welcome modal dismissed. */
  workspaceWelcomeDismissed: "onpro.mock.v1.workspaceWelcomeDismissed",
  /** Workspace contacts directory (clients, vendors, team). */
  contacts: "onpro.mock.v1.contacts",
  calendarEvents: "onpro.mock.v1.calendarEvents",
  documents: "onpro.mock.v1.documents",
  project: (id: number) => `onpro.mock.v1.project.${id}`,
  projectJobs: (id: number) => `onpro.mock.v1.projectJobs.${id}`,
  projectOrders: (id: number) => `onpro.mock.v1.projectOrders.${id}`,
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
  /** User-created message conversations (no demo seed). */
  messageConversations: "onpro.mock.v1.messageConversations",
  /** User-created thread messages (no demo seed). */
  messageThreads: "onpro.mock.v1.messageThreads",
  /** Soft-deleted thread message ids (demo + user messages). */
  messageDeletedIds: "onpro.mock.v1.messageDeletedIds",
  /** Bump when demo seed job ids / timelines change — ignores stale projectJobs in LS. */
  demoSeedVersion: "onpro.mock.v1.demoSeedVersion",
} as const;

/** Increment when regenerating demo projects/jobs so browsers drop stale WIP edits. */
export const MOCK_DEMO_SEED_VERSION = 4;

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

export function writeMockLs(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    const dom = e as DOMException | undefined;
    if (dom?.name === "QuotaExceededError" || dom?.code === 22) {
      console.warn(`[mock-ls] localStorage quota exceeded for key "${key}"`);
      return false;
    }
    throw e;
  }
}

export function clearMockLs(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
