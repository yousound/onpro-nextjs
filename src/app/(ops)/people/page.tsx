import { LiveDataHydrator } from "@/components/live-data-hydrator";
import { PeoplePageContent } from "@/components/people-page-content";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchContacts } from "@/lib/data/contacts";
import { fetchProjects } from "@/lib/data/projects";
import { ensureSelfTeamContactForSession } from "@/lib/server/ensure-self-contact";

export default async function PeoplePage() {
  const live = await isLiveBackendEnabled();
  if (live) await ensureSelfTeamContactForSession();
  const initialContacts = await fetchContacts();
  const initialProjects = live ? await fetchProjects() : undefined;

  return (
    <>
      {live ? (
        <LiveDataHydrator contacts={initialContacts} projects={initialProjects} />
      ) : null}
      <PeoplePageContent initialContacts={initialContacts} initialProjects={initialProjects} />
    </>
  );
}
