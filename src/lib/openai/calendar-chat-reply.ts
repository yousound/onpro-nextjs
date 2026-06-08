import { openAiChatJson } from "@/lib/openai/chat-completion";
import type { CalendarEventContext } from "@/lib/calendar-event-snapshot";

export type CalendarChatProposal = {
  title: string;
  event_patch?: Record<string, unknown>;
  project_patch?: Record<string, unknown>;
  project_id?: number;
};

type LlmCalendarChatResult = {
  reply: string;
  propose_update?: CalendarChatProposal | null;
};

export type CalendarChatReplyResult = {
  reply: string;
  proposeUpdate: CalendarChatProposal | null;
};

const ALLOWED_EVENT_KEYS = [
  "name",
  "description",
  "date",
  "start_time",
  "end_time",
  "event_type",
  "delivery_by",
  "shipped_from",
  "shipped_to",
  "type_of_product",
  "po",
  "invoice",
  "notes",
  "department",
  "link_to_client",
] as const;

const ALLOWED_PROJECT_KEYS = [
  "shipping_method",
  "shipping_terms",
  "tracking_bol_number",
  "packing_list_received_date",
  "packing_list_sent_to_client_date",
  "ex_factory_date",
  "bulk_target_delivery_date",
  "client_received_date",
  "po_number",
  "project_number",
  "status_overview",
  "lead_vendor",
  "status",
] as const;

function filterPatch(
  raw: Record<string, unknown> | undefined,
  allowed: readonly string[],
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in raw && raw[key] !== undefined) out[key] = raw[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function calendarChatReplyWithOpenAi(opts: {
  context: CalendarEventContext;
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
  pendingProposalTitles: string[];
}): Promise<CalendarChatReplyResult> {
  const pending =
    opts.pendingProposalTitles.length > 0
      ? `Pending apply cards: ${opts.pendingProposalTitles.join("; ")}`
      : "No pending apply cards.";

  const historyBlock =
    opts.history.length > 0
      ? opts.history
          .slice(-12)
          .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.text}`)
          .join("\n")
      : "(no prior chat)";

  const system = `You are the OnPro Calendar assistant. The user is viewing one calendar event and may link it to a project.
Use ONLY Context JSON — do not invent shipping, carrier, PO, or job facts.

Return JSON only:
{
  "reply": "1-5 sentences, helpful and specific",
  "propose_update": null | {
    "title": "short label for Apply button",
    "event_patch": { optional fields },
    "project_patch": { optional fields },
    "project_id": number when updating a project
  }
}

Allowed event_patch keys: ${JSON.stringify(ALLOWED_EVENT_KEYS)}
Allowed project_patch keys: ${JSON.stringify(ALLOWED_PROJECT_KEYS)}
event_type must be one of: shipping, meeting, deadline, sample_review, production, other
Dates/times: use ISO 8601 (start_time/end_time full ISO; date as YYYY-MM-DD)

Rules:
- When the user asks to scan, summarize, or "what shipping/carrier/job info" — answer in reply from linked_project and jobs; propose_update null unless they ask to fill/apply/update.
- Set propose_update when they clearly want fields written (e.g. "add shipping for 11am pickup", "fill carrier from project", "set tracking to …", "update event PO").
- Pull values from linked_project when filling event shipping fields (delivery_by ← shipping_method, etc.) when data exists.
- At most one propose_update per turn. Prefer null.
- If no linked_project, say so and only patch event fields the user specified.
- Mention which project you used when linked_project is set.`;

  const raw = await openAiChatJson<LlmCalendarChatResult>(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Context:
${JSON.stringify(opts.context, null, 2)}

${pending}

Chat:
${historyBlock}

User:
${opts.message}`,
      },
    ],
    { temperature: 0.35 },
  );

  const ps = raw.propose_update;
  if (!ps?.title?.trim()) {
    return { reply: raw.reply?.trim() || "Done.", proposeUpdate: null };
  }

  const event_patch = filterPatch(ps.event_patch, ALLOWED_EVENT_KEYS);
  const project_patch = filterPatch(ps.project_patch, ALLOWED_PROJECT_KEYS);
  const project_id =
    typeof ps.project_id === "number"
      ? ps.project_id
      : typeof opts.context.linked_project?.id === "number"
        ? (opts.context.linked_project.id as number)
        : undefined;

  if (!event_patch && !project_patch) {
    return { reply: raw.reply?.trim() || "Done.", proposeUpdate: null };
  }

  return {
    reply: raw.reply?.trim() || "Ready to apply.",
    proposeUpdate: {
      title: ps.title.trim(),
      event_patch,
      project_patch,
      project_id,
    },
  };
}
