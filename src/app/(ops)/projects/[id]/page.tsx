import { notFound } from "next/navigation";
import { LiveDataHydrator } from "@/components/live-data-hydrator";
import { ProjectDetailGate } from "@/components/project-detail-gate";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchContacts } from "@/lib/data/contacts";
import { fetchJobsForProject } from "@/lib/data/jobs";
import { fetchProjectById } from "@/lib/data/projects";
import { ensureSelfTeamContactForSession } from "@/lib/server/ensure-self-contact";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    notFound();
  }
  const live = await isLiveBackendEnabled();
  if (live) await ensureSelfTeamContactForSession();
  const staticProject = (await fetchProjectById(num)) ?? null;
  const initialJobs =
    live && staticProject ? await fetchJobsForProject(num, staticProject) : undefined;
  const contacts = live ? await fetchContacts() : undefined;

  return (
    <>
      {live && contacts ? (
        <LiveDataHydrator
          contacts={contacts}
          projects={staticProject ? [staticProject] : undefined}
          jobsProjectId={staticProject ? num : undefined}
          jobs={staticProject ? (initialJobs ?? []) : undefined}
        />
      ) : null}
      <ProjectDetailGate
        id={num}
        staticProject={staticProject}
        initialJobs={initialJobs}
      />
    </>
  );
}
