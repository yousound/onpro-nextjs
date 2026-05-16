import { mockCalendarEvents } from "@/lib/mock/calendar-events";
import { getConversations } from "@/lib/mock/conversations";
import { mockDocuments } from "@/lib/mock/documents";
import { MOCK_PENDING_INVITES } from "@/lib/mock/people";
import { getJobsForProject } from "@/lib/mock/project-jobs";
import { mockProjects } from "@/lib/mock/projects";

export type OverviewFocusTone = "default" | "warn" | "accent";

export type OverviewFocusItem = {
  id: string;
  area: string;
  title: string;
  subtitle: string;
  href: string;
  tone: OverviewFocusTone;
};

export type OverviewDigest = {
  totalUnreadMessages: number;
  pendingInvites: number;
  projectsInFlight: number;
  overdueProjectCount: number;
  totalJobs: number;
  documentsCount: number;
  calendarNext7d: number;
  jobsInProgressCount: number;
  focusItems: OverviewFocusItem[];
};

function countJobsAcrossMockProjects(): number {
  let n = 0;
  const seen = new Set<number>();
  for (const p of mockProjects) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    n += getJobsForProject(p.id).length;
  }
  return n;
}

function countJobsInProgressAcrossMockProjects(): number {
  let n = 0;
  const seen = new Set<number>();
  for (const p of mockProjects) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    for (const j of getJobsForProject(p.id)) {
      if (j.status === "In progress") n += 1;
    }
  }
  return n;
}

function calendarEventsNearToday(todayYmd: string, daysBefore: number, daysAfter: number): number {
  const t0 = new Date(`${todayYmd}T12:00:00.000Z`).getTime();
  const start = t0 - daysBefore * 86400000;
  const end = t0 + daysAfter * 86400000;
  return mockCalendarEvents.filter((e) => {
    const t = new Date(`${e.date}T12:00:00.000Z`).getTime();
    return t >= start && t <= end;
  }).length;
}

export function buildOverviewDigest(todayYmd: string): OverviewDigest {
  const conv = getConversations();
  const totalUnreadMessages = conv.reduce((a, c) => a + (c.unread_count ?? 0), 0);
  const topUnread = conv.filter((c) => (c.unread_count ?? 0) > 0).sort((a, b) => (b.unread_count ?? 0) - (a.unread_count ?? 0))[0];

  const projectsInFlight = mockProjects.filter(
    (p) => p.status === "IN-PROGRESS" || p.status === "IN DEVELOPMENT",
  ).length;

  const overdueProjects = mockProjects.filter((p) => {
    if (!p.due_date) return false;
    return p.due_date < `${todayYmd}T12:00:00.000Z` && p.status !== "COMPLETED" && p.status !== "DELIVERED";
  });

  const totalJobs = countJobsAcrossMockProjects();
  const jobsInProgressCount = countJobsInProgressAcrossMockProjects();
  const pendingInvites = MOCK_PENDING_INVITES.length;
  const documentsCount = mockDocuments.length;
  const calendarNext7d = calendarEventsNearToday(todayYmd, 1, 7);
  const overdueProjectCount = overdueProjects.length;

  const focusItems: OverviewFocusItem[] = [];

  if (topUnread) {
    focusItems.push({
      id: "focus-msgs",
      area: "Messages",
      title: `${topUnread.name}`,
      subtitle: `${topUnread.unread_count} unread — last: ${topUnread.last_message_preview ?? "—"}`,
      href: "/messages",
      tone: "accent",
    });
  }

  const urgentProject = overdueProjects[0] ?? mockProjects.find((p) => p.status === "IN-PROGRESS");
  if (urgentProject) {
    const overdue = overdueProjects.includes(urgentProject);
    focusItems.push({
      id: "focus-proj",
      area: "Projects",
      title: urgentProject.name,
      subtitle: overdue ? "Due date passed — check milestones" : "In progress — review status",
      href: `/projects/${urgentProject.id}`,
      tone: overdue ? "warn" : "default",
    });
  }

  if (pendingInvites > 0) {
    focusItems.push({
      id: "focus-people",
      area: "People",
      title: `${pendingInvites} pending invitation${pendingInvites === 1 ? "" : "s"}`,
      subtitle: "Review or resend from People",
      href: "/people",
      tone: "default",
    });
  }

  if (calendarNext7d > 0) {
    focusItems.push({
      id: "focus-cal",
      area: "Calendar",
      title: `${calendarNext7d} event${calendarNext7d === 1 ? "" : "s"} on your radar`,
      subtitle: "Shipping, meetings, and milestones",
      href: "/calendar",
      tone: "default",
    });
  }

  return {
    totalUnreadMessages,
    pendingInvites,
    projectsInFlight,
    overdueProjectCount,
    totalJobs,
    documentsCount,
    calendarNext7d,
    jobsInProgressCount,
    focusItems: focusItems.slice(0, 5),
  };
}

/** Sidebar red-dot alerts (mock): same signals as the overview digest. */
export function getSidebarNavAlertMap(todayYmd: string): Record<string, boolean> {
  const d = buildOverviewDigest(todayYmd);
  return {
    "/": d.focusItems.length > 0,
    "/messages": d.totalUnreadMessages > 0,
    "/projects": d.overdueProjectCount > 0,
    "/production": d.jobsInProgressCount > 0,
    "/calendar": d.calendarNext7d > 0,
    "/documents": false,
    "/people": d.pendingInvites > 0,
  };
}
