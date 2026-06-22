import type { Project } from "@/lib/types/project";
import type { ProjectJob, ProjectOrder } from "@/lib/types/wip";
import { effectiveOrderPoDisplay } from "@/lib/effective-po";

export function normalizePo(value: string): string {
  return value.trim().toUpperCase();
}

export function poFromRecord(
  record: {
    po_number?: string | null;
    client_po_number?: string | null;
    project_number?: string | null;
  },
): string | null {
  const client = record.client_po_number?.trim();
  if (client) return normalizePo(client);
  const po = record.po_number?.trim();
  if (po) return normalizePo(po);
  const pn = record.project_number?.trim();
  if (pn) return normalizePo(pn);
  return null;
}

/** Distinct normalized PO strings assigned on an order (our PO + client PO when both set). */
export function orderPoNumbers(order: Pick<ProjectOrder, "po_number" | "client_po_number">): string[] {
  const out: string[] = [];
  const po = order.po_number?.trim();
  const client = order.client_po_number?.trim();
  if (po) out.push(normalizePo(po));
  if (client) {
    const key = normalizePo(client);
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

export function findProjectWithPo(
  po: string,
  projects: Pick<Project, "id" | "name" | "po_number" | "project_number">[],
  excludeProjectId?: number,
): Pick<Project, "id" | "name"> | undefined {
  const key = normalizePo(po);
  if (!key) return undefined;
  return projects.find((p) => {
    if (excludeProjectId != null && p.id === excludeProjectId) return false;
    return poFromRecord(p) === key;
  });
}

export function findOrderWithPoOnProject(
  po: string,
  orders: ProjectOrder[],
  excludeOrderId?: string,
): ProjectOrder | undefined {
  const key = normalizePo(po);
  if (!key) return undefined;
  return orders.find((o) => {
    if (excludeOrderId != null && o.id === excludeOrderId) return false;
    return orderPoNumbers(o).includes(key);
  });
}

export function findJobWithExplicitPoOnProject(
  po: string,
  projectId: number,
  jobs: ProjectJob[],
  excludeJobId?: string,
): ProjectJob | undefined {
  const key = normalizePo(po);
  if (!key) return undefined;
  return jobs.find((j) => {
    if (j.project_id !== projectId) return false;
    if (excludeJobId != null && j.id === excludeJobId) return false;
    const explicit = poFromRecord(j);
    if (!explicit) return false;
    return explicit === key;
  });
}

export function formatPoDuplicateMessage(
  po: string,
  kind: "project" | "order" | "job",
  existingLabel: string,
): string {
  if (kind === "project") {
    return `Project number ${po} is already used on project “${existingLabel}”. Each project must have a unique project number.`;
  }
  if (kind === "order") {
    return `PO ${po} is already used on order “${existingLabel}” in this project. Each order needs a unique PO.`;
  }
  return `PO ${po} is already used on job “${existingLabel}” in this project. Each job needs a unique PO.`;
}

export function validateProjectPoUnique(
  po: string,
  projects: Pick<Project, "id" | "name" | "po_number" | "project_number">[],
  excludeProjectId?: number,
): string | null {
  const trimmed = po.trim();
  if (!trimmed) return null;
  const dup = findProjectWithPo(trimmed, projects, excludeProjectId);
  if (!dup) return null;
  return formatPoDuplicateMessage(normalizePo(trimmed), "project", dup.name);
}

export function validateOrderPoOnProject(
  po: string,
  orders: ProjectOrder[],
  excludeOrderId?: string,
): string | null {
  const trimmed = po.trim();
  if (!trimmed) return null;
  const dup = findOrderWithPoOnProject(trimmed, orders, excludeOrderId);
  if (!dup) return null;
  const label =
    effectiveOrderPoDisplay(dup) ||
    dup.order_number?.trim() ||
    "another shipment batch";
  return formatPoDuplicateMessage(normalizePo(trimmed), "order", label);
}

export function validateJobPoOnProject(
  po: string,
  projectId: number,
  jobs: ProjectJob[],
  orders: ProjectOrder[] = [],
  excludeJobId?: string,
): string | null {
  const trimmed = po.trim();
  if (!trimmed) return null;
  const key = normalizePo(trimmed);

  const jobDup = findJobWithExplicitPoOnProject(trimmed, projectId, jobs, excludeJobId);
  if (jobDup) {
    return formatPoDuplicateMessage(
      key,
      "job",
      jobDup.name?.trim() || jobDup.job_number || "Untitled",
    );
  }

  const orderDup = findOrderWithPoOnProject(trimmed, orders);
  if (orderDup) {
    const label =
      effectiveOrderPoDisplay(orderDup) ||
      orderDup.order_number?.trim() ||
      "another shipment batch";
    return `PO ${key} is already used on order “${label}” in this project. Each job needs a unique PO.`;
  }

  return null;
}

/** Validate explicit PO fields on a job before save. */
export function validateJobPoFields(
  job: Pick<ProjectJob, "id" | "project_id" | "name" | "job_number" | "po_number" | "client_po_number">,
  jobs: ProjectJob[],
  orders: ProjectOrder[] = [],
): string | null {
  const rawFields = [job.client_po_number?.trim(), job.po_number?.trim()].filter(Boolean) as string[];
  const seen = new Set<string>();
  for (const raw of rawFields) {
    const key = normalizePo(raw);
    if (seen.has(key)) {
      return `PO ${key} cannot be set as both client PO and our PO on the same job.`;
    }
    seen.add(key);
    const msg = validateJobPoOnProject(raw, job.project_id, jobs, orders, job.id);
    if (msg) return msg;
  }
  return null;
}
