import { withBriefingPartSpacing } from "@/lib/briefing-part-spacing";
import { loadContacts, SEED_CONTACTS } from "@/lib/contacts-store";
import { getJobsForProject } from "@/lib/mock/project-jobs";
import { mockProjects } from "@/lib/mock/projects";
import { buildOverviewDigest } from "@/lib/mock/overview-digest";
import {
  findEmailThreadByQuery,
  labelLooksLikeMailroomEmail,
} from "@/lib/assistant-mailroom-links";
import { MOCK_EMAIL_THREADS } from "@/lib/mock/email-threads";
import { formatAssistantPrefsForPrompt, briefingIncludesSection } from "@/lib/assistant/prefs";
import type { AssistantPrefs } from "@/lib/types/assistant-prefs";
import { DEFAULT_ASSISTANT_PREFS } from "@/lib/types/assistant-prefs";
import type {
  AssistantContactSnapshot,
  AssistantOpsSnapshot,
} from "@/lib/server/assistant-ops-snapshot";

export type BriefingLinkAction =
  | { kind: "job"; projectId: number; jobId: string; label: string }
  | { kind: "project"; projectId: number; label: string }
  | { kind: "mailroom"; label: string; threadId?: string }
  | { kind: "messages"; label: string; href?: string }
  | { kind: "calendar"; label: string }
  | { kind: "people"; label: string }
  | { kind: "production"; label: string }
  | { kind: "projects"; label: string }
  | { kind: "documents"; label: string };

export type BriefingPart =
  | { type: "text"; value: string }
  | { type: "link"; action: BriefingLinkAction };

export type BriefingBlock = {
  id: string;
  parts: BriefingPart[];
};

export function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Plain-language workspace summary with linkable entities (mock — future AI). */
export function buildOvernightBriefing(
  userName: string,
  todayYmd: string,
  assistantPrefs: AssistantPrefs = DEFAULT_ASSISTANT_PREFS,
): BriefingBlock[] {
  const digest = buildOverviewDigest(todayYmd);
  const ctx = buildAssistantContext(todayYmd);
  const greeting = greetingForHour(new Date().getHours());
  const includeProjects = briefingIncludesSection(assistantPrefs, "projects");
  const includeJobs = briefingIncludesSection(assistantPrefs, "jobs");
  const includeMessages = briefingIncludesSection(assistantPrefs, "messages");
  const includeContacts = briefingIncludesSection(assistantPrefs, "contacts");

  const blocks: BriefingBlock[] = [
    {
      id: "intro",
      parts: [{ type: "text", value: `${greeting}, ${userName}. Here's what's in your workspace today:` }],
    },
  ];

  if (includeMessages && ctx.unreadMessages > 0) {
    blocks.push({
      id: "messages",
      parts: [
        { type: "text", value: "• " },
        { type: "link", action: { kind: "messages", label: "Messages", href: "/messages" } },
        {
          type: "text",
          value: ` — ${ctx.unreadMessages} unread conversation${ctx.unreadMessages === 1 ? "" : "s"}.`,
        },
      ],
    });
  }

  if (includeProjects && digest.overdueProjectCount > 0) {
    blocks.push({
      id: "overdue",
      parts: [
        { type: "text", value: "• " },
        { type: "link", action: { kind: "projects", label: "Projects" } },
        {
          type: "text",
          value: ` — ${digest.overdueProjectCount} past due and may need a date or status update.`,
        },
      ],
    });
  }

  if (includeJobs && ctx.jobsInProgress > 0) {
    blocks.push({
      id: "jobs",
      parts: [
        { type: "text", value: "• " },
        { type: "link", action: { kind: "production", label: "Production board" } },
        {
          type: "text",
          value: ` — ${ctx.jobsInProgress} job${ctx.jobsInProgress === 1 ? "" : "s"} in progress.`,
        },
      ],
    });
  }

  if (includeContacts && digest.pendingInvites > 0) {
    blocks.push({
      id: "invites",
      parts: [
        { type: "text", value: "• " },
        {
          type: "link",
          action: {
            kind: "people",
            label: `${digest.pendingInvites} pending invite${digest.pendingInvites === 1 ? "" : "s"}`,
          },
        },
        { type: "text", value: " on People." },
      ],
    });
  }

  if (blocks.length === 1) {
    blocks.push({
      id: "empty",
      parts: [
        {
          type: "text",
          value: "Nothing urgent right now. Ask me about any project, job, or person in OnPro.",
        },
      ],
    });
  } else {
    blocks.push({
      id: "cta",
      parts: [
        {
          type: "text",
          value: " Ask me about any project, job, vendor, or person — I'll pull from everything in OnPro.",
        },
      ],
    });
  }

  return blocks.map((block) => ({
    ...block,
    parts: withBriefingPartSpacing(block.parts),
  }));
}

export type AssistantContext = {
  projectCount: number;
  jobCount: number;
  jobsInProgress: number;
  unreadMessages: number;
  pendingInvites: number;
  contactCount?: number;
  clientCount?: number;
  vendorCount?: number;
  teamCount?: number;
};

export function buildAssistantContext(todayYmd: string): AssistantContext {
  const d = buildOverviewDigest(todayYmd);
  return {
    projectCount: mockProjects.length,
    jobCount: d.totalJobs,
    jobsInProgress: d.jobsInProgressCount,
    unreadMessages: d.totalUnreadMessages,
    pendingInvites: d.pendingInvites,
    contactCount: SEED_CONTACTS.length,
    clientCount: SEED_CONTACTS.filter((c) => c.segment === "client").length,
    vendorCount: SEED_CONTACTS.filter((c) => c.segment === "vendor").length,
    teamCount: SEED_CONTACTS.filter((c) => c.segment === "team").length,
  };
}

export type AssistantReply = {
  parts: BriefingPart[];
};

export function assistantReplyPlain(reply: AssistantReply): string {
  const parts = withBriefingPartSpacing(reply.parts);
  return parts
    .map((p) => (p.type === "text" ? p.value : p.action.label))
    .join("");
}

function reply(...parts: BriefingPart[]): AssistantReply {
  return { parts: withBriefingPartSpacing(parts) };
}

function wantsNavigationLink(q: string): boolean {
  return (
    q.includes("link me") ||
    q.includes("link to") ||
    q.includes("take me") ||
    q.includes("send me") ||
    q.includes("go to") ||
    q.includes("navigate") ||
    q.includes("open ") ||
    q.includes("show me") ||
    q.includes("where is") ||
    q.includes("get me to")
  );
}

const TEE_JOB_ID = "job-1-ggt148";

/** Client-side fallback when the assistant API is unreachable. */
export function buildClientAssistantFallbackSnapshot(
  userName: string,
  todayYmd: string,
  assistantPrefs: AssistantPrefs = DEFAULT_ASSISTANT_PREFS,
): AssistantOpsSnapshot {
  const contacts = loadContacts();
  const cStats = {
    total: contacts.length,
    clients: contacts.filter((c) => c.segment === "client").length,
    vendors: contacts.filter((c) => c.segment === "vendor").length,
    team: contacts.filter((c) => c.segment === "team").length,
  };
  const contactSnapshots: AssistantContactSnapshot[] = contacts.slice(0, 100).map((c) => ({
    id: c.id,
    segment: c.segment,
    name: c.name,
    email: c.email,
    kind: c.kind,
    company_code: c.company_code,
    ...(c.contact_name ? { contact_name: c.contact_name } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    ...(c.parent_company_id ? { parent_company_id: c.parent_company_id } : {}),
  }));
  const ctx = buildAssistantContext(todayYmd);
  return {
    userName,
    todayYmd,
    assistantPrefs,
    context: {
      ...ctx,
      contactCount: cStats.total,
      clientCount: cStats.clients,
      vendorCount: cStats.vendors,
      teamCount: cStats.team,
    },
    projects: [],
    jobs: [],
    contacts: contactSnapshots,
    joinedTeams: [],
    emailThreadRefs: MOCK_EMAIL_THREADS.map((t) => ({ id: t.id, subject: t.subject })),
    promptContext: formatAssistantPrefsForPrompt(assistantPrefs),
  };
}

/** Mock replies until real AI is wired — keyword routing over mock ops data. */
export function mockAssistantReply(query: string, snapshot: AssistantOpsSnapshot): AssistantReply {
  const ctx = snapshot.context;
  const contacts = snapshot.contacts;
  const q = query.trim().toLowerCase();
  if (!q) {
    return reply({
      type: "text",
      value: 'Ask me something — e.g. “Link me to messages” or “What’s late on Glo Gang?”',
    });
  }

  const voidStar = mockProjects.find((p) => p.name.toLowerCase().includes("void"));

  if (wantsNavigationLink(q)) {
    if (q.includes("anywhere") || q.includes("everything") || q.includes("all the")) {
      return reply(
        { type: "text", value: "Here are quick jumps: " },
        { type: "link", action: { kind: "messages", label: "Messages" } },
        { type: "text", value: " · " },
        { type: "link", action: { kind: "project", projectId: 1, label: "Glo Gang" } },
        { type: "text", value: " · " },
        {
          type: "link",
          action: { kind: "job", projectId: 1, jobId: TEE_JOB_ID, label: "NO HUMANS ALLOWED TEE" },
        },
        { type: "text", value: " · " },
        { type: "link", action: { kind: "production", label: "Production" } },
        { type: "text", value: " · " },
        { type: "link", action: { kind: "calendar", label: "Calendar" } },
        { type: "text", value: " · " },
        { type: "link", action: { kind: "people", label: "People" } },
        { type: "text", value: " · " },
        { type: "link", action: { kind: "documents", label: "Documents" } },
        { type: "text", value: "." },
      );
    }

    if (q.includes("document") || q.includes("file")) {
      return reply(
        { type: "text", value: "Files & invoices — " },
        { type: "link", action: { kind: "documents", label: "Open Documents" } },
        { type: "text", value: "." },
      );
    }

    if (
      q.includes("mailroom") ||
      q.includes("mail room") ||
      (q.includes("email") && !q.includes("message")) ||
      q.includes("gmail") ||
      (q.includes("inbox") && (q.includes("mail") || q.includes("exact") || q.includes("thread")))
    ) {
      const threads = snapshot.emailThreadRefs ?? [];
      const thread = findEmailThreadByQuery(threads, query);
      if (thread) {
        return reply(
          { type: "text", value: "Here's that Mailroom thread — " },
          {
            type: "link",
            action: { kind: "mailroom", threadId: thread.id, label: thread.subject },
          },
          { type: "text", value: "." },
        );
      }
      return reply(
        { type: "text", value: "Open Mailroom for Gmail threads — " },
        { type: "link", action: { kind: "mailroom", label: "Mailroom inbox" } },
        { type: "text", value: "." },
      );
    }

    if (
      (q.includes("message") || q.includes("chat") || q.includes("unread")) &&
      !q.includes("mailroom") &&
      !q.includes("mail room")
    ) {
      return reply(
        { type: "text", value: "Opening in-app Messages — " },
        { type: "link", action: { kind: "messages", label: "Go to Messages" } },
        {
          type: "text",
          value: ctx.unreadMessages
            ? ` (${ctx.unreadMessages} unread in team chat).`
            : ".",
        },
      );
    }

    if (q.includes("glo gang") || (q.includes("glo") && !q.includes("global"))) {
      if (q.includes("job") || q.includes("tee") || q.includes("humans")) {
        return reply(
          { type: "text", value: "Here’s that job — " },
          {
            type: "link",
            action: { kind: "job", projectId: 1, jobId: TEE_JOB_ID, label: "NO HUMANS ALLOWED TEE" },
          },
          { type: "text", value: " on " },
          { type: "link", action: { kind: "project", projectId: 1, label: "Glo Gang" } },
          { type: "text", value: "." },
        );
      }
      return reply(
        { type: "text", value: "Taking you to " },
        { type: "link", action: { kind: "project", projectId: 1, label: "Glo Gang project" } },
        { type: "text", value: "." },
      );
    }

    if (q.includes("void")) {
      return reply(
        { type: "text", value: "Void Star is here — " },
        {
          type: "link",
          action: {
            kind: "project",
            projectId: voidStar?.id ?? 3,
            label: voidStar?.name ?? "VOID STAR",
          },
        },
        { type: "text", value: " (due date flagged overdue)." },
      );
    }

    if (q.includes("production") || q.includes("wip") || q.includes("board")) {
      return reply(
        { type: "text", value: "Production board — " },
        { type: "link", action: { kind: "production", label: "Open Production" } },
        { type: "text", value: ` (${ctx.jobsInProgress} jobs in progress).` },
      );
    }

    if (q.includes("calendar") || q.includes("agenda") || q.includes("schedule")) {
      return reply(
        { type: "text", value: "Your schedule — " },
        { type: "link", action: { kind: "calendar", label: "Open Calendar" } },
        { type: "text", value: "." },
      );
    }

    if (q.includes("people") || q.includes("team") || q.includes("invite")) {
      return reply(
        { type: "text", value: "Team & invites — " },
        { type: "link", action: { kind: "people", label: "Open People" } },
        {
          type: "text",
          value: ctx.pendingInvites ? ` (${ctx.pendingInvites} pending).` : ".",
        },
      );
    }

    if (q.includes("project") || q.includes("projects")) {
      return reply(
        { type: "text", value: "All projects — " },
        { type: "link", action: { kind: "projects", label: "All projects" } },
        { type: "text", value: " · " },
        { type: "link", action: { kind: "project", projectId: 1, label: "Glo Gang" } },
        { type: "text", value: ` · ${ctx.projectCount} active in mock.` },
      );
    }

    if (q.includes("job") || q.includes("label") || q.includes("barcode")) {
      return reply(
        { type: "text", value: "Labels & job details — " },
        {
          type: "link",
          action: { kind: "job", projectId: 1, jobId: TEE_JOB_ID, label: "NO HUMANS ALLOWED TEE job" },
        },
        { type: "text", value: " or the full " },
        { type: "link", action: { kind: "production", label: "Production board" } },
        { type: "text", value: "." },
      );
    }

    if (q.includes("lnq")) {
      return reply(
        { type: "text", value: "LNQ project — " },
        { type: "link", action: { kind: "project", projectId: 2, label: "Open LNQ" } },
        { type: "text", value: "." },
      );
    }

    return reply(
      { type: "text", value: "Where should I send you? Try " },
      { type: "link", action: { kind: "messages", label: "Messages" } },
      { type: "text", value: ", " },
      { type: "link", action: { kind: "production", label: "Production" } },
      { type: "text", value: ", or say “link me anywhere” for all shortcuts." },
    );
  }

  if (q.includes("glo gang") || q.includes("glo")) {
    const jobs = getJobsForProject(1);
    const inProg = jobs.filter((j) => j.status === "In progress");
    return reply({
      type: "text",
      value: `Glo Gang has ${jobs.length} job${jobs.length === 1 ? "" : "s"}. ${
        inProg.length
          ? `In progress: ${inProg.map((j) => j.name).join(", ")}.`
          : "Nothing marked in progress right now."
      } Say “link me to Glo Gang” for a shortcut.`,
    });
  }

  if (q.includes("void")) {
    return reply({
      type: "text",
      value: "Void Star is past due on milestones. Say “link me to Void Star” to open the project.",
    });
  }

  if (q.includes("job") && (q.includes("production") || q.includes("progress") || q.includes("wip"))) {
    return reply(
      {
        type: "text",
        value: `There are ${ctx.jobsInProgress} jobs in progress (${ctx.jobCount} total). `,
      },
      { type: "link", action: { kind: "production", label: "Open Production" } },
      { type: "text", value: " for the full board." },
    );
  }

  const mailroomThread = findEmailThreadByQuery(snapshot.emailThreadRefs ?? [], query);
  if (
    mailroomThread &&
    (q.includes("mailroom") ||
      q.includes("mail room") ||
      q.includes("api usage") ||
      q.includes("usage limit") ||
      q.includes("openai") ||
      (q.includes("email") && q.includes("link")))
  ) {
    return reply(
      { type: "text", value: "That email is in Mailroom — " },
      {
        type: "link",
        action: { kind: "mailroom", threadId: mailroomThread.id, label: mailroomThread.subject },
      },
      { type: "text", value: "." },
    );
  }

  if (
    (q.includes("message") || q.includes("unread")) &&
    !q.includes("mailroom") &&
    !q.includes("mail room") &&
    !q.includes("gmail")
  ) {
    return reply(
      {
        type: "text",
        value: ctx.unreadMessages
          ? `You have ${ctx.unreadMessages} unread in team chat. `
          : "Team chat is clear. ",
      },
      { type: "link", action: { kind: "messages", label: "Open Messages" } },
      { type: "text", value: "." },
    );
  }

  if (
    q.includes("contact") ||
    q.includes("people") ||
    q.includes("team") ||
    q.includes("invite") ||
    q.includes("client") ||
    q.includes("vendor") ||
    q.includes("directory")
  ) {
    const total = ctx.contactCount ?? contacts.length;
    if (total === 0) {
      return reply(
        { type: "text", value: "Your People directory is empty. " },
        { type: "link", action: { kind: "people", label: "Open People" } },
        { type: "text", value: " to add clients, vendors, or team." },
      );
    }

    const segment =
      q.includes("vendor") ? "vendor" : q.includes("client") ? "client" : q.includes("team") ? "team" : null;
    const filtered = segment ? contacts.filter((c) => c.segment === segment) : contacts;
    const label = segment ? `${segment}s` : "contacts";

    if (filtered.length === 0) {
      return reply(
        { type: "text", value: `No ${label} in your directory yet. ` },
        { type: "link", action: { kind: "people", label: "Open People" } },
        { type: "text", value: "." },
      );
    }

    const listed = filtered.slice(0, 6);
    const parts: BriefingPart[] = [
      {
        type: "text",
        value: `You have ${filtered.length} ${label} (${total} total in People): `,
      },
    ];
    listed.forEach((c, i) => {
      if (i > 0) parts.push({ type: "text", value: ", " });
      parts.push({ type: "text", value: c.name });
      if (c.email) parts.push({ type: "text", value: ` (${c.email})` });
    });
    parts.push({ type: "text", value: ". " });
    parts.push({ type: "link", action: { kind: "people", label: "Open People" } });
    if (ctx.pendingInvites) {
      parts.push({
        type: "text",
        value: ` (${ctx.pendingInvites} pending invite${ctx.pendingInvites === 1 ? "" : "s"}).`,
      });
    } else {
      parts.push({ type: "text", value: "" });
    }
    return reply(...parts.filter((p) => p.type !== "text" || p.value.length > 0));
  }

  if (q.includes("today") || q.includes("calendar") || q.includes("agenda")) {
    return reply(
      { type: "text", value: "Shipping and production checkpoints today — " },
      { type: "link", action: { kind: "calendar", label: "Open Calendar" } },
      { type: "text", value: "." },
    );
  }

  if (q.includes("label") || q.includes("barcode")) {
    return reply(
      { type: "text", value: "Build labels on the job — " },
      {
        type: "link",
        action: { kind: "job", projectId: 1, jobId: TEE_JOB_ID, label: "NO HUMANS ALLOWED TEE" },
      },
      { type: "text", value: " (mobile station + stickers)." },
    );
  }

  return reply(
    {
      type: "text",
      value: `I can see ${ctx.projectCount} projects, ${ctx.jobCount} jobs, and ${ctx.contactCount ?? contacts.length} contacts. Try “link me to messages”, “who are my clients”, or “link me anywhere”.`,
    },
  );
}
