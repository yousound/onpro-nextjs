import type { ISODate } from "@/lib/types/project";

export type GeneratedItemKind =
  | "project"
  | "job"
  | "estimate"
  | "invoice"
  | "vendor_quote"
  | "costing_line"
  | "sample"
  | "packing_list"
  | "client_po"
  | "task";

export type EmailAttachment = {
  id: string;
  /** What kind of generated item this attachment references. */
  kind: GeneratedItemKind;
  /** Id of the GeneratedItem we're attaching (so we can deep-link on click). */
  source_id: string;
  /** Display label, e.g. "Estimate EST-2026-00012". */
  label: string;
  /** Optional in-app link to open the source entity. */
  deepLink?: string;
};

export type EmailMessage = {
  id: string;
  from: { name: string; email: string };
  at: ISODate;
  /** Plain text or simple Markdown. */
  body: string;
  /** Mock attachments — generated items referenced from this message. */
  attachments?: EmailAttachment[];
};

export type EmailThreadStatus = "unread" | "read" | "archived";

export type EmailThread = {
  id: string;
  subject: string;
  participants: { name: string; email: string }[];
  messages: EmailMessage[];
  status: EmailThreadStatus;
  related?: { project_id?: number; job_id?: string; vendor?: string };
  /** Optional Gmail-style category — used to colorize the inbox. */
  category?: "vendor_quote" | "client" | "shipping" | "internal" | "other";
  /** How this thread arrived. Defaults to "email" when omitted. */
  channel?: "email" | "in_app";
  /** When promoted from an in-app Messages conversation, the originating room id. */
  linked_message_conversation_id?: number;
};

export type AgentSuggestionKind =
  | "create_project"
  | "create_job"
  | "add_vendor_quote"
  | "add_costing_line"
  | "generate_estimate"
  | "create_invoice"
  | "update_client_po"
  | "update_sample_milestone"
  | "log_packing_list"
  | "team_note";

export type AgentSuggestionStatus = "pending" | "applied" | "dismissed";

export type AgentSuggestion = {
  id: string;
  thread_id: string;
  kind: AgentSuggestionKind;
  title: string;
  /** Free-form payload — shape depends on `kind`. Mock layer reads/writes as-is. */
  payload: Record<string, unknown>;
  status: AgentSuggestionStatus;
  created_at: ISODate;
};

export type GeneratedItem = {
  id: string;
  thread_id: string;
  kind: GeneratedItemKind;
  title: string;
  summary?: string;
  payload: Record<string, unknown>;
  /** Optional in-app deep link (e.g. /projects/2). */
  deepLink?: string;
  created_at: ISODate;
  source_suggestion_id?: string;
};

export type AgentChatRole = "user" | "agent" | "system";

export type AgentChatMessage = {
  id: string;
  thread_id: string;
  role: AgentChatRole;
  text: string;
  at: ISODate;
  /** Suggestion IDs surfaced inline with this message (rendered as proposal cards). */
  proposed_suggestion_ids?: string[];
};

export type MailroomState = {
  oauth_connected: boolean;
  connected_email: string | null;
  suggestion_status: Record<string, AgentSuggestionStatus>;
  thread_status: Record<string, EmailThreadStatus>;
  /** Generated action items (from applied suggestions). Filter by thread_id in views. */
  generated_items: GeneratedItem[];
  /** Per-thread chat history with the agent. */
  chat: Record<string, AgentChatMessage[]>;
  /** Custom/dynamic suggestions surfaced by the agent in chat (in addition to seeded ones). */
  custom_suggestions: AgentSuggestion[];
  /** Outbound replies the user sent from the mailroom, keyed by thread id (mock — no real SMTP). */
  outbox: Record<string, EmailMessage[]>;
  /** Threads the user has explicitly summarized via the agent. */
  summarized_threads: Record<string, boolean>;
  /** Threads created by promoting in-app conversations (and any custom-created Mailroom threads). */
  promoted_threads: EmailThread[];
  /** Reverse lookup: in-app conversation id → mailroom thread id. */
  message_links: Record<number, string>;
};
