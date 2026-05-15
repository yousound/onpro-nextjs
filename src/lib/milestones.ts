import type { Project } from "@/lib/types/project";

/**
 * Single source for milestone progress + WIP dot strip. Each `pick` maps to a real `Project` field.
 *
 * Milestones are **derived** only (no separate store in this UI). A dot is filled when the mapped
 * field is non-empty / for booleans when true. With a real backend, any **project row update +
 * refetch** (or optimistic local patch) recomputes the strip on the next React render.
 */
export const MILESTONE_DEFINITIONS: readonly {
  id: string;
  label: string;
  pick: (p: Project) => string | boolean | null | undefined;
}[] = [
  { id: "client_meeting", label: "Client meeting", pick: (p) => p.client_meeting_date },
  { id: "assets", label: "Client assets", pick: (p) => p.client_assets_received_date },
  { id: "cs_tp", label: "C&S tech pack", pick: (p) => p.cs_tech_pack_complete_date },
  { id: "art_tp", label: "Artwork TP", pick: (p) => p.artwork_tech_pack_complete_date },
  { id: "art_approval", label: "Art approval", pick: (p) => p.artwork_design_client_approval_date },
  { id: "tp_sent", label: "TP to factory", pick: (p) => p.tp_sent_date },
  { id: "quote", label: "Quote req", pick: (p) => p.quote_requested_date },
  { id: "cost_sheet", label: "Cost sheet", pick: (p) => p.cost_sheet_prepared_date },
  { id: "estimate", label: "Estimate sent", pick: (p) => p.estimate_sent_date },
  { id: "costing_ok", label: "Costing approved", pick: (p) => p.costing_approved },
  { id: "lab_dip", label: "Lab dip", pick: (p) => p.lab_dip_received_date },
  { id: "strike", label: "Strike-off", pick: (p) => p.strike_off_received_date },
  { id: "bulk_fabric", label: "Bulk fabric", pick: (p) => p.bulk_fabric_approval_date },
  { id: "top", label: "TOP", pick: (p) => p.top_approved_date },
  { id: "ex_factory", label: "Ex-factory", pick: (p) => p.ex_factory_date },
  { id: "delivered", label: "Client received", pick: (p) => p.client_received_date },
] as const;

export function milestoneFilledCount(project: Project): number {
  return MILESTONE_DEFINITIONS.filter((m) => {
    const v = m.pick(project);
    if (typeof v === "boolean") return v === true;
    return v != null && String(v).length > 0;
  }).length;
}

export function milestoneProgressPercent(project: Project): number {
  const total = MILESTONE_DEFINITIONS.length;
  if (total === 0) return 0;
  return Math.round((100 * milestoneFilledCount(project)) / total);
}
