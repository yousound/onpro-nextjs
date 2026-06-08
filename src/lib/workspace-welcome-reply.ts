import { withBriefingPartSpacing } from "@/lib/briefing-part-spacing";
import type { AssistantReply, BriefingLinkAction, BriefingPart } from "@/lib/mock/overview-briefing";
import {
  detectWorkspaceWelcomeIntents,
  type WorkspaceQuickActionId,
} from "@/lib/workspace-welcome-intent";

const INLINE_LINKS: { pattern: RegExp; action: BriefingLinkAction }[] = [
  {
    pattern: /create a new project/gi,
    action: { kind: "projects", label: "Create a new project" },
  },
  {
    pattern: /create a project/gi,
    action: { kind: "projects", label: "Create a new project" },
  },
  {
    pattern: /import (your )?clients?/gi,
    action: { kind: "people", label: "Import contacts" },
  },
  {
    pattern: /import contacts/gi,
    action: { kind: "people", label: "Import contacts" },
  },
  {
    pattern: /open (the )?people/gi,
    action: { kind: "people", label: "People" },
  },
  {
    pattern: /connect gmail/gi,
    action: { kind: "messages", label: "Connect Gmail", href: "/mailroom" },
  },
  {
    pattern: /open (the )?calendar/gi,
    action: { kind: "calendar", label: "Calendar" },
  },
  {
    pattern: /send invoices?/gi,
    action: { kind: "documents", label: "Documents & invoices" },
  },
];

function splitTextPart(value: string): BriefingPart[] {
  type Segment = { index: number; length: number; action: BriefingLinkAction };
  const segments: Segment[] = [];

  for (const { pattern, action } of INLINE_LINKS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(value)) !== null) {
      segments.push({ index: m.index, length: m[0].length, action });
    }
  }

  if (segments.length === 0) return [{ type: "text", value }];

  segments.sort((a, b) => a.index - b.index);
  const merged: Segment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && seg.index < last.index + last.length) continue;
    merged.push(seg);
  }

  const out: BriefingPart[] = [];
  let cursor = 0;
  for (const seg of merged) {
    if (seg.index > cursor) {
      const chunk = value.slice(cursor, seg.index);
      if (chunk) out.push({ type: "text", value: chunk });
    }
    out.push({ type: "link", action: seg.action });
    cursor = seg.index + seg.length;
  }
  if (cursor < value.length) {
    out.push({ type: "text", value: value.slice(cursor) });
  }
  return out;
}

/** Turn plain AI text into text + link parts (fixes mashed “progress.Create a new project”). */
export function enrichWelcomeAssistantReply(reply: AssistantReply): AssistantReply {
  const parts: BriefingPart[] = [];
  for (const part of reply.parts) {
    if (part.type === "link") {
      parts.push(part);
      continue;
    }
    parts.push(...splitTextPart(part.value));
  }
  return { parts: withBriefingPartSpacing(normalizeAdjacentText(parts)) };
}

function normalizeAdjacentText(parts: BriefingPart[]): BriefingPart[] {
  const out: BriefingPart[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      if (!part.value) continue;
      out.push(part);
      continue;
    }
    const last = out[out.length - 1];
    if (last?.type === "text" && last.value && !/\s$/.test(last.value)) {
      last.value += " ";
    }
    out.push(part);
  }
  return out;
}

export function welcomeAssistantFallback(userText: string): AssistantReply {
  const intents = detectWorkspaceWelcomeIntents(userText);

  if (intents.includes("project") && intents.includes("contacts")) {
    return {
      parts: [
        {
          type: "text",
          value:
            "Great plan for design clients — start by importing everyone, then spin up a project per client. When you're ready to bill, invoices live under Documents.",
        },
        { type: "text", value: " " },
        { type: "link", action: { kind: "people", label: "Import contacts" } },
        { type: "text", value: " · " },
        { type: "link", action: { kind: "projects", label: "Create a new project" } },
        { type: "text", value: "." },
      ],
    };
  }

  const byIntent: Record<WorkspaceQuickActionId, AssistantReply> = {
    project: {
      parts: [
        {
          type: "text",
          value: "Let's get a project set up — use the shortcut on the left or ",
        },
        { type: "link", action: { kind: "projects", label: "create a new project" } },
        { type: "text", value: " now." },
      ],
    },
    gmail: {
      parts: [
        {
          type: "text",
          value: "Connecting Gmail lets us learn your workflow and prep projects automatically — ",
        },
        { type: "link", action: { kind: "messages", label: "Connect Gmail", href: "/mailroom" } },
        { type: "text", value: "." },
      ],
    },
    contacts: {
      parts: [
        { type: "text", value: "Add clients and your team under People — " },
        { type: "link", action: { kind: "people", label: "Import contacts" } },
        { type: "text", value: "." },
      ],
    },
    calendar: {
      parts: [
        { type: "text", value: "Schedule production and client milestones on " },
        { type: "link", action: { kind: "calendar", label: "Calendar" } },
        { type: "text", value: "." },
      ],
    },
  };

  if (intents.length === 1) return byIntent[intents[0]!];

  return {
    parts: [
      {
        type: "text",
        value: "Tell me what you're trying to do — start a project, connect Gmail, add people, or schedule something. I'll highlight the right shortcuts on the left.",
      },
    ],
  };
}
