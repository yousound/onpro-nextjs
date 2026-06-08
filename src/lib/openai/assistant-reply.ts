import { openAiChatJson } from "@/lib/openai/chat-completion";
import { normalizeAssistantReply } from "@/lib/openai/parse-assistant-parts";
import type { AssistantReply } from "@/lib/mock/overview-briefing";
import type { AssistantOpsSnapshot } from "@/lib/server/assistant-ops-snapshot";

const LINK_SCHEMA = `Each reply is JSON: { "parts": [ { "type": "text", "value": "..." }, { "type": "link", "action": { "kind": "project"|"job"|"mailroom"|"messages"|"calendar"|"people"|"production"|"projects"|"documents", "label": "...", "projectId"?: number, "jobId"?: string, "threadId"?: string } } ] }
Use links when pointing the user somewhere. Only use projectId/jobId/threadId from Context.
emailThreads.threads[] are Gmail/Mailroom emails — link with kind "mailroom" and threadId from that thread (never "messages" for those).
kind "messages" is ONLY for in-app chat (route /messages), not Mailroom/Gmail.
When citing a specific email, always include threadId so the user lands on that thread in Mailroom.
Keep replies concise (1-4 sentences). When listing projects: link per name, text part for status like " (PENDING)", comma between items, space after colons before lists.`;

export async function assistantReplyWithOpenAi(
  message: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
  snapshot: AssistantOpsSnapshot,
): Promise<AssistantReply> {
  const system = `You are the OnPro assistant for a custom product fulfillment ops team.
User: ${snapshot.userName}. Today: ${snapshot.todayYmd}.

You have read access to the workspace snapshot in Context (see coverage.sections). This includes:
- projects & jobs (including WIP timeline steps in progress)
- contacts / People (clients, vendors, team)
- inAppMessages (in-app chat threads, bodies, sent attachments) when present
- emailThreads.scannedThreads (only Mailroom threads you summarized — use mailroom links with threadId; inbox is not auto-scanned)
- inAppMessages (in-app team chat only — use messages links)
- documents (metadata) and calendar (events) when present
Answer using ONLY Context data. Check coverage first. NEVER say you lack access — if a section is empty, explain per coverage and link to the app route.
When clientJobsOverlay is present in Context, use those job rows (browser session) even if the base jobs list looks empty.
If the user asks to move/split/remove jobs into a new project (e.g. move BAU jobs off ZOE Conference into a BAU Boxers project), list the matching jobs you see and tell them to pick the source project on the action card (suggested projects are highlighted), then confirm — do not claim zero jobs when clientJobsOverlay lists them.
If the user asks to create a new project, tell them to confirm on the action card — you cannot create data yourself; the app applies changes after they confirm.
Honor userPreferences in Context. If the user asks to change what you show in briefings or to remember a preference, confirm you saved it (preferences are persisted server-side when they use phrases like "don't show contacts on update").

Context:
${snapshot.promptContext}

${LINK_SCHEMA}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    ...history.slice(-24).map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: message },
  ];

  const raw = await openAiChatJson<unknown>(messages, { temperature: 0.35 });
  return normalizeAssistantReply(raw, snapshot);
}
