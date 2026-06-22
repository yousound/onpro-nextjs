"use client";

import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  clearLiveCache,
  seedLiveContacts,
  seedLiveProjects,
} from "@/lib/data/live-cache";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";

/** Pull the latest project list for the active workspace into the live cache. */
export async function fetchAndSeedLiveProjects(): Promise<Project[] | null> {
  if (typeof window === "undefined" || !isClientLiveBackend()) return null;

  try {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { projects?: Project[] };
    if (!Array.isArray(data.projects)) return null;
    seedLiveProjects(data.projects);
    window.dispatchEvent(new Event("onpro-projects-changed"));
    return data.projects;
  } catch {
    return null;
  }
}

/** Clear cached workspace data and pull contacts + projects for the active workspace. */
export async function refreshLiveWorkspaceData(): Promise<void> {
  if (typeof window === "undefined" || !isClientLiveBackend()) return;

  clearLiveCache();

  try {
    const [contactsRes, projects] = await Promise.all([
      fetch("/api/contacts", { cache: "no-store" }),
      fetchAndSeedLiveProjects(),
    ]);

    if (contactsRes.ok) {
      const data = (await contactsRes.json()) as { contacts?: Contact[] };
      if (Array.isArray(data.contacts)) seedLiveContacts(data.contacts);
    }

    void projects;

    window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
    window.dispatchEvent(new Event("onpro-live-cache-seeded"));
  } catch {
    /* RSC refresh may still re-seed */
  }
}
