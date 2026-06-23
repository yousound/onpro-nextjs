import { extractClientPoFromSubject } from "@/lib/mailroom/client-from-rfq";
import { resolveWorkflowProjectId } from "@/lib/mailroom/workflow-utils";
import type { AgentSuggestionKind, MailroomWorkflow } from "@/lib/types/agent";

const UPDATE_KINDS: AgentSuggestionKind[] = [
  "update_project",
  "update_client_po",
  "update_sample_milestone",
  "log_packing_list",
  "add_vendor_quote",
  "add_costing_line",
  "create_invoice",
  "create_order",
  "create_job",
  "team_note",
];

export function lastAppliedJobId(workflow: MailroomWorkflow | undefined): string | undefined {
  if (!workflow) return undefined;
  for (let i = workflow.steps.length - 1; i >= 0; i--) {
    const step = workflow.steps[i];
    if (step?.status === "applied" && step.applied_job_id) return step.applied_job_id;
  }
  return undefined;
}

/** Attach workflow project/job ids so chat-originated updates hit the right workspace records. */
export function enrichSuggestionPayloadForThread(
  kind: AgentSuggestionKind,
  payload: Record<string, unknown>,
  opts: {
    workflow?: MailroomWorkflow | null;
    threadSubject?: string;
    fallbackProjectId?: number;
    fallbackJobId?: string;
  },
): Record<string, unknown> {
  const next = { ...payload };
  const needsTarget = UPDATE_KINDS.includes(kind);

  const projectId =
    next.project_id ??
    next.projectId ??
    opts.workflow?.link_existing_project_id ??
    (opts.workflow ? resolveWorkflowProjectId(opts.workflow) : undefined) ??
    opts.fallbackProjectId;

  if (needsTarget && projectId != null && next.project_id == null && next.projectId == null) {
    next.project_id = projectId;
  }

  const jobId =
    String(next.job_id ?? next.jobId ?? "").trim() ||
    lastAppliedJobId(opts.workflow ?? undefined) ||
    opts.fallbackJobId;
  if (needsTarget && jobId && !next.job_id && !next.jobId) {
    next.job_id = jobId;
  }

  if (kind === "update_client_po" && opts.threadSubject && !String(next.client_po_number ?? "").trim()) {
    const po = extractClientPoFromSubject(opts.threadSubject);
    if (po) next.client_po_number = po;
  }

  if (kind === "log_packing_list" && next.update_existing !== false) {
    next.update_existing = true;
  }

  return next;
}
