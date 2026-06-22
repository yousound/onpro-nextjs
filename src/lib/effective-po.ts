import { projectPoNumber } from "@/lib/po-number";
import { effectivePoNumber } from "@/lib/po-context";
import type { Project } from "@/lib/types/project";
import type { ProjectJob, ProjectOrder } from "@/lib/types/wip";

/** Effective PO for display — job fields, then order, then project. */
export function effectiveJobPoDisplay(
  job: Pick<ProjectJob, "client_po_number" | "po_number" | "order_id">,
  opts?: {
    order?: Pick<ProjectOrder, "client_po_number" | "po_number"> | null;
    project?: Pick<Project, "po_number" | "project_number"> | null;
  },
): string {
  const fromJob = effectivePoNumber(job);
  if (fromJob) return fromJob;
  const order = opts?.order;
  if (order) {
    const fromOrder = order.client_po_number?.trim() || order.po_number?.trim();
    if (fromOrder) return fromOrder;
  }
  const fromProject = opts?.project ? projectPoNumber(opts.project) : null;
  return fromProject ?? "";
}

export function effectiveOrderPoDisplay(
  order: Pick<ProjectOrder, "client_po_number" | "po_number">,
  project?: Pick<Project, "po_number" | "project_number"> | null,
): string {
  return (
    order.client_po_number?.trim() ||
    order.po_number?.trim() ||
    (project ? projectPoNumber(project) : null) ||
    ""
  );
}

/** User-facing order label — PO/project number, not internal CD order numbers. */
export function orderDisplayLabel(
  order: Pick<ProjectOrder, "client_po_number" | "po_number">,
  project?: Pick<Project, "po_number" | "project_number"> | null,
  index = 0,
): string {
  const po = effectiveOrderPoDisplay(order, project);
  if (po) return po;
  return `Shipment ${index + 1}`;
}
