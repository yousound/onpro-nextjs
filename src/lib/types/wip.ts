export type WipStepState = "completed" | "in_progress" | "upcoming" | "na";

export type WipStep = {
  id: string;
  label: string;
  /** Compact SLA shown on the connector (e.g. "2–3d"). */
  durationShort?: string;
  /** Full SLA text for tooltips / edit modal. */
  durationLabel?: string;
  state: WipStepState;
};

export type JobStatusLabel = "In progress" | "Upcoming" | "Completed";

/** Original deliverable vs add-on / change-order work kept on the same project (billing storyline). */
export type JobScopeKind = "original" | "addon";

export type ProjectJob = {
  id: string;
  project_id: number;
  name: string;
  subtitle: string;
  type: string;
  lead_vendor: string;
  category: string;
  style_number: string;
  status: JobStatusLabel;
  due_date: string | null;
  updated_at: string;
  /** Defaults to `original` when absent (older saved jobs). */
  scope_kind?: JobScopeKind;
  /** Ops note, e.g. "+50 units — same invoice bucket". */
  scope_note?: string;
  /** Full WIP for this job (includes costing + bulk production steps). */
  timeline: WipStep[];
};
