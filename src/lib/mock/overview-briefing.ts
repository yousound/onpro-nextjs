import { mockCalendarEvents } from "@/lib/mock/calendar-events";
import { getConversations } from "@/lib/mock/conversations";
import { mockDocuments } from "@/lib/mock/documents";
import { getJobsForProject } from "@/lib/mock/project-jobs";
import { getProjectById, mockProjects } from "@/lib/mock/projects";
import { buildOverviewDigest } from "@/lib/mock/overview-digest";

export type BriefingLinkAction =
  | { kind: "job"; projectId: number; jobId: string; label: string }
  | { kind: "project"; projectId: number; label: string }
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

/** Plain-language overnight summary with linkable entities (mock — future AI). */
export function buildOvernightBriefing(userName: string, todayYmd: string): BriefingBlock[] {
  const digest = buildOverviewDigest(todayYmd);
  const gloGang = getProjectById(1);
  const voidStar = mockProjects.find((p) => p.name.toLowerCase().includes("void"));
  const teeJob = getJobsForProject(1).find((j) => j.id === "job-1-ggt148");
  const unread = getConversations().find((c) => (c.unread_count ?? 0) > 0);
  const recentDoc = [...mockDocuments].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];
  const nextEvent = [...mockCalendarEvents].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )[0];

  const blocks: BriefingBlock[] = [
    {
      id: "intro",
      parts: [
        {
          type: "text",
          value: `Here's what happened while you were away, ${userName}. Nothing critical is blocked, but a few threads need your eyes:`,
        },
      ],
    },
  ];

  if (unread && teeJob) {
    blocks.push({
      id: "message-job",
      parts: [
        { type: "text", value: "• " },
        { type: "link", action: { kind: "messages", label: "John from Glo Gang", href: "/messages" } },
        { type: "text", value: " left a message overnight about " },
        {
          type: "link",
          action: {
            kind: "job",
            projectId: 1,
            jobId: teeJob.id,
            label: teeJob.name,
          },
        },
        {
          type: "text",
          value: ` — they're waiting on strike-off before bulk (${unread.unread_count} unread in that room).`,
        },
      ],
    });
  }

  if (voidStar) {
    blocks.push({
      id: "overdue",
      parts: [
        { type: "text", value: "• " },
        {
          type: "link",
          action: { kind: "project", projectId: voidStar.id, label: voidStar.name },
        },
        { type: "text", value: " slipped past its due date — milestones should be updated or the date pushed." },
      ],
    });
  }

  if (recentDoc) {
    blocks.push({
      id: "doc",
      parts: [
        { type: "text", value: "• " },
        { type: "text", value: `${recentDoc.uploaded_by} uploaded ` },
        { type: "text", value: `"${recentDoc.name}"` },
        { type: "text", value: ` for ${recentDoc.project_name ?? "a project"}.` },
      ],
    });
  }

  if (gloGang && nextEvent) {
    blocks.push({
      id: "calendar",
      parts: [
        { type: "text", value: "• Your calendar has " },
        { type: "link", action: { kind: "calendar", label: nextEvent.name } },
        { type: "text", value: " coming up — ex-factory timing for Glo Gang." },
      ],
    });
  }

  if (digest.pendingInvites > 0) {
    blocks.push({
      id: "invites",
      parts: [
        { type: "text", value: "• " },
        {
          type: "link",
          action: {
            kind: "people",
            label: `${digest.pendingInvites} pending team invite${digest.pendingInvites === 1 ? "" : "s"}`,
          },
        },
        { type: "text", value: " still need a response." },
      ],
    });
  }

  blocks.push({
    id: "cta",
    parts: [
      {
        type: "text",
        value: " Ask me about any project, job, vendor, or person — I'll pull from everything in OnPro.",
      },
    ],
  });

  return blocks;
}

export type AssistantContext = {
  projectCount: number;
  jobCount: number;
  jobsInProgress: number;
  unreadMessages: number;
  pendingInvites: number;
};

export function buildAssistantContext(todayYmd: string): AssistantContext {
  const d = buildOverviewDigest(todayYmd);
  return {
    projectCount: mockProjects.length,
    jobCount: d.totalJobs,
    jobsInProgress: d.jobsInProgressCount,
    unreadMessages: d.totalUnreadMessages,
    pendingInvites: d.pendingInvites,
  };
}

export type AssistantReply = {
  parts: BriefingPart[];
};

export function assistantReplyPlain(reply: AssistantReply): string {
  return reply.parts.map((p) => (p.type === "text" ? p.value : p.action.label)).join("");
}

function reply(...parts: BriefingPart[]): AssistantReply {
  return { parts };
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

/** Mock replies until real AI is wired — keyword routing over mock ops data. */
export function mockAssistantReply(query: string, ctx: AssistantContext): AssistantReply {
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

    if (q.includes("message") || q.includes("chat") || q.includes("inbox") || q.includes("unread")) {
      return reply(
        { type: "text", value: "Opening your inbox — " },
        { type: "link", action: { kind: "messages", label: "Go to Messages" } },
        {
          type: "text",
          value: ctx.unreadMessages
            ? ` (${ctx.unreadMessages} unread; Glo Gang is the hot thread).`
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

  if (q.includes("message") || q.includes("unread")) {
    return reply(
      {
        type: "text",
        value: ctx.unreadMessages
          ? `You have ${ctx.unreadMessages} unread. `
          : "Inbox is clear. ",
      },
      { type: "link", action: { kind: "messages", label: "Open Messages" } },
      { type: "text", value: "." },
    );
  }

  if (q.includes("team") || q.includes("people") || q.includes("invite")) {
    return reply(
      {
        type: "text",
        value: ctx.pendingInvites
          ? `${ctx.pendingInvites} pending invite${ctx.pendingInvites === 1 ? "" : "s"}. `
          : "No pending invites. ",
      },
      { type: "link", action: { kind: "people", label: "Open People" } },
      { type: "text", value: "." },
    );
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
      value: `I can scan ${ctx.projectCount} projects and ${ctx.jobCount} jobs. Try “link me to messages” or “link me anywhere”.`,
    },
  );
}
