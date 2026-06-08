import { normalizeEmailBody } from "@/lib/email-body";
import { buildWorkflowFromLlmResponse } from "@/lib/mailroom/workflow-utils";
import { mailroomThreadContextForPrompt } from "@/lib/server/assistant-prompt-trim";
import {
  buildMailroomWorkspaceSnapshot,
  workspaceSnapshotForPrompt,
} from "@/lib/server/mailroom-workspace-snapshot";
import { getOpenAiApiKey, getOpenAiModel } from "@/lib/openai/env";
import type { AgentSuggestion, AgentSuggestionKind, EmailThread, MailroomWorkflow } from "@/lib/types/agent";

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

const SYSTEM = `You are the OnPro mailroom agent for a custom product fulfillment company.
Read the email thread and return JSON only (no markdown fences).

Schema:
{
  "summary": "2-4 sentences for ops staff",
  "thread_intent": "new_client_rfq" | "existing_project_update" | "vendor_inbound" | "other",
  "project_match": {
    "project_id": number or omit,
    "confidence": "high" | "low" | "none",
    "reason": "why this project matches or not"
  },
  "workflow": [
    {
      "step_id": "unique slug e.g. project, job-tee-1",
      "kind": one of ${JSON.stringify(SUGGESTION_KINDS)},
      "title": "short actionable label",
      "payload": { flat scalar fields only — strings, numbers, booleans },
      "depends_on": ["step_id of prior steps"],
      "auto_contact": { "name", "email", "company" } // only on create_project when client may be new
    }
  ]
}

Rules:
- Order workflow steps so dependencies run first (create_project before create_order before create_job before quotes/estimates).
- Client RFQ with multiple styles (quote request FROM a client): use create_project then create_order then one create_job per style (up to 6 jobs), then team_note or generate_estimate. Do NOT start with add_vendor_quote.
- add_vendor_quote only when email is FROM a vendor with pricing, or as a late outbound placeholder after jobs exist.
- Never treat finishing notes like "101 Supplied" or "CD Supplied" as vendor company names.
- Use flat payload fields: qty as number, colors as string, print_notes as string — never nested objects.
- Match existing projects from workspace context when subject/body references them; set project_match.confidence high only when clearly the same project.
- If project_match.confidence is high, omit create_project and start with create_job or updates targeting that project.
- Include auto_contact on create_project when the end-customer brand may not exist in workspace clients list.
- create_project payload "client" must be the END CUSTOMER BRAND (e.g. "ZOE Conference" from subject PO#ZOE260104), NOT Connect Dots / @connectdots.la — those are the operator workspace handling the RFQ.
- Parse client PO from the Subject line when present (e.g. Subject "PO#ZOE260104 - …" → payload client_po_number: "ZOE260104"). Always read Subject before inferring client or PO.
- Email FROM @connectdots.la TO a production vendor is still an inbound client RFQ: the brand in the subject/body (ZOE) is the client.
- auto_contact.company must match the brand client name, not Connect Dots.
- Never put @connectdots.la / Connect Dots staff emails in auto_contact.email — omit email if only the operator forwarded the RFQ.
- Maximum 10 workflow steps.
- Sample / fit-comment threads (style ref like BAU01, product name in subject): set create_project name to the product line (e.g. "Born Again Boxer Shorts"), not "New project". create_job title may include the ref prefix (e.g. "BAU01 Born Again Boxer Shorts").
- When create_project is needed, payload name and project_name must match the product line from subject or jobs — never literal "New project" or client "New client".`;

export async function summarizeThreadWithOpenAi(
  thread: EmailThread,
): Promise<{ summary: string; suggestions: AgentSuggestion[]; workflow: MailroomWorkflow | null }> {
  const snapshot = await buildMailroomWorkspaceSnapshot();
  const workspaceBlock = workspaceSnapshotForPrompt(snapshot);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${workspaceBlock}\n\n---\n\nEmail thread:\n${mailroomThreadContextForPrompt(thread)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  const now = new Date().toISOString();
  const { workflow, suggestions } = buildWorkflowFromLlmResponse(thread.id, parsed, now);

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? normalizeEmailBody(parsed.summary.trim())
      : `Summarized thread “${thread.subject}”.`;

  return { summary, suggestions, workflow };
}
