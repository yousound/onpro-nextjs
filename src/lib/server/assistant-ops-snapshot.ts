import { isLiveBackendEnabled } from "@/lib/config/backend";
import { fetchContacts } from "@/lib/data/contacts";
import { fetchJobsForProject } from "@/lib/data/jobs";
import { fetchProjects } from "@/lib/data/projects";
import {
  buildAssistantContext,
  type AssistantContext,
} from "@/lib/mock/overview-briefing";
import { mockCalendarEvents } from "@/lib/mock/calendar-events";
import { getConversations } from "@/lib/mock/conversations";
import { mockDocuments } from "@/lib/mock/documents";
import {
  attachmentsForConversation,
  messagesForConversation,
} from "@/lib/mock/message-threads";
import { MOCK_PENDING_INVITES } from "@/lib/mock/people";
import { buildOverviewDigest } from "@/lib/mock/overview-digest";
import { migrateProjectStatus } from "@/lib/project-status";
import { trimPromptText } from "@/lib/server/assistant-prompt-trim";
import { getGmailConnectionForUser } from "@/lib/supabase/gmail-connection";
import { listMailroomScansForAssistant } from "@/lib/supabase/mailroom-thread-scans";
import { formatAssistantPrefsForPrompt } from "@/lib/assistant/prefs";
import type { AssistantPrefs } from "@/lib/types/assistant-prefs";
import { DEFAULT_ASSISTANT_PREFS } from "@/lib/types/assistant-prefs";
import type { Contact, PeopleSegment } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import type { WorkspaceMatch } from "@/lib/types/workspace";
import { createClient } from "@/lib/supabase/server";
import { fetchJoinedTeamsForMember } from "@/lib/supabase/workspace-memberships";

export type AssistantProjectSnapshot = {
  id: number;
  name: string;
  status: string;
  due_date: string | null;
  client: string;
  project_number: string | null;
  po_number: string | null;
  description: string | null;
  status_overview: string | null;
};

export type AssistantJobSnapshot = {
  id: string;
  project_id: number;
  name: string;
  status: string;
  job_number: string | null;
  style_number: string;
  lead_vendor: string;
  category: string;
  due_date: string | null;
  po_number: string | null;
  timeline_in_progress: string[];
};

export type AssistantContactSnapshot = {
  id: string;
  segment: PeopleSegment;
  name: string;
  email: string;
  kind: Contact["kind"];
  company_code: string;
  contact_name?: string;
  phone?: string;
  parent_company_id?: string;
  notes?: string;
};

export type AssistantEmailThreadRef = {
  id: string;
  subject: string;
};

export type AssistantOpsSnapshot = {
  userName: string;
  todayYmd: string;
  assistantPrefs: AssistantPrefs;
  context: AssistantContext;
  projects: AssistantProjectSnapshot[];
  jobs: AssistantJobSnapshot[];
  contacts: AssistantContactSnapshot[];
  /** Workspaces the user has joined as team/vendor/client member. */
  joinedTeams: WorkspaceMatch[];
  /** Mailroom / Gmail threads available to link in assistant replies. */
  emailThreadRefs: AssistantEmailThreadRef[];
  promptContext: string;
};

const PROMPT_CONTACT_LIMIT = 100;

function toContactSnapshot(c: Contact): AssistantContactSnapshot {
  return {
    id: c.id,
    segment: c.segment,
    name: c.name,
    email: c.email,
    kind: c.kind,
    company_code: c.company_code,
    ...(c.contact_name ? { contact_name: c.contact_name } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    ...(c.parent_company_id ? { parent_company_id: c.parent_company_id } : {}),
    ...(c.notes ? { notes: trimPromptText(c.notes, 200) } : {}),
  };
}

function contactStats(contacts: Contact[]) {
  return {
    total: contacts.length,
    clients: contacts.filter((c) => c.segment === "client").length,
    vendors: contacts.filter((c) => c.segment === "vendor").length,
    team: contacts.filter((c) => c.segment === "team").length,
  };
}

function toProjectSnapshot(p: Project): AssistantProjectSnapshot {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    due_date: p.due_date,
    client: p.client.name,
    project_number: p.project_number,
    po_number: p.po_number ?? null,
    description: p.description ? trimPromptText(p.description, 400) : null,
    status_overview: p.status_overview ? trimPromptText(p.status_overview, 300) : null,
  };
}

function toJobSnapshot(j: ProjectJob): AssistantJobSnapshot {
  return {
    id: j.id,
    project_id: j.project_id,
    name: j.name,
    status: j.status,
    job_number: j.job_number ?? null,
    style_number: j.style_number ?? "",
    lead_vendor: j.lead_vendor ?? "",
    category: j.category ?? "",
    due_date: j.due_date,
    po_number: j.po_number ?? j.client_po_number ?? null,
    timeline_in_progress: j.timeline
      .filter((s) => s.state === "in_progress")
      .map((s) => s.label)
      .slice(0, 4),
  };
}

function buildInAppMessagesSnapshot() {
  const conversations = getConversations().map((c) => ({
    id: c.id,
    name: c.name,
    project_id: c.project_id ?? null,
    unread_count: c.unread_count ?? 0,
    last_preview: trimPromptText(c.last_message_preview, 200),
    last_at: c.last_message_date,
    participants: c.participants.map((p) => p.name),
    messages: messagesForConversation(c.id).map((m) => ({
      id: m.id,
      side: m.side,
      at: m.time_label,
      body: trimPromptText(m.body, 500),
      attachment: m.smart_attachment
        ? {
            kind: m.smart_attachment.kind,
            title: m.smart_attachment.title,
            subtitle: m.smart_attachment.subtitle ?? null,
          }
        : null,
    })),
    file_attachments: attachmentsForConversation(c.id).map((a) => ({
      name: a.name,
      ext: a.ext,
      date: a.date,
    })),
  }));

  return {
    source: "mock_in_app_messages",
    conversationCount: conversations.length,
    conversations,
  };
}

export type AssistantEmailSnapshot = {
  source: string;
  connected: boolean;
  email: string | null;
  /** Threads the user explicitly summarized in Mailroom (not the whole inbox). */
  threadCount: number;
  threads: [];
  scannedThreads: Array<{
    id: string;
    subject: string;
    summary: string;
    scanned_at: string;
  }>;
  note: string;
};

function buildMockEmailSnapshot(): AssistantEmailSnapshot {
  return {
    source: "mock_mailroom",
    connected: false,
    email: null,
    threadCount: 0,
    threads: [],
    scannedThreads: [],
    note:
      "Mailroom inbox is not sent to the assistant. Summarize a thread in Mailroom first; only then it appears here.",
  };
}

async function buildLiveEmailSnapshot(userId: string | undefined): Promise<AssistantEmailSnapshot> {
  if (!userId) {
    return {
      source: "gmail",
      connected: false,
      email: null,
      threadCount: 0,
      threads: [],
      scannedThreads: [],
      note: "Sign in and connect Gmail in Mailroom. Summarize individual threads to include them in assistant context.",
    };
  }

  const connection = await getGmailConnectionForUser(userId).catch(() => null);
  const scans = await listMailroomScansForAssistant(userId);

  return {
    source: "gmail",
    connected: Boolean(connection),
    email: connection?.email ?? null,
    threadCount: scans.length,
    threads: [],
    scannedThreads: scans.map((s) => ({
      id: s.thread_id,
      subject: s.subject,
      summary: trimPromptText(s.summary, 800),
      scanned_at: s.scanned_at,
    })),
    note:
      "Inbox emails are never scanned by the assistant automatically. Only threads you tapped Summarize on in Mailroom are listed in scannedThreads.",
  };
}

function buildDocumentsSnapshot(live: boolean) {
  if (live) {
    return {
      source: "none_yet",
      count: 0,
      items: [] as Array<{
        id: number;
        title: string;
        kind: string;
        project_id: number | null;
        updated_at: string;
      }>,
      note: "Documents are not stored in Supabase yet — only in-browser in Mock mode until migrated.",
    };
  }
  const items = [...mockDocuments]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((d) => ({
      id: d.id,
      title: d.name,
      kind: d.kind,
      project_id: d.project_id,
      project_name: d.project_name,
      uploaded_by: d.uploaded_by,
      updated_at: d.updated_at,
    }));
  return {
    source: "mock_documents",
    count: items.length,
    items,
    note: "Invoices, quotes, and uploads from the Documents section (demo data).",
  };
}

async function buildCalendarSnapshot(
  live: boolean,
  todayYmd: string,
  userId?: string,
) {
  if (live && userId) {
    const { fetchWorkspaceCalendarEvents } = await import(
      "@/lib/server/fetch-workspace-calendar-events"
    );
    const sync = await fetchWorkspaceCalendarEvents(userId).catch(() => ({
      events: [],
      connectedAccounts: [],
      teamUserCount: 0,
    }));
    const events = sync.events.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date,
      start_time: e.start_time,
      end_time: e.end_time,
      event_type: e.event_type,
      department: e.department ?? null,
      owner: e.calendar_owner_name ?? e.calendar_owner_email ?? null,
    }));
    const upcoming = events.filter((e) => e.date >= todayYmd).length;
    return {
      source: "google_calendar_team",
      count: events.length,
      upcomingFromToday: upcoming,
      connectedAccounts: sync.connectedAccounts.map((a) => a.email),
      events,
      note:
        sync.connectedAccounts.length > 0
          ? "Google Calendar from each team member who connected Gmail in Mailroom."
          : "No Gmail connections yet — connect in Mailroom to sync team calendars.",
    };
  }
  if (live) {
    return {
      source: "none_yet",
      count: 0,
      upcomingFromToday: 0,
      events: [] as Array<{
        id: number;
        name: string;
        date: string;
        event_type: string | null;
      }>,
      note: "Sign in to sync team Google Calendars.",
    };
  }
  const events = mockCalendarEvents.map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date,
    event_type: e.event_type,
    department: e.department ?? null,
    po: e.po ?? null,
    notes: e.notes ? trimPromptText(e.notes, 200) : null,
    shipped_from: e.shipped_from ?? null,
    shipped_to: e.shipped_to ?? null,
  }));
  const upcoming = events.filter((e) => e.date >= todayYmd).length;
  return {
    source: "mock_calendar",
    count: events.length,
    upcomingFromToday: upcoming,
    events,
    note: "Production and shipping checkpoints from Calendar (demo data).",
  };
}

function buildCoverage(params: {
  live: boolean;
  projects: number;
  jobs: number;
  contacts: number;
  contactsTruncated: boolean;
  email: { connected: boolean; threadCount: number };
  inAppMessages: number;
  documents: number;
  calendar: number;
}) {
  return {
    mode: params.live ? "live_supabase" : "mock_demo",
    sections: {
      projects: { readable: true, count: params.projects },
      jobs: { readable: true, count: params.jobs },
      people_contacts: {
        readable: true,
        count: params.contacts,
        truncated: params.contactsTruncated,
      },
      in_app_messages: {
        readable: !params.live,
        count: params.inAppMessages,
        note: params.live
          ? "In-app Messages threads are not in Supabase; use emailThreads when Gmail is connected."
          : "Full thread bodies and sent attachments from Messages.",
      },
      mailroom_email: {
        readable: true,
        gmailConnected: params.email.connected,
        threadCount: params.email.threadCount,
        note: params.live
          ? "Live Gmail inbox bodies (truncated) when connected."
          : "Demo Mailroom / vendor & client email threads with bodies.",
      },
      documents: {
        readable: !params.live || params.documents > 0,
        count: params.documents,
      },
      calendar: {
        readable: !params.live || params.calendar > 0,
        count: params.calendar,
      },
      production: { readable: true, note: "Same job rows as jobs; open /production for board UI." },
    },
    notInSnapshot: [
      "Raw binary file contents (only document metadata and message text)",
      "User-specific browser edits in Live mode for calendar/documents until those tables exist",
    ],
  };
}

export async function buildAssistantOpsSnapshot(
  userName: string,
  todayYmd: string,
  assistantPrefs: AssistantPrefs = DEFAULT_ASSISTANT_PREFS,
  userId?: string,
): Promise<AssistantOpsSnapshot> {
  const [projects, contacts, live] = await Promise.all([
    fetchProjects(),
    fetchContacts(),
    isLiveBackendEnabled(),
  ]);

  const jobs: AssistantJobSnapshot[] = [];
  for (const p of projects.slice(0, 30)) {
    const projectJobs = await fetchJobsForProject(p.id, p);
    for (const j of projectJobs) {
      jobs.push(toJobSnapshot(j));
    }
  }

  const inAppMessages = live ? { source: "live", conversationCount: 0, conversations: [] } : buildInAppMessagesSnapshot();
  const email = live ? await buildLiveEmailSnapshot(userId) : buildMockEmailSnapshot();

  const cStats = contactStats(contacts);

  const ctx: AssistantContext = live
    ? {
        projectCount: projects.length,
        jobCount: jobs.length,
        jobsInProgress: jobs.filter((j) => j.status === "In progress").length,
        unreadMessages: inAppMessages.conversations.reduce(
          (n, c) => n + (c.unread_count ?? 0),
          0,
        ) +
          (email.threads as { status?: string }[]).filter((t) => t.status === "unread").length,
        pendingInvites: 0,
        contactCount: cStats.total,
        clientCount: cStats.clients,
        vendorCount: cStats.vendors,
        teamCount: cStats.team,
      }
    : {
        ...buildAssistantContext(todayYmd),
        contactCount: cStats.total,
        clientCount: cStats.clients,
        vendorCount: cStats.vendors,
        teamCount: cStats.team,
      };

  const documents = buildDocumentsSnapshot(live);
  const calendar = await buildCalendarSnapshot(live, todayYmd, userId);

  const digest = live
    ? {
        overdueProjectCount: projects.filter(
          (p) =>
            p.due_date &&
            p.due_date < todayYmd &&
            migrateProjectStatus(p.status) !== "Completed",
        ).length,
        projectsInFlight: projects.length,
        calendarNext7d: calendar.upcomingFromToday ?? 0,
      }
    : buildOverviewDigest(todayYmd);

  const pendingInvites = live
    ? []
    : MOCK_PENDING_INVITES.slice(0, 10).map((i) => ({
        email: i.email,
        segment: i.segment,
        label: i.invited_label,
        sent_at: i.sent_at,
      }));

  const projectSnapshots = projects.map(toProjectSnapshot);
  const contactSnapshots = contacts.slice(0, PROMPT_CONTACT_LIMIT).map(toContactSnapshot);

  let joinedTeams: WorkspaceMatch[] = [];
  let workspaceViewLabel = "My workspace";
  if (live && userId) {
    try {
      const supabase = await createClient();
      const { resolveWorkspaceView } = await import("@/lib/server/resolve-workspace-context");
      joinedTeams = await fetchJoinedTeamsForMember(supabase, userId);
      const view = await resolveWorkspaceView(supabase, userId);
      workspaceViewLabel = view.workspaceName;
    } catch {
      joinedTeams = [];
    }
  }

  const coverage = buildCoverage({
    live,
    projects: projectSnapshots.length,
    jobs: jobs.length,
    contacts: contacts.length,
    contactsTruncated: contacts.length > PROMPT_CONTACT_LIMIT,
    email: { connected: email.connected, threadCount: email.threadCount },
    inAppMessages: inAppMessages.conversationCount,
    documents: documents.count,
    calendar: calendar.count,
  });

  const promptContext = JSON.stringify(
    {
      userName,
      todayYmd,
      userPreferences: formatAssistantPrefsForPrompt(assistantPrefs),
      coverage,
      instructions:
        "You have read access to everything in this JSON. Use coverage.sections to see what is included. Honor userPreferences. Answer from listed data only; never claim you lack access. If a section is empty, say so and link to the app route.",
      stats: ctx,
      digest: {
        overdueProjectCount: digest.overdueProjectCount,
        projectsInFlight: digest.projectsInFlight,
        calendarNext7d: digest.calendarNext7d,
      },
      contacts: {
        ...cStats,
        listed: contactSnapshots,
        truncated: contacts.length > PROMPT_CONTACT_LIMIT,
      },
      projects: projectSnapshots,
      jobs,
      inAppMessages,
      emailThreads: email,
      documents,
      calendar,
      pendingInvites,
      activeWorkspace: workspaceViewLabel,
      joinedTeams: joinedTeams.map((t) => ({
        workspaceName: t.workspaceName,
        contactDisplayName: t.contactDisplayName,
        segment: t.segment ?? "team",
        projectCount: t.projectCount,
      })),
      appRoutes: {
        messages: "/messages",
        mailroom: "/mailroom",
        production: "/production",
        calendar: "/calendar",
        people: "/people",
        projects: "/projects",
        documents: "/documents",
      },
    },
    null,
    2,
  );

  return {
    userName,
    todayYmd,
    assistantPrefs,
    context: ctx,
    projects: projectSnapshots,
    jobs,
    contacts: contactSnapshots,
    joinedTeams,
    emailThreadRefs: email.scannedThreads.map((t) => ({ id: t.id, subject: t.subject })),
    promptContext,
  };
}
