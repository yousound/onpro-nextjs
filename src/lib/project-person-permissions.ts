import type { PeopleSegment } from "@/lib/mock/people";
import { effectiveContactPermissions } from "@/lib/contact-permissions";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import type { ProjectPersonRow } from "@/lib/project-people";
import {
  defaultPermissionsForSegment,
  flagsFromPermissionSummary,
  shortPermissionSummary,
  type ProjectPermissionFlags,
} from "@/lib/project-permissions";
import type { Contact } from "@/lib/types/contact";

export function mergeRoleDrafts(
  raw: Partial<Record<PeopleSegment, Partial<ProjectPermissionFlags>>> | null,
): Record<PeopleSegment, ProjectPermissionFlags> {
  const base = {
    team: defaultPermissionsForSegment("team"),
    vendor: defaultPermissionsForSegment("vendor"),
    client: defaultPermissionsForSegment("client"),
  };
  if (!raw) return base;
  return {
    team: { ...base.team, ...raw.team },
    vendor: { ...base.vendor, ...raw.vendor },
    client: { ...base.client, ...raw.client },
  };
}

export function loadProjectRoleDefaults(projectId: number): Record<PeopleSegment, ProjectPermissionFlags> {
  const raw = readMockLs<Partial<Record<PeopleSegment, Partial<ProjectPermissionFlags>>>>(
    MOCK_LS.projectRolePermissions(projectId),
  );
  return mergeRoleDrafts(raw);
}

export type PersonProjectPermissionStore = Record<string, ProjectPermissionFlags>;

export function loadPersonPermissionOverrides(projectId: number): PersonProjectPermissionStore {
  return readMockLs<PersonProjectPermissionStore>(MOCK_LS.projectPersonPermissions(projectId)) ?? {};
}

export function savePersonPermissionOverride(
  projectId: number,
  personKey: string,
  flags: ProjectPermissionFlags,
): void {
  const prev = loadPersonPermissionOverrides(projectId);
  writeMockLs(MOCK_LS.projectPersonPermissions(projectId), { ...prev, [personKey]: flags });
}

export function clearPersonPermissionOverride(projectId: number, personKey: string): void {
  const prev = loadPersonPermissionOverrides(projectId);
  if (!(personKey in prev)) return;
  const next = { ...prev };
  delete next[personKey];
  writeMockLs(MOCK_LS.projectPersonPermissions(projectId), next);
}

export function hasPersonPermissionOverride(projectId: number, personKey: string): boolean {
  return personKey in loadPersonPermissionOverrides(projectId);
}

export type PersonProjectFlagsSource = "saved" | "mock" | "contact" | "role_default";

export function resolvePersonProjectFlags(
  projectId: number,
  person: ProjectPersonRow,
  contacts: Contact[],
  roleDefaults: Record<PeopleSegment, ProjectPermissionFlags>,
): { flags: ProjectPermissionFlags; source: PersonProjectFlagsSource } {
  const saved = loadPersonPermissionOverrides(projectId)[person.key];
  if (saved) return { flags: saved, source: "saved" };

  if (person.permissionGroups.length) {
    return {
      flags: flagsFromPermissionSummary(person.permissionGroups, person.segment),
      source: "mock",
    };
  }

  if (person.contactId) {
    const contact = contacts.find((c) => c.id === person.contactId);
    if (contact) {
      return { flags: effectiveContactPermissions(contacts, contact).flags, source: "contact" };
    }
  }

  return { flags: roleDefaults[person.segment], source: "role_default" };
}

export function personListPermissionSummary(
  projectId: number,
  person: ProjectPersonRow,
  contacts: Contact[],
  roleDefaults: Record<PeopleSegment, ProjectPermissionFlags>,
): { text: string; hasOverride: boolean } {
  const hasOverride = hasPersonPermissionOverride(projectId, person.key);
  const { flags, source } = resolvePersonProjectFlags(projectId, person, contacts, roleDefaults);
  if (hasOverride) {
    return { text: shortPermissionSummary(flags), hasOverride: true };
  }
  if (source === "role_default") {
    return { text: "Uses project role defaults", hasOverride: false };
  }
  return { text: shortPermissionSummary(flags), hasOverride: false };
}
