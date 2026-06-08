import { openAiChatJson } from "@/lib/openai/chat-completion";
import { normalizeAssistantBriefing } from "@/lib/openai/parse-assistant-parts";
import type { BriefingBlock } from "@/lib/mock/overview-briefing";
import type { AssistantOpsSnapshot } from "@/lib/server/assistant-ops-snapshot";

const BRIEFING_SCHEMA = `Return JSON:
{
  "blocks": [
    {
      "id": "intro",
      "parts": [
        { "type": "text", "value": "Good morning, NAME. Here's what's in your workspace:" },
        { "type": "link", "action": { "kind": "projects", "label": "Projects" } },
        { "type": "text", "value": " — 3 active." }
      ]
    }
  ]
}
Write 2-5 bullet blocks using ONLY data from Context. Never invent people, clients, or storylines.
You have access to everything listed in Context.coverage.sections (projects, jobs, contacts, in-app messages, email threads, documents, calendar). Never claim you lack access.
Do NOT use "while you were away" or fictional names.
Use link parts with action.kind (projects, jobs, mailroom, messages, calendar, people, production, documents). For emailThreads use mailroom + threadId — never messages for Gmail/Mailroom. Never put URLs or markdown in text.
Formatting: put a space after colons before a link or name (e.g. "in progress: " then link). For each project: link for the name, then a separate text part for status like " (PENDING)". Separate multiple projects with a text part ", " between them — never run names together.
If nothing needs attention, return one short greeting block inviting questions — do not list empty sections.
Honor userPreferences in Context — never mention sections the user asked to omit from briefings.`;

export async function overnightBriefingWithOpenAi(
  snapshot: AssistantOpsSnapshot,
): Promise<BriefingBlock[]> {
  const system = `You are the OnPro workspace assistant.
User: ${snapshot.userName}. Today: ${snapshot.todayYmd}.

Context:
${snapshot.promptContext}

${BRIEFING_SCHEMA}`;

  const raw = await openAiChatJson<unknown>(
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `Write ${snapshot.userName}'s workspace brief for the overview dashboard.`,
      },
    ],
    { temperature: 0.4 },
  );

  return normalizeAssistantBriefing(raw, snapshot);
}
