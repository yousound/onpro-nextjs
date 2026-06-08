import {
  findEmailThreadByQuery,
  labelLooksLikeMailroomEmail,
} from "@/lib/assistant-mailroom-links";
import { withBriefingPartSpacing } from "@/lib/briefing-part-spacing";
import type {
  AssistantReply,
  BriefingBlock,
  BriefingLinkAction,
  BriefingPart,
} from "@/lib/mock/overview-briefing";
import type { AssistantOpsSnapshot } from "@/lib/server/assistant-ops-snapshot";

const LINK_KINDS = new Set([
  "job",
  "project",
  "mailroom",
  "messages",
  "calendar",
  "people",
  "production",
  "projects",
  "documents",
]);

function projectIds(snapshot: AssistantOpsSnapshot): Set<number> {
  return new Set(snapshot.projects.map((p) => p.id));
}

function jobKeys(snapshot: AssistantOpsSnapshot): Set<string> {
  return new Set(snapshot.jobs.map((j) => `${j.project_id}:${j.id}`));
}

function emailThreadIds(snapshot: AssistantOpsSnapshot): Set<string> {
  return new Set(snapshot.emailThreadRefs.map((t) => t.id));
}

function resolveMailroomThreadId(
  snapshot: AssistantOpsSnapshot,
  raw: Record<string, unknown>,
  label: string,
): string | undefined {
  const explicit = String(raw.threadId ?? raw.thread_id ?? "").trim();
  if (explicit && emailThreadIds(snapshot).has(explicit)) return explicit;
  return findEmailThreadByQuery(snapshot.emailThreadRefs, label)?.id;
}

function normalizeLink(
  raw: Record<string, unknown>,
  snapshot: AssistantOpsSnapshot,
): BriefingPart {
  const kind = String(raw.kind ?? "");
  const label = sanitizeText(String(raw.label ?? "Open").trim() || "Open");

  if (!LINK_KINDS.has(kind)) {
    return { type: "text", value: label };
  }

  if (kind === "job") {
    const projectId = Number(raw.projectId ?? raw.project_id);
    const jobId = String(raw.jobId ?? raw.job_id ?? "");
    if (
      !Number.isFinite(projectId) ||
      !jobId ||
      !projectIds(snapshot).has(projectId) ||
      !jobKeys(snapshot).has(`${projectId}:${jobId}`)
    ) {
      return { type: "text", value: label };
    }
    return {
      type: "link",
      action: { kind: "job", projectId, jobId, label },
    };
  }

  if (kind === "project") {
    const projectId = Number(raw.projectId ?? raw.project_id);
    if (!Number.isFinite(projectId) || !projectIds(snapshot).has(projectId)) {
      return { type: "text", value: label };
    }
    return {
      type: "link",
      action: { kind: "project", projectId, label },
    };
  }

  if (kind === "mailroom") {
    const threadId = resolveMailroomThreadId(snapshot, raw, label);
    return { type: "link", action: { kind: "mailroom", label, threadId } };
  }

  if (kind === "messages") {
    const hrefRaw = raw.href ? String(raw.href) : undefined;
    if (hrefRaw?.startsWith("/mailroom") || labelLooksLikeMailroomEmail(label)) {
      const threadId = resolveMailroomThreadId(snapshot, raw, label);
      return { type: "link", action: { kind: "mailroom", label, threadId } };
    }
    const emailThread = findEmailThreadByQuery(snapshot.emailThreadRefs, label);
    if (emailThread) {
      return {
        type: "link",
        action: { kind: "mailroom", label, threadId: emailThread.id },
      };
    }
    const href = hrefRaw?.startsWith("/") ? hrefRaw : "/messages";
    return { type: "link", action: { kind: "messages", label, href } };
  }

  const nav = kind as Exclude<BriefingLinkAction["kind"], "job" | "project" | "messages" | "mailroom">;
  return { type: "link", action: { kind: nav, label } };
}

function sanitizeText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\((?:https?:\/\/[^)]*|\/[^)]*)\)/gi, "$1")
    .replace(/https?:\/\/example\.com[^\s)"]*/gi, "")
    .replace(/:(?![0-9\s/])/g, ": ")
    .replace(/(\S)\(/g, "$1 (")
    .replace(/\)(?=\S)/g, ") ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizePart(raw: unknown, snapshot: AssistantOpsSnapshot): BriefingPart | null {
  if (!raw || typeof raw !== "object") return null;
  const part = raw as Record<string, unknown>;
  const type = String(part.type ?? "");

  if (type === "text") {
    const value = sanitizeText(String(part.value ?? ""));
    return value ? { type: "text", value } : null;
  }

  if (type === "link" && part.action && typeof part.action === "object") {
    return normalizeLink(part.action as Record<string, unknown>, snapshot);
  }

  return null;
}

export function normalizeAssistantReply(
  raw: unknown,
  snapshot: AssistantOpsSnapshot,
): AssistantReply {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const partsRaw = Array.isArray(obj.parts) ? obj.parts : [];
  const parts: BriefingPart[] = [];

  for (const p of partsRaw) {
    const normalized = normalizePart(p, snapshot);
    if (normalized) parts.push(normalized);
  }

  if (parts.length === 0) {
    parts.push({
      type: "text",
      value: "I'm here to help with projects, jobs, and the team — try asking about what's late or say “link me to messages”.",
    });
  }

  return { parts: withBriefingPartSpacing(parts) };
}

export function normalizeAssistantBriefing(
  raw: unknown,
  snapshot: AssistantOpsSnapshot,
): BriefingBlock[] {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const blocksRaw = Array.isArray(obj.blocks) ? obj.blocks : [];
  const blocks: BriefingBlock[] = [];

  for (let i = 0; i < blocksRaw.length; i++) {
    const block = blocksRaw[i];
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const partsRaw = Array.isArray(b.parts) ? b.parts : [];
    const parts: BriefingPart[] = [];
    for (const p of partsRaw) {
      const normalized = normalizePart(p, snapshot);
      if (normalized) parts.push(normalized);
    }
    if (parts.length === 0) continue;
    blocks.push({
      id: String(b.id ?? `block-${i}`),
      parts: withBriefingPartSpacing(parts),
    });
  }

  if (blocks.length === 0) {
    return [];
  }

  return blocks;
}
