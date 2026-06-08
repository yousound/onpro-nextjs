import { Suspense } from "react";
import { LiveDataHydrator } from "@/components/live-data-hydrator";
import { ProjectsPageContent } from "@/components/projects-page-content";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchContacts } from "@/lib/data/contacts";
import { fetchProjects } from "@/lib/data/projects";
import { ensureSelfTeamContactForSession } from "@/lib/server/ensure-self-contact";

export default async function ProjectsPage() {
  const live = await isLiveBackendEnabled();
  if (live) await ensureSelfTeamContactForSession();
  const projects = await fetchProjects();
  const contacts = live ? await fetchContacts() : undefined;
  return (
    <>
      {live ? <LiveDataHydrator projects={projects} contacts={contacts} /> : null}
      <Suspense fallback={null}>
        <ProjectsPageContent initialProjects={projects} />
      </Suspense>
    </>
  );
}
