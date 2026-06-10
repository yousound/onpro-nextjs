import { isOptimisticContactId } from "@/lib/contact-invite-status";
import { withoutDemoSeedJobs } from "@/lib/mock/demo-seed-jobs";
import { dedupeProjectsById } from "@/lib/dedupe-projects";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { ProjectJob, ProjectOrder } from "@/lib/types/wip";

let contacts: Contact[] = [];
let projects: Project[] = [];
const jobsByProjectId = new Map<number, ProjectJob[]>();
const ordersByProjectId = new Map<number, ProjectOrder[]>();

function contactEmailKey(c: Contact): string {
  return c.email.trim().toLowerCase();
}

/** Replace cache with server list, keeping unsaved session-only rows the server has not returned yet. */
export function mergeSeedLiveContacts(server: Contact[]): void {
  const byEmail = new Map(server.map((c) => [contactEmailKey(c), c]));
  const merged = [...server];
  for (const cached of contacts) {
    if (!isOptimisticContactId(cached.id)) continue;
    if (byEmail.has(contactEmailKey(cached))) continue;
    if (merged.some((c) => c.id === cached.id)) continue;
    merged.push(cached);
  }
  contacts = merged;
}

export function seedLiveContacts(next: Contact[]): void {
  contacts = next;
}

export function seedLiveProjects(next: Project[]): void {
  projects = dedupeProjectsById(next);
}

export function seedLiveJobsForProject(projectId: number, jobs: ProjectJob[]): void {
  const cleaned = withoutDemoSeedJobs(jobs);
  if (cleaned.length === 0 && jobsByProjectId.has(projectId)) return;
  jobsByProjectId.set(projectId, cleaned);
}

export function seedLiveJobsMap(map: Record<number, ProjectJob[]>): void {
  for (const [id, jobs] of Object.entries(map)) {
    const cleaned = withoutDemoSeedJobs(jobs);
    if (cleaned.length > 0) {
      jobsByProjectId.set(Number(id), cleaned);
    }
  }
}

export function getLiveCachedContacts(): Contact[] {
  return contacts;
}

/** Merge a saved contact into the live cache (e.g. after create from new-project modal). */
export function removeLiveContact(contactId: string): void {
  contacts = contacts.filter((c) => c.id !== contactId);
}

export function upsertLiveContact(contact: Contact): void {
  const emailKey = contact.email.trim().toLowerCase();
  const byId = contacts.findIndex((c) => c.id === contact.id);
  if (byId >= 0) {
    contacts = contacts.map((c, i) => (i === byId ? contact : c));
    return;
  }
  const byEmail = contacts.findIndex((c) => c.email.trim().toLowerCase() === emailKey);
  if (byEmail >= 0) {
    contacts = contacts.map((c, i) => (i === byEmail ? contact : c));
    return;
  }
  contacts = [...contacts, contact];
}

export function getLiveCachedProjects(): Project[] {
  return projects;
}

/** Session-created project until persisted to Supabase. */
export function upsertLiveProject(project: Project): void {
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects = projects.map((p, i) => (i === idx ? project : p));
    return;
  }
  projects = [...projects, project];
}

export function removeLiveProject(projectId: number): void {
  projects = projects.filter((p) => p.id !== projectId);
  jobsByProjectId.delete(projectId);
  ordersByProjectId.delete(projectId);
}

export function seedLiveOrdersForProject(projectId: number, orders: ProjectOrder[]): void {
  ordersByProjectId.set(projectId, orders);
}

export function getLiveCachedOrders(projectId: number): ProjectOrder[] {
  return ordersByProjectId.get(projectId) ?? [];
}

export function getLiveCachedJobs(projectId: number): ProjectJob[] {
  return jobsByProjectId.get(projectId) ?? [];
}

export function clearLiveCache(): void {
  contacts = [];
  projects = [];
  jobsByProjectId.clear();
  ordersByProjectId.clear();
}
