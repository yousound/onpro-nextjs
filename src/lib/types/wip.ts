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
  /** Full WIP for this job (includes costing + bulk production steps). */
  timeline: WipStep[];
};
