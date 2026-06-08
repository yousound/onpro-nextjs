import { applySuggestionStub, type AgentApplyResult } from "@/lib/agent-apply-core";
import { fetchProjectByIdFromSupabase } from "@/lib/supabase/projects";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import type { AgentSuggestion } from "@/lib/types/agent";

export type ApplyContext = {
  project_id?: number;
  job_id?: string;
};

export async function applySuggestionWithContext(
  suggestion: AgentSuggestion,
  context?: ApplyContext,
): Promise<AgentApplyResult> {
  const base = applySuggestionStub(suggestion);
  if (!base.ok) return base;

  const projectId = context?.project_id ?? extractProjectIdFromPayload(suggestion.payload);
  if (!projectId || !(await isLiveBackendEnabled())) {
    return base;
  }

  try {
    const project = await fetchProjectByIdFromSupabase(projectId);
    if (!project) return base;

    const mode = isUpdateKind(suggestion.kind) ? "update" : "create";
    return {
      ok: true,
      message: `${base.message} (${mode} on project “${project.name}”.)`,
      deepLink: `/projects/${project.id}`,
    };
  } catch (e) {
    console.warn("[apply-suggestion] project context lookup failed", e);
    return base;
  }
}

function extractProjectIdFromPayload(payload: Record<string, unknown>): number | undefined {
  const raw = payload.project_id ?? payload.projectId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  return undefined;
}

function isUpdateKind(kind: AgentSuggestion["kind"]): boolean {
  return (
    kind === "add_vendor_quote" ||
    kind === "add_costing_line" ||
    kind === "generate_estimate" ||
    kind === "update_client_po" ||
    kind === "update_sample_milestone" ||
    kind === "log_packing_list" ||
    kind === "update_project" ||
    kind === "team_note"
  );
}
