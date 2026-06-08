"use client";

import { useLayoutEffect } from "react";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  clearLiveCache,
  mergeSeedLiveContacts,
  seedLiveJobsForProject,
  seedLiveJobsMap,
  seedLiveProjects,
} from "@/lib/data/live-cache";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

type LiveDataHydratorProps = {
  contacts?: Contact[];
  projects?: Project[];
  jobsProjectId?: number;
  jobs?: ProjectJob[];
  jobsByProject?: Record<number, ProjectJob[]>;
};

/** Seeds in-memory live cache so client components never read mock localStorage in Live mode. */
export function LiveDataHydrator({
  contacts,
  projects,
  jobsProjectId,
  jobs,
  jobsByProject,
}: LiveDataHydratorProps) {
  useLayoutEffect(() => {
    if (!isClientLiveBackend()) {
      clearLiveCache();
      return;
    }
    if (contacts) mergeSeedLiveContacts(contacts);
    if (projects) seedLiveProjects(projects);
    if (jobsProjectId != null && jobs) {
      seedLiveJobsForProject(jobsProjectId, jobs);
    }
    if (jobsByProject) seedLiveJobsMap(jobsByProject);
    window.dispatchEvent(new Event("onpro-live-cache-seeded"));
  }, [contacts, projects, jobsProjectId, jobs, jobsByProject]);

  return null;
}
