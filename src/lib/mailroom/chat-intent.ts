import type { AgentSuggestionKind } from "@/lib/types/agent";

export type MailroomChatIntent = {
  kind: AgentSuggestionKind | null;
  reply: string;
  applyAll?: boolean;
};

/** User is asking, not instructing the agent to act. */
export function isLikelyQuestion(text: string): boolean {
  const t = text.trim();
  if (t.includes("?")) return true;
  if (
    /^(?:is|are|do|does|did|can|could|should|would|will|was|were|have|has|had|any|there'?s|there are|there is|what|why|how|when|where|who)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(?:wondering|curious|not sure|no tasks?|nothing to do|anything to do|should we|do we need)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/** Clear instruction to create or apply something (not a rhetorical mention). */
export function isExplicitActionRequest(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(?:go ahead|apply all|do it|sounds good|yes please)\b/.test(t)) return true;
  if (
    /(?:^|\b)(?:please\s+)?(?:add|create|make|draft|generate|set up|log|remind|capture|queue|mark)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function questionReply(text: string): string {
  const t = text.toLowerCase();
  if (/\btask|todo|remind/.test(t) && /\bclient/.test(t)) {
    return (
      "From what’s in this thread, there isn’t an obvious client-facing follow-up that needs a tracked task — " +
      "most of the open work looks operational (vendor, production, or internal). " +
      "If you want a team task anyway, say something like “add a task to follow up with the client on X” and I’ll draft it."
    );
  }
  if (/\btask|todo/.test(t)) {
    return (
      "I don’t see a clear task called for in this thread yet. " +
      "Check the pending suggestions on the right, or tell me explicitly what to track (e.g. “add a task to confirm ship date”)."
    );
  }
  if (/\bproject/.test(t)) {
    return (
      "I can help once you’ve summarized the thread or if you want me to draft a project — " +
      "just say “create a project from this thread” when you’re ready."
    );
  }
  return (
    "Happy to help think it through. I won’t create drafts until you ask me to — " +
    "review pending suggestions on the right, or tell me what you’d like generated."
  );
}

/**
 * Client-side fallback when Mailroom chat API / OpenAI is unavailable.
 * Prefer conversation on questions; only surface action kinds on clear requests.
 */
export function detectMailroomChatIntent(text: string): MailroomChatIntent {
  const t = text.toLowerCase().trim();
  const question = isLikelyQuestion(text);
  const explicit = isExplicitActionRequest(text);

  if (/(^|\W)(go ahead|apply all|do it|generate (?:them|all)|yes|sounds good)(\W|$)/.test(t)) {
    return { kind: null, reply: "On it — applying the pending suggestions on the right.", applyAll: true };
  }

  if (question && !explicit) {
    return { kind: null, reply: questionReply(text) };
  }

  if (
    explicit &&
    /(?:rename|update|change|fix).{0,40}project|project.{0,30}(?:name|title)/.test(t)
  ) {
    return {
      kind: "update_project",
      reply: "I'll draft a project name update — review the card on the right, then tap Generate or say go ahead.",
    };
  }
  if (explicit && /project/.test(t) && /\b(?:create|new|start)\b/.test(t)) {
    return { kind: "create_project", reply: "I'll draft a project for this thread — review it in the panel on the right." };
  }
  if (explicit && /estimate/.test(t)) {
    return { kind: "generate_estimate", reply: "Drafting an estimate based on the latest costing." };
  }
  if (explicit && /invoice/.test(t)) {
    return { kind: "create_invoice", reply: "Queueing an invoice draft." };
  }
  if (explicit && /\bjob\b/.test(t)) {
    return { kind: "create_job", reply: "I'll add a job draft to the project." };
  }
  if (explicit && /quote|cost(?:ing)?/.test(t)) {
    return { kind: "add_vendor_quote", reply: "Got it — I'll capture the vendor quote." };
  }
  if (explicit && /p(?:urchase)? ?o(?:rder)?|client po/.test(t)) {
    return { kind: "update_client_po", reply: "I'll set the client PO on the relevant job." };
  }
  if (explicit && /sample|strike[- ]off/.test(t)) {
    return { kind: "update_sample_milestone", reply: "I'll mark the sample milestone for you." };
  }
  if (explicit && /packing/.test(t)) {
    return { kind: "log_packing_list", reply: "I'll adjust the packing list variant." };
  }
  if (
    explicit &&
    /(?:add|create|make|draft|log|remind).{0,40}(?:task|todo)|(?:task|todo).{0,30}(?:for the team|for team)/.test(
      t,
    )
  ) {
    return { kind: "team_note", reply: "I'll draft a team task — preview it on the right before you generate." };
  }

  if (question) {
    return { kind: null, reply: questionReply(text) };
  }

  return {
    kind: null,
    reply:
      "Got it. Ask me a question about this thread, or tell me what to draft (e.g. invoice, job, task). Say “go ahead” to apply pending suggestions.",
  };
}
