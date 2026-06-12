import type { JobDetailsSection, JobType, WipStep } from "@/lib/types/wip";
import {
  CONNECT_DOTS_PROJECT_WIP_STEPS,
  buildUpcomingJobTimeline,
} from "@/lib/wip-project-timeline";

const SAMPLE_TIMELINE_STEP_IDS = new Set(["sample_1st", "sample_2nd", "sample_pp"]);

/** Cut & Sew sample approval steps open Development → SAMPLE APPROVALS. */
export function timelineStepOpensIn(stepId: string): JobDetailsSection | undefined {
  if (SAMPLE_TIMELINE_STEP_IDS.has(stepId)) return "development";
  return undefined;
}

/** Subset of the canonical step ids for each job type. Order matters. */
export const JOB_TIMELINE_TEMPLATES: Record<JobType, string[]> = {
  print_production: [
    "vendor_inquiries",
    "mock_up",
    "cost_sheets",
    "costing_summary",
    "deposit_payment",
    "tp_setup",
    "blanks_lab_dip",
    "order_trims",
    "tp_completion",
    "sent_to_contractors",
    "strike_off",
    "trimming",
    "packing",
    "arrange_delivery",
    "completion",
  ],
  cut_sew: [
    "vendor_inquiries",
    "mock_up",
    "cost_sheets",
    "costing_summary",
    "deposit_payment",
    "tp_setup",
    "blanks_lab_dip",
    "order_trims",
    "tp_completion",
    "sent_to_contractors",
    "strike_off",
    "sample_1st",
    "sample_2nd",
    "sample_pp",
    "packing",
    "arrange_delivery",
    "completion",
  ],
  full_package: [
    "vendor_inquiries",
    "mock_up",
    "cost_sheets",
    "costing_summary",
    "deposit_payment",
    "packing",
    "arrange_delivery",
    "completion",
  ],
  design: ["vendor_inquiries", "mock_up", "tp_setup", "tp_completion", "completion"],
  branding: ["vendor_inquiries", "mock_up", "cost_sheets", "tp_setup", "tp_completion", "completion"],
  custom: [
    "vendor_inquiries",
    "cost_sheets",
    "costing_summary",
    "deposit_payment",
    "tp_setup",
    "tp_completion",
    "packing",
    "arrange_delivery",
    "completion",
  ],
};

/** Build a fresh upcoming timeline for a job type. Falls back to full template. */
export function buildUpcomingJobTimelineForType(type?: JobType): WipStep[] {
  if (!type) return buildUpcomingJobTimeline();
  const ids = JOB_TIMELINE_TEMPLATES[type];
  if (!ids?.length) return buildUpcomingJobTimeline();
  const defs = new Map(CONNECT_DOTS_PROJECT_WIP_STEPS.map((d) => [d.id, d]));
  return ids
    .map((id) => defs.get(id))
    .filter((d): d is NonNullable<ReturnType<typeof defs.get>> => Boolean(d))
    .map((def) => {
      const opensIn = timelineStepOpensIn(def.id);
      return {
        id: def.id,
        label: def.label,
        state: "upcoming" as const,
        ...(opensIn ? { opensIn } : {}),
      };
    });
}

/**
 * Merge saved timeline with the current template for this job type — inserts missing
 * canonical steps (e.g. sample approvals on older Cut & Sew jobs) while preserving order.
 */
export function repairJobTimelineWithTemplate(
  timeline: WipStep[] | undefined,
  jobType?: JobType,
): WipStep[] {
  const template = buildUpcomingJobTimelineForType(jobType);
  const saved = timeline ?? [];
  if (saved.length === 0) return template;

  const savedById = new Map(saved.map((s) => [s.id, s]));
  const merged: WipStep[] = [];

  for (const tpl of template) {
    const hit = savedById.get(tpl.id);
    savedById.delete(tpl.id);
    merged.push(
      hit
        ? {
            ...tpl,
            ...hit,
            label: hit.label.trim() || tpl.label,
            state: hit.state ?? tpl.state,
            opensIn: hit.opensIn ?? tpl.opensIn,
          }
        : { ...tpl },
    );
  }

  for (const s of saved) {
    if (!merged.some((m) => m.id === s.id)) merged.push(s);
  }

  return merged;
}

/** What accordion sections should the modal show for this job type? */
export type AccordionSection =
  | "estimate"
  | "development"
  | "costing"
  | "approvals"
  | "bulk";

export function accordionSectionsFor(type: JobType | undefined): AccordionSection[] {
  switch (type) {
    case "full_package":
      return ["estimate", "costing"];
    case "design":
      return ["estimate", "development"];
    case "branding":
      return ["estimate", "development", "costing"];
    case "cut_sew":
      return ["estimate", "development", "costing", "approvals", "bulk"];
    case "print_production":
    case "custom":
    default:
      return ["estimate", "development", "costing", "approvals", "bulk"];
  }
}
