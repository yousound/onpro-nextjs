import type { PeopleSegment } from "@/lib/mock/people";

/** Mirrors iOS `ProjectPermissions` — concrete flags for one person/role on a project (mock). */
export type ProjectPermissionFlags = {
  acceptMessagesFromTeam: boolean;
  acceptMessagesFromVendors: boolean;
  acceptMessagesFromClients: boolean;
  canUploadMedia: boolean;
  canSendLinks: boolean;
  canCreateEditProjects: boolean;
  canApproveTasks: boolean;
  canSendQuotes: boolean;
  canSendEstimates: boolean;
  canSendInvoices: boolean;
  canReceiveInvoices: boolean;
  canViewCalendar: boolean;
  canCreateEditEvents: boolean;
  canGrantPermissions: boolean;
};

export type PermissionSummaryGroup = {
  title: string;
  lines: string[];
};

export function defaultPermissionsForSegment(segment: PeopleSegment): ProjectPermissionFlags {
  switch (segment) {
    case "client":
      return {
        acceptMessagesFromTeam: true,
        acceptMessagesFromVendors: false,
        acceptMessagesFromClients: false,
        canUploadMedia: true,
        canSendLinks: true,
        canCreateEditProjects: false,
        canApproveTasks: false,
        canSendQuotes: false,
        canSendEstimates: false,
        canSendInvoices: false,
        canReceiveInvoices: true,
        canViewCalendar: true,
        canCreateEditEvents: false,
        canGrantPermissions: false,
      };
    case "vendor":
      return {
        acceptMessagesFromTeam: true,
        acceptMessagesFromVendors: false,
        acceptMessagesFromClients: false,
        canUploadMedia: true,
        canSendLinks: true,
        canCreateEditProjects: false,
        canApproveTasks: false,
        canSendQuotes: true,
        canSendEstimates: true,
        canSendInvoices: true,
        canReceiveInvoices: true,
        canViewCalendar: true,
        canCreateEditEvents: true,
        canGrantPermissions: false,
      };
    case "team":
      return {
        acceptMessagesFromTeam: true,
        acceptMessagesFromVendors: true,
        acceptMessagesFromClients: true,
        canUploadMedia: true,
        canSendLinks: true,
        canCreateEditProjects: true,
        canApproveTasks: true,
        canSendQuotes: true,
        canSendEstimates: true,
        canSendInvoices: false,
        canReceiveInvoices: false,
        canViewCalendar: true,
        canCreateEditEvents: true,
        canGrantPermissions: false,
      };
  }
}

const LABELS: Partial<Record<keyof ProjectPermissionFlags, string>> = {
  acceptMessagesFromTeam: "Accept messages from team",
  acceptMessagesFromVendors: "Accept messages from vendors",
  acceptMessagesFromClients: "Accept messages from clients",
  canUploadMedia: "Can upload images & video",
  canSendLinks: "Can send links",
  canCreateEditProjects: "Can create & edit projects",
  canApproveTasks: "Can approve / deny / edit tasks",
  canSendQuotes: "Can send quotes",
  canSendEstimates: "Can send estimates",
  canSendInvoices: "Can send invoices",
  canReceiveInvoices: "Can receive invoices",
  canViewCalendar: "Can view calendar",
  canCreateEditEvents: "Can create / delete / edit events",
  canGrantPermissions: "Can grant permissions for team",
};

/** Which toggles appear for each workspace segment (aligned with iOS role templates). */
export function permissionKeyApplies(segment: PeopleSegment, key: keyof ProjectPermissionFlags): boolean {
  if (key === "canGrantPermissions") return segment === "team";
  if (key === "canCreateEditProjects" || key === "canApproveTasks") return segment === "team";
  if (key === "canSendQuotes" || key === "canSendEstimates") return segment === "team" || segment === "vendor";
  if (key === "canCreateEditEvents") return segment === "team" || segment === "vendor";
  return true;
}

/** Convert flags to grouped bullets for modals / summaries. */
export function permissionFlagsToSummary(flags: ProjectPermissionFlags): PermissionSummaryGroup[] {
  const groups: PermissionSummaryGroup[] = [];

  const push = (title: string, keys: (keyof ProjectPermissionFlags)[]) => {
    const lines = keys.filter((k) => flags[k]).map((k) => LABELS[k] ?? k);
    if (lines.length) groups.push({ title, lines });
  };

  push("General messages", ["acceptMessagesFromTeam", "acceptMessagesFromVendors", "acceptMessagesFromClients"]);
  push("Project", [
    "canUploadMedia",
    "canSendLinks",
    "canCreateEditProjects",
    "canApproveTasks",
    "canSendQuotes",
    "canSendEstimates",
  ]);
  push("Invoices", ["canSendInvoices", "canReceiveInvoices"]);
  push("Calendar", ["canViewCalendar", "canCreateEditEvents"]);
  if (flags.canGrantPermissions) {
    groups.push({ title: "Grant rights", lines: [LABELS.canGrantPermissions!] });
  }

  return groups;
}
