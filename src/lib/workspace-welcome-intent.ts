export type WorkspaceQuickActionId = "gmail" | "contacts" | "project" | "calendar";

const RULES: { id: WorkspaceQuickActionId; patterns: RegExp[] }[] = [
  {
    id: "gmail",
    patterns: [
      /\bgmail\b/,
      /\bconnect\b.*\b(inbox|email|mail)\b/,
      /\b(inbox|email|mailroom|mail)\b/,
    ],
  },
  {
    id: "contacts",
    patterns: [
      /\bimport\b.*\b(client|contact|team)\b/,
      /\b(client|vendor|contact|people)\b/,
      /\b(team|teammate|invite)\b/,
      /\badd\b.*\b(team|client)\b/,
    ],
  },
  {
    id: "project",
    patterns: [
      /\b(new|start|create|launch|open)\b.*\bproject\b/,
      /\bprojects?\b/,
      /\bcapsule\b/,
      /\bdrop\b/,
      /\bproduction run\b/,
      /\borganize\b/,
      /\binvoice\b/,
    ],
  },
  {
    id: "calendar",
    patterns: [
      /\bcalendar\b/,
      /\b(schedule|event|meeting|deadline)\b/,
    ],
  },
];

const ACTION_ORDER: WorkspaceQuickActionId[] = ["gmail", "contacts", "project", "calendar"];

/** All quick actions that match the message (stable display order). */
export function detectWorkspaceWelcomeIntents(text: string): WorkspaceQuickActionId[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const matched = new Set<WorkspaceQuickActionId>();
  for (const { id, patterns } of RULES) {
    if (patterns.some((p) => p.test(q))) matched.add(id);
  }
  return ACTION_ORDER.filter((id) => matched.has(id));
}

/** @deprecated Use detectWorkspaceWelcomeIntents — first match only. */
export function detectWorkspaceWelcomeIntent(text: string): WorkspaceQuickActionId | null {
  return detectWorkspaceWelcomeIntents(text)[0] ?? null;
}
