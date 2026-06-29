import type { JobDetailsSection, JobType, WipStep } from "@/lib/types/wip";
import {
  CONNECT_DOTS_PROJECT_WIP_STEPS,
  buildUpcomingJobTimeline,
} from "@/lib/wip-project-timeline";
import {
  isBrandingClassJobType,
  isCutSewClassJobType,
  isPrintClassJobType,
} from "@/lib/job-type-migrate";

const SAMPLE_TIMELINE_STEP_IDS = new Set(["sample_1st", "sample_2nd", "sample_pp"]);

/** Cut & Sew sample approval steps open Development → SAMPLE APPROVALS. */
export function timelineStepOpensIn(stepId: string): JobDetailsSection | undefined {
  if (SAMPLE_TIMELINE_STEP_IDS.has(stepId)) return "cut_sew_samples";
  return undefined;
}

const PRINT_PRODUCTION_TIMELINE = [
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
] as const;

const CUT_SEW_CLASS_TIMELINE = [
  "vendor_inquiries",
  "cost_sheets",
  "costing_summary",
  "deposit_payment",
  "tp_setup",
  "strike_off",
  "development_sample_received",
  "pp_approved",
  "branded_labels_ordered",
  "top_approved",
  "completion",
] as const;

const BRANDING_CLASS_TIMELINE = [
  "costing_summary",
  "mock_up",
  "deposit_payment",
  "tp_setup",
  "branding_assets_approved",
  "completion",
] as const;

/** Subset of the canonical step ids for each job type. Order matters. */
export const JOB_TIMELINE_TEMPLATES: Record<JobType, string[]> = {
  print_production: [...PRINT_PRODUCTION_TIMELINE],
  decoration: [...PRINT_PRODUCTION_TIMELINE],
  finishing: [...PRINT_PRODUCTION_TIMELINE],
  full_package_cut_sew: [...CUT_SEW_CLASS_TIMELINE],
  custom_products: [...CUT_SEW_CLASS_TIMELINE],
  branding_kit: [...BRANDING_CLASS_TIMELINE],
  artwork_design: [...BRANDING_CLASS_TIMELINE],
};

function timelineLabelForType(stepId: string, defaultLabel: string, type?: JobType): string {
  if (stepId === "completion") {
    return isBrandingClassJobType(type) ? "Completion Date" : "Job Completed";
  }
  if (stepId === "costing_summary" && isBrandingClassJobType(type)) {
    return "Estimate Sent to Client";
  }
  return defaultLabel;
}

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
        label: timelineLabelForType(def.id, def.label, type),
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
  | "product_details"
  | "brand"
  | "color_sizing"
  | "development"
  | "print_embroidery"
  | "cut_sew_samples"
  | "costing"
  | "approvals"
  | "bulk"
  | "vendor_quotes"
  | "outputs";

const PRINT_CLASS_SECTIONS: AccordionSection[] = [
  "product_details",
  "brand",
  "color_sizing",
  "development",
  "print_embroidery",
  "vendor_quotes",
  "costing",
  "approvals",
  "bulk",
  "outputs",
];

const CUT_SEW_CLASS_SECTIONS: AccordionSection[] = [
  "product_details",
  "brand",
  "color_sizing",
  "development",
  "print_embroidery",
  "cut_sew_samples",
  "vendor_quotes",
  "costing",
  "approvals",
  "bulk",
  "outputs",
];

const BRANDING_CLASS_SECTIONS: AccordionSection[] = [
  "product_details",
  "brand",
  "color_sizing",
  "development",
  "print_embroidery",
  "vendor_quotes",
  "costing",
  "outputs",
];

export function accordionSectionsFor(type: JobType | undefined): AccordionSection[] {
  if (isCutSewClassJobType(type)) return CUT_SEW_CLASS_SECTIONS;
  if (isBrandingClassJobType(type)) return BRANDING_CLASS_SECTIONS;
  if (isPrintClassJobType(type)) return PRINT_CLASS_SECTIONS;
  return PRINT_CLASS_SECTIONS;
}
