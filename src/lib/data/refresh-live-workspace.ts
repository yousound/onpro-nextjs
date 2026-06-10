"use client";

import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  clearLiveCache,
  seedLiveContacts,
  seedLiveProjects,
} from "@/lib/data/live-cache";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";

/** Clear cached workspace data and pull contacts + projects for the active workspace. */
export async function refreshLiveWorkspaceData(): Promise<void> {
  if (typeof window === "undefined" || !isClientLiveBackend()) return;

  clearLiveCache();

  try {
    const [contactsRes, projectsRes] = await Promise.all([
      fetch("/api/contacts", { cache: "no-store" }),
      fetch("/api/projects", { cache: "no-store" }),
    ]);

    if (contactsRes.ok) {
      const data = (await contactsRes.json()) as { contacts?: Contact[] };
      if (Array.isArray(data.contacts)) seedLiveContacts(data.contacts);
    }

    if (projectsRes.ok) {
      const data = (await projectsRes.json()) as { projects?: Project[] };
      if (Array.isArray(data.projects)) seedLiveProjects(data.projects);
    }

    window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
    window.dispatchEvent(new Event("onpro-projects-changed"));
    window.dispatchEvent(new Event("onpro-live-cache-seeded"));
  } catch {
    /* RSC refresh may still re-seed */
  }
}
