import type { Project } from "@/lib/types/project";
import type { ProjectJob, WipStep, WipStepState } from "@/lib/types/wip";

type StepDef = {
  id: string;
  label: string;
  durationShort?: string;
  durationLabel?: string;
};

/** Connect Dots print-production WIP categories (sheet order, excluding name/status meta columns). */
export const CONNECT_DOTS_PROJECT_WIP_STEPS: StepDef[] = [
  {
    id: "vendor_inquiries",
    label: "Vendor Inquiries",
    durationShort: "2–3d",
    durationLabel: "2–3 days from hand off",
  },
  { id: "mock_up", label: "Mock Up Creation" },
  {
    id: "cost_sheets",
    label: "Cost Sheets Completed",
    durationShort: "1d",
    durationLabel: "1 day from cost sheet completion",
  },
  { id: "costing_summary", label: "Costing Summary Sent to Client" },
  { id: "deposit_payment", label: "Deposit / Payment Received" },
  {
    id: "tp_setup",
    label: "Tech Pack Set Up",
    durationShort: "2–3d",
    durationLabel: "2–3 days after payment receipt",
  },
  {
    id: "blanks_lab_dip",
    label: "Blanks Purchased / PG + Dye + Lab Dip",
  },
  { id: "order_trims", label: "Order All Trims & Appliques" },
  { id: "tp_completion", label: "Tech Pack Completion" },
  {
    id: "sent_to_contractors",
    label: "Blanks, Trims & TPs Sent to Contractors",
    durationShort: "<1d",
    durationLabel: "Less than 1 day after tech pack completion",
  },
  {
    id: "strike_off",
    label: "Strike-off Approvals",
    durationShort: "1–2d",
    durationLabel: "1–2 days after artwork passed",
  },
  {
    id: "trimming",
    label: "Trimming (<100 units)",
    durationShort: "1–2d",
    durationLabel: "1–2 days after dye",
  },
  { id: "packing", label: "Packing for Shipment" },
  {
    id: "arrange_delivery",
    label: "Arrange Delivery",
    durationShort: "1–2d",
    durationLabel: "1–2 days after production completion",
  },
  { id: "completion", label: "Completion Date" },
];

export function wipStepLabel(stepId: string): string {
  return CONNECT_DOTS_PROJECT_WIP_STEPS.find((s) => s.id === stepId)?.label ?? stepId;
}

function hasDate(iso: Project["due_date"]): boolean {
  return iso != null && iso !== "";
}

function isStepDone(project: Project, stepId: string): boolean {
  switch (stepId) {
    case "vendor_inquiries":
      return hasDate(project.quote_requested_date) || hasDate(project.vendor_costing_received_date);
    case "mock_up":
      return hasDate(project.references_sent_date);
    case "cost_sheets":
      return hasDate(project.cost_sheet_prepared_date);
    case "costing_summary":
      return hasDate(project.estimate_sent_date);
    case "deposit_payment":
      return project.costing_approved === true;
    case "tp_setup":
      return hasDate(project.cs_tech_pack_request_date) || hasDate(project.artwork_tech_pack_request_date);
    case "blanks_lab_dip":
      return hasDate(project.lab_dip_request_date) || hasDate(project.lab_dip_received_date);
    case "order_trims":
      return (
        hasDate(project.barcodes_sent_to_vendor_date) ||
        hasDate(project.new_product_request_date) ||
        hasDate(project.bulk_trim_approval_date)
      );
    case "tp_completion":
      return hasDate(project.cs_tech_pack_complete_date) && hasDate(project.artwork_tech_pack_complete_date);
    case "sent_to_contractors":
      return hasDate(project.tp_sent_date);
    case "strike_off":
      return project.strike_off_approval_status === "APPROVED";
    case "trimming":
      return project.strike_off_approval_status === "APPROVED" && hasDate(project.bulk_fabric_approval_date);
    case "packing":
      return hasDate(project.packing_list_received_date);
    case "arrange_delivery":
      return hasDate(project.ex_factory_date) || hasDate(project.bulk_target_delivery_date);
    case "completion":
      return hasDate(project.client_received_date);
    default:
      return false;
  }
}

export function deriveProjectTimelineStates(project: Project): WipStepState[] {
  const done = CONNECT_DOTS_PROJECT_WIP_STEPS.map((s) => isStepDone(project, s.id));
  let activeAssigned = false;
  return done.map((completed) => {
    if (completed) return "completed";
    if (!activeAssigned) {
      activeAssigned = true;
      return "in_progress";
    }
    return "upcoming";
  });
}

export function isDefaultWipStepId(stepId: string): boolean {
  return CONNECT_DOTS_PROJECT_WIP_STEPS.some((d) => d.id === stepId);
}

function collectProjectTimelineStepDefs(jobs: ProjectJob[]): StepDef[] {
  const customSeen = new Set<string>();
  const custom: StepDef[] = [];
  for (const job of jobs) {
    for (const step of job.timeline) {
      if (!isDefaultWipStepId(step.id) && !customSeen.has(step.id)) {
        customSeen.add(step.id);
        custom.push({
          id: step.id,
          label: step.label,
          durationShort: step.durationShort,
          durationLabel: step.durationLabel,
        });
      }
    }
  }
  return [...CONNECT_DOTS_PROJECT_WIP_STEPS, ...custom];
}

function jobStepState(job: ProjectJob, stepId: string): WipStepState | undefined {
  return job.timeline.find((t) => t.id === stepId)?.state;
}

/**
 * Project timeline = ordered Connect Dots steps where each step is complete only when **every**
 * job that carries that step is `completed`. Jobs without a step id fall back to project date logic
 * for that step only. First incomplete step in order is `in_progress` (covers partial roll-ups);
 * later steps are `upcoming`. Custom job steps are appended after defaults.
 */
export function deriveProjectTimelineStatesFromJobs(project: Project, jobs: ProjectJob[]): WipStepState[] {
  if (!jobs.length) return deriveProjectTimelineStates(project);

  const defs = collectProjectTimelineStepDefs(jobs);

  const allDone = defs.map((def) => {
    const jobsWithStep = jobs.filter((j) => j.timeline.some((t) => t.id === def.id));
    if (jobsWithStep.length === 0) {
      return isDefaultWipStepId(def.id) ? isStepDone(project, def.id) : false;
    }
    return jobsWithStep.every((j) => jobStepState(j, def.id) === "completed");
  });

  const firstIncomplete = allDone.findIndex((d) => !d);
  const frontier = firstIncomplete === -1 ? defs.length : firstIncomplete;

  return defs.map((_, i) => {
    if (allDone[i]) return "completed";
    if (i === frontier) return "in_progress";
    return "upcoming";
  });
}

export function buildProjectTimelineFromJobs(project: Project, jobs: ProjectJob[]): WipStep[] {
  const defs = collectProjectTimelineStepDefs(jobs);
  const states = deriveProjectTimelineStatesFromJobs(project, jobs);
  return defs.map((def, i) => toWipStep(def, states[i] ?? "upcoming"));
}

function toWipStep(def: StepDef, state: WipStepState): WipStep {
  return {
    id: def.id,
    label: def.label,
    durationShort: def.durationShort,
    durationLabel: def.durationLabel,
    state,
  };
}

export function buildProjectTimeline(project: Project): WipStep[] {
  const states = deriveProjectTimelineStates(project);
  return CONNECT_DOTS_PROJECT_WIP_STEPS.map((def, i) => toWipStep(def, states[i] ?? "upcoming"));
}

export function buildEmptyProjectTimeline(): WipStep[] {
  return CONNECT_DOTS_PROJECT_WIP_STEPS.map((def) => toWipStep(def, "upcoming"));
}

/** Full Connect Dots step list for a new job (all upcoming). */
export function buildUpcomingJobTimeline(): WipStep[] {
  return buildEmptyProjectTimeline();
}

/**
 * Merge saved job timeline with seed/fallback metadata. **Saved order is preserved** —
 * defaults are not re-injected if the user removed or reordered them.
 */
export function repairJobTimeline(timeline: WipStep[] | undefined, fallback: WipStep[]): WipStep[] {
  const saved = timeline ?? [];
  if (saved.length === 0) {
    return fallback.length > 0 ? fallback.map((s) => ({ ...s })) : buildUpcomingJobTimeline();
  }

  const defById = new Map(CONNECT_DOTS_PROJECT_WIP_STEPS.map((d) => [d.id, d]));
  const fallbackById = new Map(fallback.map((s) => [s.id, s]));

  return saved.map((s) => {
    const def = defById.get(s.id);
    const base = fallbackById.get(s.id);
    return {
      id: s.id,
      label: s.label.trim() || def?.label || base?.label || s.id,
      durationShort: s.durationShort ?? base?.durationShort ?? def?.durationShort,
      durationLabel: s.durationLabel ?? base?.durationLabel ?? def?.durationLabel,
      state: s.state ?? base?.state ?? "upcoming",
      ...(s.opensIn ? { opensIn: s.opensIn } : {}),
    };
  });
}

export function createCustomWipStep(label: string): WipStep {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  const id = `custom_${slug || "step"}_${Date.now().toString(36)}`;
  return {
    id,
    label: label.trim() || "New step",
    state: "upcoming",
  };
}

export function moveWipStep(steps: WipStep[], stepId: string, direction: "up" | "down"): WipStep[] {
  const index = steps.findIndex((s) => s.id === stepId);
  if (index < 0) return steps;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= steps.length) return steps;
  const next = steps.slice();
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
