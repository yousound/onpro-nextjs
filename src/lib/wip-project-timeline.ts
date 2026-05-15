import type { Project } from "@/lib/types/project";
import type { WipStep, WipStepState } from "@/lib/types/wip";

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
