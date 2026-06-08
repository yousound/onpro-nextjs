import { LiveDataHydrator } from "@/components/live-data-hydrator";
import { ProductionPageContent } from "@/components/production-page-content";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchContacts } from "@/lib/data/contacts";
import { fetchJobsForProject } from "@/lib/data/jobs";
import { fetchProjects } from "@/lib/data/projects";
import type { ProjectJob } from "@/lib/types/wip";

export default async function ProductionPage() {
  const projects = await fetchProjects();
  const live = await isLiveBackendEnabled();
  let jobsByProject: Record<number, ProjectJob[]> | undefined;
  let contacts;
  if (live) {
    jobsByProject = {};
    for (const p of projects) {
      jobsByProject[p.id] = await fetchJobsForProject(p.id, p);
    }
    contacts = await fetchContacts();
  }

  return (
    <>
      {live ? (
        <LiveDataHydrator projects={projects} contacts={contacts} jobsByProject={jobsByProject} />
      ) : null}
      <ProductionPageContent projects={projects} initialJobsByProject={jobsByProject} />
    </>
  );
}
