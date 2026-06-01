"use client";

import type {
  AgentSuggestion,
  AgentSuggestionKind,
  GeneratedItem,
  GeneratedItemKind,
} from "@/lib/types/agent";

/**
 * Apply an agent suggestion against the mock localStorage stores.
 *
 * This is a front-end mock — the real implementation would hit the API. For now,
 * each branch logs what would happen and returns a deep link to navigate to.
 * Each handler is a no-op when the side-effecting store isn't directly reachable
 * without context the caller has.
 */
export type AgentApplyResult = {
  ok: boolean;
  message: string;
  deepLink?: string;
};

const KIND_MAP: Record<AgentSuggestionKind, GeneratedItemKind> = {
  create_project: "project",
  create_job: "job",
  add_vendor_quote: "vendor_quote",
  add_costing_line: "costing_line",
  generate_estimate: "estimate",
  create_invoice: "invoice",
  update_client_po: "client_po",
  update_sample_milestone: "sample",
  log_packing_list: "packing_list",
  team_note: "task",
};

export function generatedKindFromSuggestion(kind: AgentSuggestionKind): GeneratedItemKind {
  return KIND_MAP[kind];
}

export function suggestionKindFromGeneratedKind(
  kind: GeneratedItemKind,
): AgentSuggestionKind | undefined {
  for (const [suggestionKind, generatedKind] of Object.entries(KIND_MAP) as Array<
    [AgentSuggestionKind, GeneratedItemKind]
  >) {
    if (generatedKind === kind) return suggestionKind;
  }
  return undefined;
}

export function generatedItemFromSuggestion(
  s: AgentSuggestion,
  result: AgentApplyResult,
): GeneratedItem {
  return {
    id: `gen-${s.id}-${Date.now().toString(36)}`,
    thread_id: s.thread_id,
    kind: KIND_MAP[s.kind],
    title: s.title,
    summary: result.message,
    payload: s.payload,
    deepLink: result.deepLink,
    created_at: new Date().toISOString(),
    source_suggestion_id: s.id,
  };
}

export function applySuggestion(suggestion: AgentSuggestion): AgentApplyResult {
  switch (suggestion.kind) {
    case "add_vendor_quote": {
      const p = suggestion.payload as Record<string, unknown>;
      const vendor = String(p.vendor ?? "Vendor");
      const desc = String(p.item_description ?? "Item");
      const cost = Number(p.unit_cost ?? 0);
      return {
        ok: true,
        message: `Vendor quote stub created for ${vendor}: ${desc} @ $${cost.toFixed(2)}. Open a job to attach it.`,
      };
    }
    case "create_project": {
      const p = suggestion.payload as Record<string, unknown>;
      const name = String(p.name ?? "New project");
      return { ok: true, message: `Project draft "${name}" queued — open Projects to finish.` , deepLink: "/projects" };
    }
    case "create_job":
      return { ok: true, message: "Job draft queued — open the project to finish.", deepLink: "/projects" };
    case "add_costing_line":
      return { ok: true, message: "Costing line draft queued — open the job's Costing section." };
    case "generate_estimate":
      return { ok: true, message: "Estimate draft generated — open the job's Costing section." };
    case "create_invoice":
      return { ok: true, message: "Invoice draft queued for review.", deepLink: "/documents" };
    case "update_client_po": {
      const p = suggestion.payload as Record<string, unknown>;
      return { ok: true, message: `Client PO ${String(p.client_po_number ?? "")} ready to apply — open the job.` };
    }
    case "update_sample_milestone":
      return { ok: true, message: "Sample milestone update queued — open the job to confirm." };
    case "log_packing_list": {
      const p = suggestion.payload as Record<string, unknown>;
      const variant = String(p.variant ?? "products_go");
      return { ok: true, message: `Packing list variant set to ${variant}. Open the project to verify.` };
    }
    case "team_note":
      return { ok: true, message: "Task queued for the team.", deepLink: "/messages" };
    default:
      return { ok: false, message: "Unhandled suggestion kind." };
  }
}
