import type { Project } from "@/lib/types/project";
import type { Contact, PeopleSegment } from "@/lib/types/contact";
import {
  contactDisplayName,
  loadContacts,
  vendorDisplayName,
} from "@/lib/contacts-store";
import {
  MOCK_PERSON_PROJECT_ACCESS,
  type PersonProjectAccess,
  type PersonProjectPermissionGroup,
} from "@/lib/mock/people";

export type ProjectPersonRow = {
  key: string;
  contactId: string | null;
  segment: PeopleSegment;
  displayName: string;
  subtitle: string;
  roleOnProject: string;
  permissionGroups: PersonProjectPermissionGroup[];
};

function normalizeName(s: string): string {
  return s.trim().toLowerCase();
}

function findTeamContactByName(contacts: Contact[], name: string): Contact | undefined {
  const n = normalizeName(name);
  if (!n) return undefined;
  return contacts.find((c) => {
    if (c.segment !== "team") return false;
    const display = normalizeName(contactDisplayName(c, contacts));
    const contact = normalizeName(c.contact_name ?? "");
    const company = normalizeName(c.name);
    return display === n || contact === n || company === n;
  });
}

function findClientContactForProject(contacts: Contact[], clientName: string): Contact | undefined {
  const n = normalizeName(clientName);
  if (!n) return undefined;
  return contacts.find((c) => {
    if (c.segment !== "client") return false;
    return normalizeName(c.name) === n || normalizeName(c.contact_name ?? "") === n;
  });
}

function findVendorContactByCompany(contacts: Contact[], companyName: string): Contact | undefined {
  const n = normalizeName(companyName);
  if (!n) return undefined;
  return contacts.find((c) => c.segment === "vendor" && normalizeName(vendorDisplayName(c)) === n);
}

function segmentFromRoleLabel(role: string): PeopleSegment {
  const r = role.toLowerCase();
  if (r.includes("vendor")) return "vendor";
  if (r.includes("client")) return "client";
  return "team";
}

function upsertRow(
  map: Map<string, ProjectPersonRow>,
  row: Omit<ProjectPersonRow, "key"> & { key?: string },
) {
  const key = row.key ?? row.contactId ?? `name:${normalizeName(row.displayName)}`;
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { ...row, key });
    return;
  }
  const groups = existing.permissionGroups.length ? existing.permissionGroups : row.permissionGroups;
  map.set(key, {
    ...existing,
    roleOnProject: existing.roleOnProject.includes(row.roleOnProject)
      ? existing.roleOnProject
      : `${existing.roleOnProject} · ${row.roleOnProject}`,
    permissionGroups: groups,
    subtitle: row.subtitle || existing.subtitle,
    contactId: existing.contactId ?? row.contactId,
  });
}

function rowFromMockAccess(
  contacts: Contact[],
  personId: string,
  access: PersonProjectAccess,
): ProjectPersonRow {
  const contact = contacts.find((c) => c.id === personId);
  const segment = segmentFromRoleLabel(access.role_on_project);
  return {
    key: personId,
    contactId: personId,
    segment: contact?.segment ?? segment,
    displayName: contact ? contactDisplayName(contact, contacts) : personId,
    subtitle: contact?.email ?? access.role_on_project,
    roleOnProject: access.role_on_project,
    permissionGroups: access.permission_groups,
  };
}

function addAssignment(
  map: Map<string, ProjectPersonRow>,
  contacts: Contact[],
  opts: {
    name: string;
    roleOnProject: string;
    segment: PeopleSegment;
    contact?: Contact;
  },
) {
  const { name, roleOnProject, segment, contact } = opts;
  if (!name.trim()) return;
  const c = contact ?? (segment === "team" ? findTeamContactByName(contacts, name) : undefined);
  upsertRow(map, {
    key: c?.id ?? `name:${normalizeName(name)}`,
    contactId: c?.id ?? null,
    segment: c?.segment ?? segment,
    displayName: c ? contactDisplayName(c, contacts) : name.trim(),
    subtitle: c?.email ?? (c ? vendorDisplayName(c) : roleOnProject),
    roleOnProject,
    permissionGroups: [],
  });
}

/** Everyone attached to a project — mock directory access + project field assignments. */
export function peopleForProject(project: Project, contacts?: Contact[]): ProjectPersonRow[] {
  const directory = contacts ?? loadContacts();
  const map = new Map<string, ProjectPersonRow>();

  for (const [personId, rows] of Object.entries(MOCK_PERSON_PROJECT_ACCESS)) {
    for (const access of rows) {
      if (access.project_id !== project.id) continue;
      upsertRow(map, rowFromMockAccess(directory, personId, access));
    }
  }

  if (project.client?.name) {
    const clientContact = findClientContactForProject(directory, project.client.name);
    addAssignment(map, directory, {
      name: project.client.name,
      roleOnProject: "Client",
      segment: "client",
      contact: clientContact,
    });
  }

  if (project.lead_vendor) {
    const vendor = findVendorContactByCompany(directory, project.lead_vendor);
    addAssignment(map, directory, {
      name: project.lead_vendor,
      roleOnProject: "Lead vendor",
      segment: "vendor",
      contact: vendor,
    });
  }

  const teamSlots: { value: string | null | undefined; role: string }[] = [
    { value: project.lead_team_member, role: "Lead team" },
    { value: project.dev_prod_assigned_team_member, role: "Dev & production" },
    { value: project.cs_tech_pack_assigned_member, role: "C&S tech pack" },
    { value: project.artwork_tech_pack_assigned_member, role: "Artwork tech pack" },
  ];
  for (const slot of teamSlots) {
    if (!slot.value?.trim()) continue;
    addAssignment(map, directory, {
      name: slot.value,
      roleOnProject: slot.role,
      segment: "team",
    });
  }

  const order: Record<PeopleSegment, number> = { client: 0, team: 1, vendor: 2 };
  return [...map.values()].sort((a, b) => {
    const seg = order[a.segment] - order[b.segment];
    if (seg !== 0) return seg;
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  });
}

export function permissionSummary(groups: PersonProjectPermissionGroup[]): string {
  if (!groups.length) return "Uses project role defaults";
  const lines = groups.flatMap((g) => g.lines);
  if (lines.length <= 3) return lines.join(" · ");
  return `${lines.length} permissions across ${groups.length} groups`;
}
