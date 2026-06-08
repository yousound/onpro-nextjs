import type {
  AssistantPrefs,
  BriefingSection,
  BriefingSectionPrefs,
} from "@/lib/types/assistant-prefs";
import {
  DEFAULT_ASSISTANT_PREFS,
  DEFAULT_BRIEFING_SECTIONS,
} from "@/lib/types/assistant-prefs";

const MAX_RULES = 24;
const MAX_RULE_LEN = 240;

const BRIEFING_SECTION_ORDER: BriefingSection[] = [
  "projects",
  "jobs",
  "messages",
  "contacts",
  "mailroom",
  "calendar",
  "documents",
];

const SECTION_LABELS: Record<BriefingSection, string> = {
  projects: "projects",
  jobs: "jobs / production",
  messages: "messages",
  contacts: "contacts / People",
  mailroom: "Mailroom / email",
  calendar: "calendar",
  documents: "documents",
};

const SECTION_KEYWORDS: Record<BriefingSection, RegExp> = {
  projects: /\b(?:projects?)\b/,
  jobs: /\b(?:jobs?|production(?:\s+board)?)\b/,
  messages: /\b(?:messages?|conversations?|chats?)\b/,
  contacts: /\b(?:contacts?|people|clients?|vendors?|team|directory|customers?)\b/,
  mailroom: /\b(?:mailroom|emails?|inbox|gmail|threads?)\b/,
  calendar: /\b(?:calendar|events?|schedule)\b/,
  documents: /\b(?:documents?|files?|invoices?|quotes?)\b/,
};

function normalizeBriefingSections(raw: unknown): BriefingSectionPrefs {
  const out: BriefingSectionPrefs = { ...DEFAULT_BRIEFING_SECTIONS };
  if (!raw || typeof raw !== "object") return out;

  for (const section of BRIEFING_SECTION_ORDER) {
    const value = (raw as Record<string, unknown>)[section];
    if (value === false) out[section] = false;
  }
  return out;
}

export function normalizeAssistantPrefs(raw: unknown): AssistantPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ASSISTANT_PREFS };

  const row = raw as Record<string, unknown>;
  const briefing = normalizeBriefingSections(row.briefing);

  // Legacy: briefing.includeContacts
  const legacyBriefing = row.briefing;
  if (
    legacyBriefing &&
    typeof legacyBriefing === "object" &&
    (legacyBriefing as Record<string, unknown>).includeContacts === false
  ) {
    briefing.contacts = false;
  }

  const rules: string[] = [];
  if (Array.isArray(row.rules)) {
    for (const item of row.rules) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim().slice(0, MAX_RULE_LEN);
      if (trimmed && !rules.includes(trimmed)) rules.push(trimmed);
      if (rules.length >= MAX_RULES) break;
    }
  }

  return { briefing, rules };
}

export function mergeAssistantPrefs(...sources: AssistantPrefs[]): AssistantPrefs {
  const briefing: BriefingSectionPrefs = { ...DEFAULT_BRIEFING_SECTIONS };
  const rules: string[] = [];

  for (const src of sources) {
    const n = normalizeAssistantPrefs(src);
    for (const section of BRIEFING_SECTION_ORDER) {
      if (n.briefing?.[section] === false) briefing[section] = false;
    }
    for (const rule of n.rules ?? []) {
      if (!rules.includes(rule)) rules.push(rule);
    }
  }

  return { briefing, rules: rules.slice(-MAX_RULES) };
}

export function briefingIncludesSection(
  prefs: AssistantPrefs,
  section: BriefingSection,
): boolean {
  const normalized = normalizeAssistantPrefs(prefs);
  return normalized.briefing?.[section] !== false;
}

/** @deprecated Use briefingIncludesSection(prefs, "contacts") */
export function briefingIncludesContacts(prefs: AssistantPrefs): boolean {
  return briefingIncludesSection(prefs, "contacts");
}

function omittedSections(prefs: AssistantPrefs): BriefingSection[] {
  const normalized = normalizeAssistantPrefs(prefs);
  return BRIEFING_SECTION_ORDER.filter((s) => normalized.briefing?.[s] === false);
}

export function formatAssistantPrefsForPrompt(prefs: AssistantPrefs): string {
  const lines: string[] = [];
  const omitted = omittedSections(prefs);

  for (const section of omitted) {
    lines.push(
      `- Workspace brief ("Update me" / overnight briefing): do NOT mention ${SECTION_LABELS[section]} — unless the user explicitly asks about them in chat.`,
    );
  }

  for (const rule of prefs.rules ?? []) {
    lines.push(`- ${rule}`);
  }

  if (lines.length === 0) {
    return 'Default workspace brief ("Update me") includes projects, jobs, and messages. Other sections (contacts, Mailroom, calendar, documents) may appear when relevant.';
  }

  return `Saved user preferences (honor strictly):\n${lines.join("\n")}`;
}

export type PreferenceUpdateResult = {
  prefs: AssistantPrefs;
  changed: boolean;
  acknowledgment: string | null;
};

function normalizeQuery(message: string): string {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function wantsHideFromBriefing(q: string): boolean {
  return (
    /\b(?:don'?t|do not|stop|never|skip|hide|omit|leave out|no longer|not)\b.*\b(?:show|include|mention|list|give|tell|display)\b/.test(
      q,
    ) ||
    /\b(?:stop|quit)\s+showing\b/.test(q) ||
    /\b(?:on|in|from)\s+(?:the\s+)?(?:update|brief(?:ing)?|workspace\s+brief)\b.*\b(?:don'?t|do not|skip|hide|omit|without|no)\b/.test(
      q,
    ) ||
    /\b(?:don'?t|do not|skip|hide|omit)\b.*\b(?:on|in|from)\s+(?:the\s+)?(?:update|brief(?:ing)?|workspace\s+brief)\b/.test(
      q,
    )
  );
}

function wantsShowInBriefing(q: string): boolean {
  return (
    /\b(?:show|include|mention|list|display|add)\b/.test(q) ||
    /\b(?:again|back)\b/.test(q)
  );
}

function mentionsSection(q: string, section: BriefingSection): boolean {
  return SECTION_KEYWORDS[section].test(q);
}

function detectBriefingSectionChange(
  q: string,
  hide: boolean,
): BriefingSection | null {
  const matches = BRIEFING_SECTION_ORDER.filter((s) => mentionsSection(q, s));
  if (matches.length !== 1) return null;
  if (hide && !wantsHideFromBriefing(q)) return null;
  if (!hide && !wantsShowInBriefing(q)) return null;
  return matches[0];
}

function setBriefingSection(
  prefs: AssistantPrefs,
  section: BriefingSection,
  include: boolean,
): AssistantPrefs {
  return {
    ...prefs,
    briefing: { ...normalizeBriefingSections(prefs.briefing), [section]: include },
  };
}

function isRememberRequest(q: string): boolean {
  return (
    /\b(?:remember|save|keep|store|note)\b/.test(q) ||
    /\b(?:don'?t|do not|never|stop|skip|hide|omit|prefer|always|from now on)\b/.test(q)
  );
}

function extractCustomRule(message: string): string | null {
  const trimmed = message.trim();
  if (trimmed.length < 12 || trimmed.length > MAX_RULE_LEN) return null;
  if (!isRememberRequest(normalizeQuery(trimmed))) return null;
  return trimmed;
}

function mergeRule(prefs: AssistantPrefs, rule: string): AssistantPrefs {
  const rules = [...(prefs.rules ?? [])];
  if (!rules.includes(rule)) rules.push(rule);
  return { ...prefs, rules: rules.slice(-MAX_RULES) };
}

function sectionChangeAcknowledgment(section: BriefingSection, include: boolean): string {
  const label = SECTION_LABELS[section];
  if (include) {
    return `Saved — I'll include ${label} in your workspace brief again when you use Update me.`;
  }
  return `Got it — I'll remember not to include ${label} in your workspace brief when you tap Update me. You can still ask about them anytime in chat.`;
}

/** Apply natural-language preference updates from a user chat message. */
export function applyPreferenceUpdatesFromMessage(
  message: string,
  current: AssistantPrefs,
): PreferenceUpdateResult {
  const q = normalizeQuery(message);
  let prefs = normalizeAssistantPrefs(current);
  let changed = false;
  let acknowledgment: string | null = null;

  const hideSection = detectBriefingSectionChange(q, true);
  if (hideSection && briefingIncludesSection(prefs, hideSection)) {
    prefs = setBriefingSection(prefs, hideSection, false);
    changed = true;
    acknowledgment = sectionChangeAcknowledgment(hideSection, false);
  } else {
    const showSection = detectBriefingSectionChange(q, false);
    if (showSection && !briefingIncludesSection(prefs, showSection)) {
      prefs = setBriefingSection(prefs, showSection, true);
      changed = true;
      acknowledgment = sectionChangeAcknowledgment(showSection, true);
    }
  }

  const customRule = extractCustomRule(message);
  if (customRule && !hideSection && !detectBriefingSectionChange(q, false)) {
    const before = prefs.rules?.length ?? 0;
    prefs = mergeRule(prefs, customRule);
    if ((prefs.rules?.length ?? 0) > before) {
      changed = true;
      acknowledgment = acknowledgment ?? "I'll remember that for future answers.";
    }
  }

  if (/\b(?:will you remember|did you remember|do you remember)\b/.test(q) && !changed) {
    const omitted = omittedSections(prefs);
    if (omitted.length > 0) {
      const labels = omitted.map((s) => SECTION_LABELS[s]).join(", ");
      acknowledgment = `Yes — I've saved that you don't want ${labels} in your workspace brief. Say "show ${labels.split(", ")[0]} on update again" anytime to change it.`;
    }
  }

  return { prefs, changed, acknowledgment };
}

export function prependAcknowledgment(
  text: string,
  acknowledgment: string | null,
): string {
  if (!acknowledgment) return text;
  if (text.toLowerCase().includes(acknowledgment.slice(0, 24).toLowerCase())) return text;
  return `${acknowledgment} ${text}`;
}
