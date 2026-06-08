import { resolveWorkflowProjectId } from "@/lib/mailroom/workflow-utils";
import type { AgentSuggestion, GeneratedItem, MailroomWorkflow } from "@/lib/types/agent";
import type { Project } from "@/lib/types/project";

export type MailroomThreadWorkspaceContext = {
  linked_project_id: number | null;
  linked_project_name: string | null;
  linked_job_id: string | null;
  linked_job_label: string | null;
  packaging_slip_count: number;
  generated_summary: string;
};

export function buildMailroomThreadWorkspaceContext(opts: {
  workflow?: MailroomWorkflow | null;
  projects: Array<{ id: number; name: string; packaging_slips?: Project["packaging_slips"] }>;
  generatedItems: GeneratedItem[];
  pendingSuggestions: AgentSuggestion[];
}): MailroomThreadWorkspaceContext {
  const { workflow, projects, generatedItems, pendingSuggestions } = opts;

  let projectId: number | undefined =
    workflow?.link_existing_project_id ??
    (workflow ? resolveWorkflowProjectId(workflow) : undefined);

  if (projectId == null) {
    for (const item of [...generatedItems].reverse()) {
      const raw = item.payload?.project_id ?? item.payload?.projectId;
      const fromPayload =
        typeof raw === "number"
          ? raw
          : typeof raw === "string" && /^\d+$/.test(raw)
            ? Number(raw)
            : undefined;
      const fromLink = item.deepLink?.match(/\/projects\/(\d+)/)?.[1];
      const fromDeep = fromLink ? Number(fromLink) : undefined;
      projectId = fromPayload ?? fromDeep;
      if (projectId != null) break;
    }
  }

  const pid =
    typeof projectId === "number"
      ? projectId
      : typeof projectId === "string" && /^\d+$/.test(projectId)
        ? Number(projectId)
        : null;

  const project = pid != null ? projects.find((p) => p.id === pid) : undefined;

  let linkedJobId: string | null = null;
  let linkedJobLabel: string | null = null;
  if (workflow) {
    for (let i = workflow.steps.length - 1; i >= 0; i--) {
      const step = workflow.steps[i];
      if (step?.status === "applied" && step.applied_job_id) {
        linkedJobId = step.applied_job_id;
        linkedJobLabel =
          String(step.payload?.name ?? step.payload?.job_name ?? step.title ?? "").trim() ||
          null;
        break;
      }
    }
  }
  if (!linkedJobId) {
    const jobItem = [...generatedItems].reverse().find((i) => i.kind === "job");
    const raw = jobItem?.payload?.job_id ?? jobItem?.payload?.jobId;
    if (typeof raw === "string" && raw.trim()) linkedJobId = raw.trim();
  }

  const slipCount = pid != null ? (project?.packaging_slips?.length ?? 0) : 0;

  const genLines = generatedItems.slice(-8).map((i) => `${i.kind}: ${i.title}`);
  const pendingLines = pendingSuggestions.map((s) => `${s.kind}: ${s.title}`);

  return {
    linked_project_id: pid,
    linked_project_name: project?.name ?? null,
    linked_job_id: linkedJobId,
    linked_job_label: linkedJobLabel,
    packaging_slip_count: slipCount,
    generated_summary: [...genLines, ...pendingLines].join("; ") || "none yet",
  };
}

export function mailroomWorkspaceContextForPrompt(ctx: MailroomThreadWorkspaceContext): string {
  const lines = [
    `Linked project: ${
      ctx.linked_project_id != null
        ? `#${ctx.linked_project_id} ${ctx.linked_project_name ?? ""}`.trim()
        : "none — create or link before updating jobs, POs, or packing lists"
    }`,
    `Linked job: ${
      ctx.linked_job_id
        ? `${ctx.linked_job_id}${ctx.linked_job_label ? ` (${ctx.linked_job_label})` : ""}`
        : "none"
    }`,
    `Packing lists on linked project: ${ctx.packaging_slip_count}`,
    `Items from this thread (applied or pending): ${ctx.generated_summary}`,
  ];
  return lines.join("\n");
}
