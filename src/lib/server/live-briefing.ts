import { findEmailThreadByQuery, labelLooksLikeMailroomEmail } from "@/lib/assistant-mailroom-links";
import { briefingIncludesSection } from "@/lib/assistant/prefs";
import { withBriefingPartSpacing } from "@/lib/briefing-part-spacing";
import type { BriefingBlock, BriefingPart, AssistantReply } from "@/lib/mock/overview-briefing";
import { migrateProjectStatus } from "@/lib/project-status";
import type { AssistantOpsSnapshot } from "@/lib/server/assistant-ops-snapshot";

function text(value: string): BriefingPart {
  return { type: "text", value };
}

/** Briefing built only from live Supabase snapshot — no demo storylines. */
export function buildBriefingFromSnapshot(snapshot: AssistantOpsSnapshot): BriefingBlock[] {
  const { userName, todayYmd, projects, jobs, contacts, context, assistantPrefs } = snapshot;
  const includeProjects = briefingIncludesSection(assistantPrefs, "projects");
  const includeJobs = briefingIncludesSection(assistantPrefs, "jobs");
  const includeMessages = briefingIncludesSection(assistantPrefs, "messages");
  const includeContacts = briefingIncludesSection(assistantPrefs, "contacts");
  const contactCount = context.contactCount ?? contacts.length;
  const unreadMessages = context.unreadMessages ?? 0;

  const introParts: string[] = [];
  if (projects.length === 0) {
    introParts.push("No projects are in Supabase yet.");
  } else {
    const counts: string[] = [];
    if (includeProjects) {
      counts.push(`${projects.length} project${projects.length === 1 ? "" : "s"}`);
    }
    if (includeJobs) {
      counts.push(`${jobs.length} job${jobs.length === 1 ? "" : "s"}`);
    }
    if (includeMessages && unreadMessages > 0) {
      counts.push(`${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`);
    }
    if (includeContacts) {
      counts.push(`${contactCount} contact${contactCount === 1 ? "" : "s"}`);
    }
    introParts.push(
      counts.length === 0 ? "Your workspace is ready." : `${counts.join(", ")} from live data.`,
    );
  }
  const introTail = introParts.join(" ");

  const blocks: BriefingBlock[] = [
    {
      id: "intro",
      parts: [text(`Hi ${userName} — here's your workspace for ${todayYmd}. ${introTail}`)],
    },
  ];

  if (projects.length === 0) {
    blocks.push({
      id: "empty",
      parts: [
        text(
          "Add rows to the projects table in Supabase, or use the Mock toggle to explore the built-in demo.",
        ),
      ],
    });
    return blocks;
  }

  const overdue = projects.filter(
    (p) =>
      p.due_date &&
      p.due_date < todayYmd &&
      migrateProjectStatus(p.status) !== "Completed",
  );

  if (includeMessages && unreadMessages > 0) {
    blocks.push({
      id: "messages",
      parts: [
        text(`${unreadMessages} unread conversation${unreadMessages === 1 ? "" : "s"}. `),
        { type: "link", action: { kind: "messages", label: "Open Messages" } },
      ],
    });
  }

  if (includeProjects && overdue.length > 0) {
    blocks.push({
      id: "overdue",
      parts: [
        text(`${overdue.length} project${overdue.length === 1 ? "" : "s"} past due: `),
        ...overdue.slice(0, 4).flatMap((p, i) => [
          ...(i > 0 ? [text(", ")] : []),
          {
            type: "link" as const,
            action: { kind: "project" as const, projectId: p.id, label: p.name },
          },
          text(` (${p.status})`),
        ]),
      ],
    });
  }

  const inProgress = projects.filter((p) => {
    const status = migrateProjectStatus(p.status);
    return status === "Production" || status === "Intake" || status === "Development";
  });
  if (includeProjects && inProgress.length > 0) {
    blocks.push({
      id: "in-flight",
      parts: [
        text(`You have ${inProgress.length} project${inProgress.length === 1 ? "" : "s"} in progress: `),
        ...inProgress.slice(0, 5).flatMap((p, i) => [
          ...(i > 0 ? [text(", ")] : []),
          {
            type: "link" as const,
            action: { kind: "project" as const, projectId: p.id, label: p.name },
          },
          text(` (${p.status})`),
        ]),
      ],
    });
  }

  const activeJobs = jobs.filter((j) => j.status === "In progress");
  if (includeJobs && activeJobs.length > 0) {
    blocks.push({
      id: "jobs",
      parts: [
        text(`${activeJobs.length} job${activeJobs.length === 1 ? "" : "s"} in progress. Open Production to review lanes.`),
        { type: "link", action: { kind: "production", label: "Production board" } },
      ],
    });
  }

  if (includeContacts && contacts.length > 0) {
    const clients = contacts.filter((c) => c.segment === "client");
    if (clients.length > 0) {
      blocks.push({
        id: "contacts",
        parts: [
          text(`People — ${clients.length} client${clients.length === 1 ? "" : "s"}: `),
          ...clients.slice(0, 4).flatMap((c, i) => [
            ...(i > 0 ? [text(", ")] : []),
            { type: "text" as const, value: c.name },
          ]),
          text(". "),
          { type: "link", action: { kind: "people", label: "Open People" } },
        ],
      });
    }
  }

  const { joinedTeams } = snapshot;
  if (joinedTeams.length > 0) {
    blocks.push({
      id: "joined-teams",
      parts: [
        text(
          `You're on ${joinedTeams.length} workspace team${joinedTeams.length === 1 ? "" : "s"}: `,
        ),
        ...joinedTeams.slice(0, 4).flatMap((t, i) => [
          ...(i > 0 ? [text(", ")] : []),
          { type: "text" as const, value: t.workspaceName },
        ]),
        text(". "),
        { type: "link", action: { kind: "people", label: "See teams in Contacts" } },
      ],
    });
  }

  return blocks.map((block) => ({
    ...block,
    parts: withBriefingPartSpacing(block.parts),
  }));
}

/** Simple live-mode chat fallback when OpenAI is unavailable. */
export function liveAssistantReply(message: string, snapshot: AssistantOpsSnapshot): AssistantReply {
  const q = message.toLowerCase();
  const { projects, jobs, contacts, context, joinedTeams } = snapshot;

  if (
    q.includes("workspace") ||
    q.includes("which team") ||
    q.includes("what team") ||
    q.includes("part of") ||
    (q.includes("team") && (q.includes("member") || q.includes("joined") || q.includes("on")))
  ) {
    if (joinedTeams.length === 0) {
      return {
        parts: withBriefingPartSpacing([
          text("You're not linked to any operator workspaces yet. Accept a team invite or join from onboarding. "),
          { type: "link", action: { kind: "people", label: "Open Contacts" } },
        ]),
      };
    }
    return {
      parts: withBriefingPartSpacing([
        text(`You're on ${joinedTeams.length} workspace${joinedTeams.length === 1 ? "" : "s"}: `),
        ...joinedTeams.slice(0, 6).flatMap((t, i) => [
          ...(i > 0 ? [text(", ")] : []),
          { type: "text" as const, value: t.workspaceName },
        ]),
        text(". Open Contacts → Team to see the full list. "),
        { type: "link", action: { kind: "people", label: "Open Contacts" } },
      ]),
    };
  }

  if (
    q.includes("contact") ||
    q.includes("people") ||
    q.includes("client") ||
    q.includes("vendor") ||
    q.includes("team") ||
    q.includes("directory")
  ) {
    const total = context.contactCount ?? contacts.length;
    if (total === 0) {
      return {
        parts: withBriefingPartSpacing([
          text("Your People directory is empty in Supabase. "),
          { type: "link", action: { kind: "people", label: "Open People" } },
          text(" to add clients, vendors, or team."),
        ]),
      };
    }

    const segment =
      q.includes("vendor") ? "vendor" : q.includes("client") ? "client" : q.includes("team") ? "team" : null;
    const filtered = segment ? contacts.filter((c) => c.segment === segment) : contacts;
    const label = segment ?? "contact";

    const parts: BriefingPart[] = [
      text(
        `You have ${filtered.length} ${label}${filtered.length === 1 ? "" : "s"} (${total} total in People): `,
      ),
    ];
    filtered.slice(0, 8).forEach((c, i) => {
      if (i > 0) parts.push(text(", "));
      parts.push(text(c.name));
      if (c.email) parts.push(text(` (${c.email})`));
    });
    parts.push(text(". "));
    parts.push({ type: "link", action: { kind: "people", label: "Open People" } });

    return { parts: withBriefingPartSpacing(parts) };
  }

  if (q.includes("project")) {
    if (projects.length === 0) {
      return { parts: [text("There are no projects in your live Supabase workspace yet.")] };
    }
    return {
      parts: [
        text(`You have ${projects.length} live project${projects.length === 1 ? "" : "s"}: `),
        ...projects.slice(0, 6).flatMap((p, i) => [
          ...(i > 0 ? [text(", ")] : []),
          {
            type: "link" as const,
            action: { kind: "project" as const, projectId: p.id, label: p.name },
          },
          text(` (${p.status})`),
        ]),
      ],
    };
  }

  if (
    q.includes("email") ||
    q.includes("mail") ||
    q.includes("inbox") ||
    q.includes("gmail") ||
    q.includes("mailroom")
  ) {
    const thread = findEmailThreadByQuery(snapshot.emailThreadRefs, message);
    if (
      thread &&
      (q.includes("link") ||
        q.includes("open") ||
        q.includes("exact") ||
        q.includes("thread") ||
        q.includes("mailroom") ||
        labelLooksLikeMailroomEmail(message))
    ) {
      return {
        parts: withBriefingPartSpacing([
          text("Here's that Mailroom thread — "),
          {
            type: "link",
            action: { kind: "mailroom", threadId: thread.id, label: thread.subject },
          },
          text("."),
        ]),
      };
    }
    return {
      parts: withBriefingPartSpacing([
        text(
          snapshot.promptContext.includes('"connected": true')
            ? "Gmail is connected — recent inbox threads are in your assistant context. Open Mailroom for the full UI."
            : "Connect Gmail in Mailroom to sync inbox threads into assistant context.",
        ),
        { type: "link", action: { kind: "mailroom", label: "Mailroom" } },
      ]),
    };
  }

  if (q.includes("document") || q.includes("invoice") || q.includes("quote")) {
    return {
      parts: withBriefingPartSpacing([
        text(
          "Documents metadata is included in mock mode. In live mode, document files are not in Supabase yet — use the Documents page.",
        ),
        { type: "link", action: { kind: "documents", label: "Documents" } },
      ]),
    };
  }

  if (q.includes("job") || q.includes("production")) {
    return {
      parts: [
        text(
          jobs.length === 0
            ? "No jobs in live data yet — they come from the project_jobs table when migrated."
            : `${jobs.length} job${jobs.length === 1 ? "" : "s"} across your live projects.`,
        ),
        { type: "link", action: { kind: "production", label: "Open production" } },
      ],
    };
  }

  const summaryParts: string[] = ["Live mode — I can see"];
  if (briefingIncludesSection(snapshot.assistantPrefs, "projects")) {
    summaryParts.push(`${projects.length} projects`);
  }
  if (briefingIncludesSection(snapshot.assistantPrefs, "jobs")) {
    summaryParts.push(`${jobs.length} jobs`);
  }
  if (briefingIncludesSection(snapshot.assistantPrefs, "messages") && (context.unreadMessages ?? 0) > 0) {
    summaryParts.push(`${context.unreadMessages} unread messages`);
  }
  if (briefingIncludesSection(snapshot.assistantPrefs, "contacts")) {
    summaryParts.push(`${context.contactCount ?? contacts.length} contacts`);
  }
  const summary =
    summaryParts.length === 1
      ? "Live mode — OpenAI is unavailable right now. "
      : `${summaryParts.join(", ")}. `;

  return {
    parts: withBriefingPartSpacing([
      text(`${summary}OpenAI is unavailable right now; fix billing or quota for fuller AI answers.`),
      { type: "link", action: { kind: "projects", label: "Projects" } },
      text(" · "),
      { type: "link", action: { kind: "production", label: "Production" } },
    ]),
  };
}
