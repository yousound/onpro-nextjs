"use client";

import { useCallback, useMemo, useState } from "react";
import type { Project } from "@/lib/types/project";
import type { ProjectJob, ProjectOrder } from "@/lib/types/wip";
import { formatShortDate, isoToDateInput, dateInputToIso } from "@/lib/format";
import { createNewOrderSeed } from "@/lib/project-order-create";
import { jobsForOrder } from "@/lib/project-order-edits";
import { JOB_TYPE_OPTIONS } from "@/lib/reference/category-codes";
import { effectiveJobPoDisplay } from "@/lib/effective-po";
import { JobStatusBadge } from "@/components/job-status-badge";

function effectivePo(order: ProjectOrder): string {
  return order.client_po_number?.trim() || order.po_number?.trim() || "—";
}

function jobTypeLabel(job: ProjectJob): string {
  const hit = JOB_TYPE_OPTIONS.find((o) => o.value === job.job_type);
  return hit?.label ?? job.type ?? "—";
}

function OrderJobCard({
  job,
  orderDueYmd,
  expanded,
  onToggle,
  onOpenDetails,
}: {
  job: ProjectJob;
  orderDueYmd?: string | null;
  expanded: boolean;
  onToggle: () => void;
  onOpenDetails: () => void;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-text-primary">{job.name || "Untitled style"}</p>
            <JobStatusBadge job={job} orderDueYmd={orderDueYmd} />
          </div>
          <p className="mt-0.5 font-mono text-xs text-accent">{job.style_number || "—"}</p>
        </div>
        <span className="text-xs text-text-secondary">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded ? (
        <div className="border-t border-border-light px-4 py-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-bold uppercase text-text-secondary">Description</dt>
              <dd>{job.description?.trim() || job.subtitle?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase text-text-secondary">Color</dt>
              <dd>{job.colorway?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase text-text-secondary">Size breakdown</dt>
              <dd>{job.size_breakdown?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase text-text-secondary">Price</dt>
              <dd>{job.price?.trim() || "—"}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={onOpenDetails}
            className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Job details
          </button>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  project: Project;
  orders: ProjectOrder[];
  jobs: ProjectJob[];
  operatorCode: string;
  allProjects: Project[];
  onOrdersChange: (orders: ProjectOrder[]) => void;
  onOpenJob: (jobId: string) => void;
  onAddJobToOrder: (orderId: string) => void;
  onAddJob?: () => void;
};

export function ProjectOrdersSection({
  project,
  orders,
  jobs,
  operatorCode,
  allProjects,
  onOrdersChange,
  onOpenJob,
  onAddJobToOrder,
  onAddJob,
}: Props) {
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(() => new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(() => new Set());

  const toggleOrder = useCallback((id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleJob = useCallback((id: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateOrder = useCallback(() => {
    const seed = createNewOrderSeed(project, orders, operatorCode, allProjects);
    onOrdersChange([...orders, seed]);
    setExpandedOrders((prev) => new Set(prev).add(seed.id));
  }, [project, orders, operatorCode, allProjects, onOrdersChange]);

  const handleOrderField = useCallback(
    (orderId: string, patch: Partial<ProjectOrder>) => {
      onOrdersChange(
        orders.map((o) =>
          o.id === orderId ? { ...o, ...patch, updated_at: new Date().toISOString() } : o,
        ),
      );
    },
    [orders, onOrdersChange],
  );

  const overviewJobs = useMemo(() => jobs, [jobs]);

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const jobPo = useCallback(
    (job: ProjectJob) =>
      effectiveJobPoDisplay(job, {
        order: job.order_id ? orderById.get(job.order_id) : orders[0],
        project,
      }) || "—",
    [orderById, orders, project],
  );

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-text-primary">
            Jobs
            <span className="ml-2 font-normal text-text-secondary">({overviewJobs.length} jobs)</span>
          </h3>
          {onAddJob ? (
            <button
              type="button"
              onClick={onAddJob}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
            >
              + Add job
            </button>
          ) : null}
        </div>
        {overviewJobs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-light px-4 py-6 text-sm text-text-secondary">
            No jobs yet. Tap + Add job or create an order below.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-light bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-light bg-slate-50/80 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
                  <th className="px-4 py-2">Style name</th>
                  <th className="px-4 py-2">Style #</th>
                  <th className="px-4 py-2">PO #</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2">Breakdown</th>
                  <th className="px-4 py-2">Job type</th>
                </tr>
              </thead>
              <tbody>
                {overviewJobs.map((job) => (
                  <tr
                    key={job.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenJob(job.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenJob(job.id);
                      }
                    }}
                    className="cursor-pointer border-b border-border-light transition hover:bg-violet-50/50"
                  >
                    <td className="px-4 py-2.5 font-semibold">{job.name || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{job.style_number || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{jobPo(job)}</td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {job.description?.trim() || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {job.size_breakdown?.trim() || "—"}
                    </td>
                    <td className="px-4 py-2.5">{jobTypeLabel(job)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-text-primary">
            Orders
            <span className="ml-2 font-normal text-text-secondary">({orders.length})</span>
          </h3>
          <button
            type="button"
            onClick={handleCreateOrder}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            + New order
          </button>
        </div>

        {orders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-light px-4 py-6 text-sm text-text-secondary">
            No orders yet. Create an order to assign jobs (MAT-style order numbers).
          </p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const orderJobs = jobsForOrder(order.id, jobs);
              const open = expandedOrders.has(order.id);
              return (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-xl border border-border-light bg-slate-50/40"
                >
                  <button
                    type="button"
                    onClick={() => toggleOrder(order.id)}
                    className="flex w-full flex-wrap items-center gap-4 border-b border-border-light bg-white px-4 py-3 text-left"
                  >
                    <span className="font-mono text-sm font-bold text-accent">{order.order_number}</span>
                    <span className="text-sm text-text-secondary">
                      Due {formatShortDate(order.due_date) || "—"}
                    </span>
                    <span className="text-sm font-mono text-text-primary">PO {effectivePo(order)}</span>
                    <span className="ml-auto text-xs text-text-secondary">
                      {orderJobs.length} job{orderJobs.length === 1 ? "" : "s"} {open ? "▼" : "▶"}
                    </span>
                  </button>
                  {open ? (
                    <div className="space-y-3 px-4 py-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="text-xs font-semibold text-text-secondary">
                          Due date
                          <input
                            type="date"
                            className="mt-1 w-full rounded-lg border border-border-light px-2 py-1.5 text-sm"
                            value={isoToDateInput(order.due_date)}
                            onChange={(e) =>
                              handleOrderField(order.id, {
                                due_date: dateInputToIso(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="text-xs font-semibold text-text-secondary">
                          Our PO
                          <input
                            className="mt-1 w-full rounded-lg border border-border-light px-2 py-1.5 text-sm font-mono"
                            value={order.po_number ?? ""}
                            onChange={(e) =>
                              handleOrderField(order.id, {
                                po_number: e.target.value.trim() || null,
                              })
                            }
                          />
                        </label>
                        <label className="text-xs font-semibold text-text-secondary">
                          Client PO
                          <input
                            className="mt-1 w-full rounded-lg border border-border-light px-2 py-1.5 text-sm font-mono"
                            value={order.client_po_number ?? ""}
                            onChange={(e) =>
                              handleOrderField(order.id, {
                                client_po_number: e.target.value.trim() || null,
                              })
                            }
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onAddJobToOrder(order.id)}
                          className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-violet-50"
                        >
                          + Add job to order
                        </button>
                      </div>
                      <div className="space-y-2">
                        {orderJobs.length === 0 ? (
                          <p className="text-xs text-text-secondary">No jobs on this order yet.</p>
                        ) : (
                          orderJobs.map((job) => (
                            <OrderJobCard
                              key={job.id}
                              job={job}
                              orderDueYmd={order.due_date}
                              expanded={expandedJobs.has(job.id)}
                              onToggle={() => toggleJob(job.id)}
                              onOpenDetails={() => onOpenJob(job.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
