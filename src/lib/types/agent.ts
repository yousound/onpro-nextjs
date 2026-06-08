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

export type EmailInlineImage = {
  id: string;
  mimeType: string;
  /** data: URL built from Gmail MIME body. */
  src: string;
  filename?: string;
};

export type EmailMessage = {
  id: string;
  from: { name: string; email: string };
  at: ISODate;
  /** Plain text or simple Markdown. */
  body: string;
  /** Inline images from Gmail MIME parts (Live inbox). */
  inlineImages?: EmailInlineImage[];
  /** Mock attachments — generated items referenced from this message. */
  attachments?: EmailAttachment[];
};

export type EmailThreadStatus = "unread" | "read" | "archived";

export type EmailThread = {
  id: string;
  subject: string;
  participants: { name: string; email: string; avatarUrl?: string | null }[];
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
  | "update_project"
  | "create_order"
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

export type MailroomThreadIntent =
  | "new_client_rfq"
  | "existing_project_update"
  | "vendor_inbound"
  | "other";

export type MailroomProjectMatchConfidence = "high" | "low" | "none";

export type MailroomProjectMatch = {
  project_id?: number;
  confidence: MailroomProjectMatchConfidence;
  reason: string;
};

export type WorkflowStepStatus = "pending" | "applied" | "skipped";

export type MailroomAutoContact = {
  name?: string;
  email?: string;
  company?: string;
};

export type MailroomWorkflowStep = {
  step_id: string;
  kind: AgentSuggestionKind;
  title: string;
  payload: Record<string, unknown>;
  depends_on?: string[];
  auto_contact?: MailroomAutoContact;
  /** Links to a row in custom_suggestions / suggestion_status. */
  suggestion_id: string;
  status: WorkflowStepStatus;
  applied_project_id?: number;
  applied_job_id?: string;
};

export type MailroomWorkflow = {
  thread_id: string;
  thread_intent: MailroomThreadIntent;
  project_match: MailroomProjectMatch;
  /** When set, later steps target this project instead of creating one. */
  link_existing_project_id?: number | null;
  steps: MailroomWorkflowStep[];
  created_at: ISODate;
};

/** Human-confirmed RFQ spine before running create_project / order / jobs. */
export type MailroomRfqParticipantRole = "team" | "vendor";

export type MailroomRfqIntake = {
  client_name: string;
  client_po: string;
  client_po_tbd: boolean;
  project_name: string;
  due_date: string | null;
  /** Team member on this thread (operator workspace), from People when possible. */
  team_contact_name: string | null;
  team_contact_email: string | null;
  vendor_name: string | null;
  /** Per-email role overrides when thread heuristics are wrong. */
  participant_role_overrides?: Record<string, MailroomRfqParticipantRole>;
  create_order: boolean;
  confirmed_at: ISODate | null;
};

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
  /** Dismissed suggestion IDs — excluded from UI (seeded suggestions are re-derived each load). */
  removed_suggestion_ids?: string[];
  /** Outbound replies the user sent from the mailroom, keyed by thread id (mock — no real SMTP). */
  outbox: Record<string, EmailMessage[]>;
  /** Threads the user has explicitly summarized via the agent. */
  summarized_threads: Record<string, boolean>;
  /** Agent-written summary text per thread (from Summarize / Regenerate). */
  thread_summaries: Record<string, string>;
  /** Threads created by promoting in-app conversations (and any custom-created Mailroom threads). */
  promoted_threads: EmailThread[];
  /** Reverse lookup: in-app conversation id → mailroom thread id. */
  message_links: Record<number, string>;
  /** Multi-step workflow plans keyed by thread id. */
  workflows: Record<string, MailroomWorkflow>;
  /** Confirmed RFQ intake per thread (new_client_rfq). */
  rfq_intake?: Record<string, MailroomRfqIntake>;
  /** User opened the RFQ confirm sheet (opt-in before running workflow). */
  rfq_plan_panel_open?: Record<string, boolean>;
  /** User opened the workflow plan modal (steps and tasks over the conversation). */
  workflow_plan_panel_open?: Record<string, boolean>;
  /** Next summarize must bypass server cache (set by Clear AI results). */
  mailroom_fresh_summarize?: Record<string, boolean>;
};
