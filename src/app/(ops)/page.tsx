import { redirect } from "next/navigation";
import { LiveDataHydrator } from "@/components/live-data-hydrator";
import { OverviewView } from "@/components/overview-view";
import { calendarTodayYmd } from "@/lib/calendar-google";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchContacts } from "@/lib/data/contacts";
import { fetchJobsForProject } from "@/lib/data/jobs";
import { fetchProjects } from "@/lib/data/projects";
import { fetchWorkspaceCalendarEvents } from "@/lib/server/fetch-workspace-calendar-events";
import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/types/calendar";
import type { ProjectJob } from "@/lib/types/wip";

export default async function Home() {
  const live = await isLiveBackendEnabled();
  if (!live) redirect("/login");

  const projects = await fetchProjects();
  const contacts = await fetchContacts();
  const jobsByProject: Record<number, ProjectJob[]> = {};
  for (const p of projects) {
    jobsByProject[p.id] = await fetchJobsForProject(p.id, p);
  }

  let calendarEvents: CalendarEvent[] = [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const sync = await fetchWorkspaceCalendarEvents(user.id);
      calendarEvents = sync.events;
    }
  } catch (e) {
    console.error("[overview] calendar sync", e);
  }

  return (
    <>
      <LiveDataHydrator projects={projects} contacts={contacts} jobsByProject={jobsByProject} />
      <OverviewView
        liveMode
        projects={projects}
        jobsByProject={jobsByProject}
        calendarEvents={calendarEvents}
        todayYmd={calendarTodayYmd()}
      />
    </>
  );
}
