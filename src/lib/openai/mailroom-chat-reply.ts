import { normalizeEmailBody } from "@/lib/email-body";
import { openAiChatJson } from "@/lib/openai/chat-completion";
import type { AgentSuggestionKind } from "@/lib/types/agent";

const SUGGESTION_KINDS: AgentSuggestionKind[] = [
  "create_project",
  "update_project",
  "create_order",
  "create_job",
  "add_vendor_quote",
  "add_costing_line",
  "generate_estimate",
  "create_invoice",
  "update_client_po",
  "update_sample_milestone",
  "log_packing_list",
  "team_note",
];

type LlmMailroomChatResult = {
  reply: string;
  propose_suggestion?: {
    kind?: AgentSuggestionKind;
    title?: string;
    payload?: Record<string, unknown>;
  } | null;
};

export type MailroomChatReplyResult = {
  reply: string;
  proposeSuggestion: {
    kind: AgentSuggestionKind;
    title: string;
    payload: Record<string, unknown>;
  } | null;
};

export async function mailroomChatReplyWithOpenAi(opts: {
  threadSubject: string;
  threadId: string;
  scanSummary: string;
  scanContext: string;
  workspaceContext?: string;
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  pendingSuggestionTitles: string[];
}): Promise<MailroomChatReplyResult> {
  const pending =
    opts.pendingSuggestionTitles.length > 0
      ? `Pending suggestions already shown to the user: ${opts.pendingSuggestionTitles.join("; ")}`
      : "No pending suggestions on the panel yet.";

  const historyBlock =
    opts.history.length > 0
      ? opts.history
          .slice(-12)
          .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.text}`)
          .join("\n")
      : "(no prior chat)";

  const system = `You are the OnPro Mailroom agent in a side chat while the user reads an email thread.
The user already ran Summarize on this thread. Use ONLY the stored scan below — do not invent email content.
Return JSON only:
{
  "reply": "1-4 sentences, conversational",
  "propose_suggestion": null | { "kind": "<kind>", "title": "short label", "payload": {} }
}

Allowed kinds: ${JSON.stringify(SUGGESTION_KINDS)}.

Rules:
- Answer questions in plain language. Do NOT set propose_suggestion when the user is only asking (e.g. "are there tasks?", "should we…?", "is there anything for the client?").
- Mentioning "task", "client", or "todo" in a question is NOT a request to create one.
- Set propose_suggestion only when the user clearly asks you to create/draft/add/generate/remind/log something.
- Prefer null propose_suggestion; at most one per turn.
- If pending suggestions already cover the ask, say so in reply and keep propose_suggestion null.
- "go ahead" / "apply" / "yes" / "confirm" means apply existing pending suggestion cards — reply briefly that you'll apply them; propose_suggestion must be null.
- When workspace context shows a linked project, updates (update_project, update_client_po, log_packing_list, milestones, quotes) must target that project: include project_id and job_id in payload when known.
- log_packing_list with an existing packing list: set payload update_existing true and variant (products_go | shipper | basic) — do not imply creating a second list unless the user asks for a new one.
- update_project only for renames or field fixes on an existing project (payload name / project_name, project_id). Never use update_project to create a new project.`;

  const raw = await openAiChatJson<LlmMailroomChatResult>(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Thread: ${opts.threadSubject} (id=${opts.threadId})
Agent summary from Summarize: ${opts.scanSummary}

Workspace linked to this thread (from Mailroom apply / workflow):
${opts.workspaceContext?.trim() || "No linked project yet."}

Stored scan (from Summarize — do not re-read the live inbox):
${opts.scanContext}

---
${pending}

Chat so far:
${historyBlock}

Latest user message:
${opts.message}`,
      },
    ],
    { temperature: 0.35 },
  );

  const reply =
    typeof raw.reply === "string" && raw.reply.trim()
      ? normalizeEmailBody(raw.reply.trim())
      : "I'm here — ask about this thread or tell me what you'd like drafted.";

  const ps = raw.propose_suggestion;
  if (!ps?.kind || !SUGGESTION_KINDS.includes(ps.kind)) {
    return { reply, proposeSuggestion: null };
  }

  return {
    reply,
    proposeSuggestion: {
      kind: ps.kind,
      title: ps.title?.trim() || `Suggested ${ps.kind}`,
      payload: ps.payload && typeof ps.payload === "object" ? ps.payload : {},
    },
  };
}
