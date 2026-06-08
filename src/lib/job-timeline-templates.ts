import type { JobType, WipStep } from "@/lib/types/wip";
import {
  CONNECT_DOTS_PROJECT_WIP_STEPS,
  buildUpcomingJobTimeline,
} from "@/lib/wip-project-timeline";

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
    .map((def) => ({
      id: def.id,
      label: def.label,
      state: "upcoming" as const,
    }));
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
