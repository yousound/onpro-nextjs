import {
  extractClientPoFromSubject,
  inferBrandClientName,
  isWorkspaceOperatorClientName,
} from "@/lib/mailroom/client-from-rfq";
import {
  inferClientNameForProject,
  inferProjectNameFromThread,
  isPlaceholderClientName,
  isPlaceholderProjectName,
} from "@/lib/mailroom/project-from-thread";
import type {
  AgentSuggestion,
  AgentSuggestionKind,
  MailroomProjectMatch,
  MailroomThreadIntent,
  MailroomWorkflow,
  MailroomWorkflowStep,
} from "@/lib/types/agent";

const KINDS_NEEDING_PROJECT: AgentSuggestionKind[] = [
  "create_order",
  "create_job",
  "add_vendor_quote",
  "add_costing_line",
  "generate_estimate",
  "create_invoice",
  "update_client_po",
  "update_sample_milestone",
  "log_packing_list",
];
import { payloadWithFieldOrder, ensurePayloadFieldOrder } from "@/lib/mailroom/payload-field-order";

const VALID_KINDS: AgentSuggestionKind[] = [
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

const VALID_INTENTS: MailroomThreadIntent[] = [
  "new_client_rfq",
  "existing_project_update",
  "vendor_inbound",
  "other",
];

export type WorkflowStepExecContext = {
  project_id?: number;
  job_id?: string;
  job_ids?: string[];
};

/** Readable payload values for UI (avoids `[object Object]`). */
export function formatPayloadValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((v) => formatPayloadValue(v)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const parts = Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k.replaceAll("_", " ")}: ${formatPayloadValue(v)}`);
    return parts.length > 0 ? parts.join(" · ") : JSON.stringify(value);
  }
  return String(value);
}

export function workflowToSuggestions(workflow: MailroomWorkflow): AgentSuggestion[] {
  return workflow.steps.map((step) => ({
    id: step.suggestion_id,
    thread_id: workflow.thread_id,
    kind: step.kind,
    title: step.title,
    payload: {
      ...step.payload,
      ...(step.auto_contact ? { auto_contact: step.auto_contact } : {}),
      workflow_step_id: step.step_id,
    },
    status: step.status === "applied" ? "applied" : "pending",
    created_at: workflow.created_at,
  }));
}

export function buildStepExecContext(
  workflow: MailroomWorkflow,
  stepId: string,
): WorkflowStepExecContext {
  const ctx: WorkflowStepExecContext = {};

  if (workflow.link_existing_project_id != null) {
    ctx.project_id = workflow.link_existing_project_id;
  }

  for (const step of workflow.steps) {
    if (step.status !== "applied") continue;
    if (step.applied_project_id != null) ctx.project_id = step.applied_project_id;
    if (step.applied_job_id) {
      ctx.job_id = step.applied_job_id;
      ctx.job_ids = [...(ctx.job_ids ?? []), step.applied_job_id];
    }
  }

  const step = workflow.steps.find((s) => s.step_id === stepId);
  if (step?.depends_on?.length) {
    for (const depId of step.depends_on) {
      const dep = workflow.steps.find((s) => s.step_id === depId);
      if (!dep || dep.status !== "applied") continue;
      if (dep.applied_project_id != null) ctx.project_id = dep.applied_project_id;
      if (dep.applied_job_id) {
        ctx.job_id = dep.applied_job_id;
        ctx.job_ids = [...(ctx.job_ids ?? []), dep.applied_job_id];
      }
    }
  }

  if (step?.kind !== "create_project" && step?.payload.job_id) {
    ctx.job_id = String(step.payload.job_id);
  }

  return ctx;
}

type LlmWorkflowStep = {
  step_id?: string;
  kind?: AgentSuggestionKind;
  title?: string;
  payload?: Record<string, unknown>;
  depends_on?: string[];
  auto_contact?: { name?: string; email?: string; company?: string };
};

type LlmWorkflowResult = {
  summary?: string;
  thread_intent?: MailroomThreadIntent;
  project_match?: Partial<MailroomProjectMatch>;
  workflow?: LlmWorkflowStep[];
  suggestions?: Array<{
    kind: AgentSuggestionKind;
    title: string;
    payload: Record<string, unknown>;
  }>;
};

function normalizeProjectMatch(raw: Partial<MailroomProjectMatch> | undefined): MailroomProjectMatch {
  const confidence = raw?.confidence;
  return {
    project_id: typeof raw?.project_id === "number" ? raw.project_id : undefined,
    confidence:
      confidence === "high" || confidence === "low" || confidence === "none" ? confidence : "none",
    reason: typeof raw?.reason === "string" ? raw.reason.trim() : "",
  };
}

function flattenPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = formatPayloadValue(v);
    } else {
      out[k] = v;
    }
  }
  const order = ensurePayloadFieldOrder(out);
  return payloadWithFieldOrder(out, order);
}

export function buildWorkflowFromLlmResponse(
  threadId: string,
  parsed: Record<string, unknown>,
  now: string,
): { workflow: MailroomWorkflow | null; suggestions: AgentSuggestion[] } {
  const data = parsed as {
    thread_intent?: MailroomThreadIntent;
    project_match?: Partial<MailroomProjectMatch>;
    workflow?: LlmWorkflowStep[];
    suggestions?: Array<{
      kind: AgentSuggestionKind;
      title: string;
      payload: Record<string, unknown>;
    }>;
  };
  const thread_intent = VALID_INTENTS.includes(data.thread_intent as MailroomThreadIntent)
    ? (data.thread_intent as MailroomThreadIntent)
    : "other";
  const project_match = normalizeProjectMatch(data.project_match);

  const rawSteps = data.workflow?.length
    ? data.workflow
    : (data.suggestions ?? []).map((s, i) => ({
        step_id: `step-${i + 1}`,
        kind: s.kind,
        title: s.title,
        payload: s.payload,
      }));

  const steps: MailroomWorkflowStep[] = rawSteps
    .filter((s) => s.kind && VALID_KINDS.includes(s.kind))
    .slice(0, 10)
    .map((s, i) => {
      const stepId = s.step_id?.trim() || `step-${i + 1}`;
      const llm = s as LlmWorkflowStep;
      return {
        step_id: stepId,
        kind: s.kind as AgentSuggestionKind,
        title: s.title?.trim() || `Step ${i + 1}`,
        payload: flattenPayload(s.payload && typeof s.payload === "object" ? s.payload : {}),
        depends_on: Array.isArray(llm.depends_on) ? llm.depends_on.filter(Boolean) : undefined,
        auto_contact: llm.auto_contact,
        suggestion_id: `sug-ai-${threadId}-${stepId}`,
        status: "pending" as const,
      };
    });

  if (steps.length === 0) {
    return { workflow: null, suggestions: [] };
  }

  const workflow: MailroomWorkflow = {
    thread_id: threadId,
    thread_intent,
    project_match,
    link_existing_project_id:
      project_match.confidence === "high" && project_match.project_id != null
        ? project_match.project_id
        : null,
    steps,
    created_at: now,
  };

  return { workflow, suggestions: workflowToSuggestions(workflow) };
}

export function patchWorkflowStep(
  workflow: MailroomWorkflow,
  stepId: string,
  patch: Partial<Pick<MailroomWorkflowStep, "status" | "applied_project_id" | "applied_job_id" | "title" | "payload">>,
): MailroomWorkflow {
  return {
    ...workflow,
    steps: workflow.steps.map((s) => (s.step_id === stepId ? { ...s, ...patch } : s)),
  };
}

/** True once a create_project step has finished (or linked an existing project). */
export function workflowStepNeedsProject(kind: AgentSuggestionKind): boolean {
  return KINDS_NEEDING_PROJECT.includes(kind);
}

/** Project id from applied / linked workflow steps that still exists in the workspace. */
export function workflowActiveProjectId(
  workflow: MailroomWorkflow,
  existingProjectIds: ReadonlySet<number>,
): number | undefined {
  if (
    workflow.link_existing_project_id != null &&
    existingProjectIds.has(workflow.link_existing_project_id)
  ) {
    return workflow.link_existing_project_id;
  }
  for (const step of workflow.steps) {
    if (
      step.status === "applied" &&
      step.applied_project_id != null &&
      existingProjectIds.has(step.applied_project_id)
    ) {
      return step.applied_project_id;
    }
  }
  return undefined;
}

export function pendingCreateProjectStep(
  workflow: MailroomWorkflow,
): MailroomWorkflowStep | undefined {
  return workflow.steps.find((s) => s.kind === "create_project" && s.status === "pending");
}

/** Job/order steps are waiting but no live project is attached to this workflow. */
export function workflowMissingProjectForLaterSteps(
  workflow: MailroomWorkflow,
  existingProjectIds: ReadonlySet<number>,
): boolean {
  const needsProjectPending = workflow.steps.some(
    (s) => s.status === "pending" && workflowStepNeedsProject(s.kind),
  );
  if (!needsProjectPending) return false;
  return workflowActiveProjectId(workflow, existingProjectIds) == null;
}

export function workflowMissingProjectMessage(
  workflow: MailroomWorkflow,
  existingProjectIds: ReadonlySet<number>,
): string | null {
  if (!workflowMissingProjectForLaterSteps(workflow, existingProjectIds)) return null;
  const createStep = pendingCreateProjectStep(workflow);
  if (createStep) {
    return `Run “${createStep.title}” before job or order steps.`;
  }
  const hadCreate = workflow.steps.some((s) => s.kind === "create_project");
  if (!hadCreate) {
    return "This plan has no create-project step. Clear AI results, then Summarize again.";
  }
  return "No project in your workspace for this thread. Clear AI results or create a project first.";
}

/** Ensure RFQ / job-first plans include a create_project step when none exists. */
export function ensureRfqWorkflowHasProjectStep(
  workflow: MailroomWorkflow,
  threadSubject?: string,
): MailroomWorkflow {
  const hasPendingJobLike = workflow.steps.some(
    (s) => s.status === "pending" && workflowStepNeedsProject(s.kind),
  );
  const isRfqLike =
    workflow.thread_intent === "new_client_rfq" || hasPendingJobLike;
  if (!isRfqLike) return workflow;
  if (workflow.steps.some((s) => s.kind === "create_project")) return workflow;
  if (workflow.link_existing_project_id != null) return workflow;

  const stepId = "step-create-project";
  const firstJob = workflow.steps.find((s) => s.kind === "create_job");
  const poFromSubject = threadSubject ? extractClientPoFromSubject(threadSubject) : "";
  const nameHints = {
    threadSubject,
    jobTitle: firstJob?.title,
    jobPayload: firstJob?.payload,
  };
  const brandFromSubject = threadSubject ? inferBrandClientName("", threadSubject) : null;
  const projectName =
    String(firstJob?.payload?.project_name ?? firstJob?.payload?.name ?? "").trim() ||
    inferProjectNameFromThread(nameHints) ||
    (brandFromSubject ? `${brandFromSubject} RFQ` : "") ||
    "New project";
  const clientName =
    String(firstJob?.payload?.client ?? firstJob?.payload?.client_name ?? "").trim() ||
    inferClientNameForProject({ ...nameHints, projectName }) ||
    "";

  const createStep: MailroomWorkflowStep = {
    step_id: stepId,
    kind: "create_project",
    title: `Create project: ${projectName}`,
    payload: {
      client: clientName,
      client_name: clientName,
      name: projectName,
      project_name: projectName,
      ...(poFromSubject ? { client_po_number: poFromSubject } : {}),
    },
    suggestion_id: `sug-ai-${workflow.thread_id}-${stepId}`,
    status: "pending",
  };

  const steps = [
    createStep,
    ...workflow.steps.map((s) => {
      if (!workflowStepNeedsProject(s.kind)) return s;
      const deps = new Set(s.depends_on ?? []);
      deps.add(stepId);
      return { ...s, depends_on: [...deps] };
    }),
  ];

  return {
    ...workflow,
    link_existing_project_id: null,
    project_match:
      workflow.project_match.confidence === "high"
        ? { confidence: "none", reason: "Plan rebuilt — create project first." }
        : workflow.project_match,
    steps,
  };
}

/** Drop dead project links and inject create_project when the plan only has jobs. */
export function normalizeWorkflowForWorkspace(
  workflow: MailroomWorkflow,
  existingProjectIds: ReadonlySet<number>,
  opts?: { threadSubject?: string; summary?: string },
): MailroomWorkflow {
  let wf = workflow;
  if (
    wf.link_existing_project_id != null &&
    !existingProjectIds.has(wf.link_existing_project_id)
  ) {
    wf = {
      ...wf,
      link_existing_project_id: null,
      project_match: {
        confidence: "none",
        reason: "Matched project was removed from workspace.",
      },
    };
  } else if (
    wf.project_match.project_id != null &&
    !existingProjectIds.has(wf.project_match.project_id)
  ) {
    wf = {
      ...wf,
      link_existing_project_id: null,
      project_match: { confidence: "none", reason: "" },
    };
  }
  return enrichWorkflowProjectNaming(
    ensureRfqWorkflowHasProjectStep(wf, opts?.threadSubject),
    opts?.threadSubject,
    opts?.summary,
  );
}

function workflowNameHints(
  workflow: MailroomWorkflow,
  threadSubject?: string,
  summary?: string,
): {
  threadSubject?: string;
  jobTitle?: string;
  jobPayload?: Record<string, unknown>;
  summary?: string;
} {
  const firstJob = workflow.steps.find((s) => s.kind === "create_job");
  return {
    threadSubject,
    summary,
    jobTitle: firstJob?.title,
    jobPayload: firstJob?.payload,
  };
}

/** Fix placeholder create_project names/clients using job title and thread subject. */
export function enrichWorkflowProjectNaming(
  workflow: MailroomWorkflow,
  threadSubject?: string,
  summary?: string,
): MailroomWorkflow {
  const hints = workflowNameHints(workflow, threadSubject, summary);
  const inferredProject = inferProjectNameFromThread(hints);
  const inferredClient = inferClientNameForProject({
    ...hints,
    projectName: inferredProject ?? undefined,
  });

  const steps = workflow.steps.map((step) => {
    if (step.kind !== "create_project") return step;

    const name = String(step.payload.name ?? step.payload.project_name ?? "").trim();
    const client = String(step.payload.client ?? step.payload.client_name ?? "").trim();
    const needsName = isPlaceholderProjectName(name);
    const needsClient = isPlaceholderClientName(client);

    if (!needsName && !needsClient) return step;

    const resolvedName = needsName ? (inferredProject ?? name) : name;
    const resolvedClient = needsClient ? (inferredClient ?? client) : client;
    const title = `Create project: ${resolvedName || "New project"}`;

    const payload: Record<string, unknown> = {
      ...step.payload,
      name: resolvedName || name,
      project_name: resolvedName || name,
    };
    if (resolvedClient) {
      payload.client = resolvedClient;
      payload.client_name = resolvedClient;
    }

    const auto = step.auto_contact;
    const autoCompany = String(auto?.company ?? "").trim();
    const autoNeedsCompany =
      !autoCompany || isWorkspaceOperatorClientName(autoCompany);

    return {
      ...step,
      title,
      payload,
      ...(auto && autoNeedsCompany && resolvedClient
        ? {
            auto_contact: {
              ...auto,
              company: resolvedClient,
              email: isWorkspaceOperatorClientName(String(auto.email ?? ""))
                ? undefined
                : auto.email,
            },
          }
        : {}),
    };
  });

  return { ...workflow, steps };
}

export function workflowProjectAlreadyCreated(
  workflow: MailroomWorkflow,
  existingProjectIds?: ReadonlySet<number>,
): boolean {
  const projectStillExists = (id: number | null | undefined): boolean =>
    id != null && (existingProjectIds == null || existingProjectIds.has(id));

  if (workflow.link_existing_project_id != null) {
    return projectStillExists(workflow.link_existing_project_id);
  }
  return workflow.steps.some(
    (s) =>
      s.kind === "create_project" &&
      s.status === "applied" &&
      projectStillExists(s.applied_project_id),
  );
}

export function nextPendingWorkflowStep(workflow: MailroomWorkflow): MailroomWorkflowStep | undefined {
  return workflow.steps.find((s) => s.status === "pending");
}

export function countPendingWorkflowSteps(workflow: MailroomWorkflow): number {
  return workflow.steps.filter((s) => s.status === "pending").length;
}

export function workflowHasNoPendingSteps(workflow: MailroomWorkflow): boolean {
  return workflow.steps.length > 0 && !workflow.steps.some((s) => s.status === "pending");
}

export function resolveWorkflowProjectId(workflow: MailroomWorkflow): number | undefined {
  if (workflow.link_existing_project_id != null) {
    return workflow.link_existing_project_id;
  }
  for (let i = workflow.steps.length - 1; i >= 0; i--) {
    const id = workflow.steps[i]?.applied_project_id;
    if (id != null) return id;
  }
  return workflow.project_match.project_id;
}

export type WorkflowSuccessSummary = {
  projectId: number;
  projectName: string;
  appliedCount: number;
  skippedCount: number;
  jobsCreated: number;
  projectCreated: boolean;
};

export function buildWorkflowSuccessSummary(
  workflow: MailroomWorkflow,
  projects: Array<{ id: number; name: string; client: string }>,
): WorkflowSuccessSummary | null {
  if (!workflowHasNoPendingSteps(workflow)) return null;

  const applied = workflow.steps.filter((s) => s.status === "applied");
  if (applied.length === 0 && workflow.link_existing_project_id == null) return null;

  const projectId = resolveWorkflowProjectId(workflow);
  if (projectId == null) return null;

  const project = projects.find((p) => p.id === projectId);
  const projectStep = applied.find((s) => s.kind === "create_project");
  const payloadName = projectStep?.payload?.name ?? projectStep?.payload?.project_name;
  const projectName =
    project?.name ??
    (typeof payloadName === "string" && payloadName.trim() ? payloadName.trim() : "Project");

  return {
    projectId,
    projectName,
    appliedCount: applied.length,
    skippedCount: workflow.steps.filter((s) => s.status === "skipped").length,
    jobsCreated: applied.filter((s) => s.kind === "create_job").length,
    projectCreated:
      applied.some((s) => s.kind === "create_project") ||
      workflow.link_existing_project_id != null,
  };
}
