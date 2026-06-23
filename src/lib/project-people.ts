import type { Project } from "@/lib/types/project";
import type { Contact, PeopleSegment } from "@/lib/types/contact";
import {
  contactDisplayName,
  loadContacts,
  vendorDisplayName,
} from "@/lib/contacts-store";
import type { PersonProjectPermissionGroup } from "@/lib/mock/people";

export type ProjectPersonRow = {
  key: string;
  contactId: string | null;
  segment: PeopleSegment;
  displayName: string;
  subtitle: string;
  roleOnProject: string;
  permissionGroups: PersonProjectPermissionGroup[];
  avatarUrl: string | null;
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

export function findClientContactForProject(
  contacts: Contact[],
  client: { id: number; name: string },
): Contact | undefined {
  const idKey = String(client.id);
  const byId = contacts.find((c) => c.segment === "client" && c.id === idKey);
  if (byId) return byId;
  const n = normalizeName(client.name);
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
    avatarUrl: row.avatarUrl ?? existing.avatarUrl,
  });
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
    avatarUrl: c?.avatar_url ?? null,
  });
}

export type PeopleForProjectOptions = {
  /** Signed-in operator — `profiles.self_contact_id`. */
  ownerContactId?: string | null;
  ownerEmail?: string | null;
  ownerFullName?: string | null;
  ownerAvatarUrl?: string | null;
};

function findTeamContactByEmail(contacts: Contact[], email: string): Contact | undefined {
  const e = email.trim().toLowerCase();
  if (!e) return undefined;
  return contacts.find((c) => c.segment === "team" && c.email.toLowerCase() === e);
}

function findOwnerContact(
  directory: Contact[],
  options?: PeopleForProjectOptions,
): Contact | undefined {
  const id = options?.ownerContactId?.trim();
  if (id) {
    const byId = directory.find((c) => c.id === id);
    if (byId) return byId;
  }
  const email = options?.ownerEmail?.trim();
  if (email) {
    const byEmail = findTeamContactByEmail(directory, email);
    if (byEmail) return byEmail;
  }
  const name = options?.ownerFullName?.trim();
  if (name) {
    const byName = findTeamContactByName(directory, name);
    if (byName) return byName;
  }
  return undefined;
}

function creatorRowFromProfile(options?: PeopleForProjectOptions): ProjectPersonRow | null {
  const email = options?.ownerEmail?.trim();
  if (!email) return null;
  const displayName = options?.ownerFullName?.trim() || email.split("@")[0] || "You";
  const key = options?.ownerContactId?.trim() || `creator:${email.toLowerCase()}`;
  return {
    key,
    contactId: options?.ownerContactId?.trim() || null,
    segment: "team",
    displayName,
    subtitle: email,
    roleOnProject: "Project creator",
    permissionGroups: [],
    avatarUrl: options?.ownerAvatarUrl ?? null,
  };
}

function addProjectCreator(
  map: Map<string, ProjectPersonRow>,
  directory: Contact[],
  options?: PeopleForProjectOptions,
) {
  const owner = findOwnerContact(directory, options);
  if (owner) {
    upsertRow(map, {
      key: owner.id,
      contactId: owner.id,
      segment: owner.segment,
      displayName: contactDisplayName(owner, directory),
      subtitle: owner.email,
      roleOnProject: "Project creator",
      permissionGroups: [],
      avatarUrl: owner.avatar_url ?? options?.ownerAvatarUrl ?? null,
    });
    return;
  }
  const fallback = creatorRowFromProfile(options);
  if (fallback) upsertRow(map, fallback);
}

function addTeamFieldAssignments(
  map: Map<string, ProjectPersonRow>,
  directory: Contact[],
  project: Project,
) {
  const slots: { value: string | null | undefined; role: string }[] = [
    { value: project.lead_team_member, role: "Lead team" },
    { value: project.dev_prod_assigned_team_member, role: "Dev & production" },
    { value: project.cs_tech_pack_assigned_member, role: "C&S tech pack" },
    { value: project.artwork_tech_pack_assigned_member, role: "Artwork tech pack" },
  ];
  for (const slot of slots) {
    if (!slot.value?.trim()) continue;
    const contact = findTeamContactByName(directory, slot.value);
    addAssignment(map, directory, {
      name: slot.value,
      roleOnProject: slot.role,
      segment: "team",
      contact: contact ?? undefined,
    });
  }
}

function sortProjectPeople(rows: ProjectPersonRow[]): ProjectPersonRow[] {
  const order: Record<PeopleSegment, number> = { client: 0, team: 1, vendor: 2 };
  return [...rows].sort((a, b) => {
    const seg = order[a.segment] - order[b.segment];
    if (seg !== 0) return seg;
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  });
}

/** People on a project from directory + field assignments (no demo seed rows). */
export function peopleForProject(
  project: Project,
  contacts?: Contact[],
  options?: PeopleForProjectOptions,
): ProjectPersonRow[] {
  const directory = contacts ?? loadContacts();
  const map = new Map<string, ProjectPersonRow>();

  addProjectCreator(map, directory, options);
  addTeamFieldAssignments(map, directory, project);

  if (project.client?.name) {
    const clientContact = findClientContactForProject(directory, project.client);
    addAssignment(map, directory, {
      name: clientContact ? contactDisplayName(clientContact, directory) : project.client.name,
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

  return sortProjectPeople([...map.values()]);
}

export function permissionSummary(groups: PersonProjectPermissionGroup[]): string {
  if (!groups.length) return "Uses project role defaults";
  const lines = groups.flatMap((g) => g.lines);
  if (lines.length <= 3) return lines.join(" · ");
  return `${lines.length} permissions across ${groups.length} groups`;
}
