/** Sections the workspace brief ("Update me") can include or omit. All default to true. */
export type BriefingSection =
  | "projects"
  | "jobs"
  | "messages"
  | "contacts"
  | "mailroom"
  | "calendar"
  | "documents";

export type BriefingSectionPrefs = Partial<Record<BriefingSection, boolean>>;

/** Per-user OnPro AI preferences (`profiles.assistant_prefs`). */
export type AssistantPrefs = {
  /** When a section is false, omit it from the workspace brief unless the user asks in chat. */
  briefing?: BriefingSectionPrefs;
  /** Free-form rules the user asked the assistant to remember. */
  rules?: string[];
};

export const DEFAULT_BRIEFING_SECTIONS: Record<BriefingSection, boolean> = {
  projects: true,
  jobs: true,
  messages: true,
  contacts: true,
  mailroom: true,
  calendar: true,
  documents: true,
};

export const DEFAULT_ASSISTANT_PREFS: AssistantPrefs = {
  briefing: { ...DEFAULT_BRIEFING_SECTIONS },
  rules: [],
};
