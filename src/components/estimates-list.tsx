"use client";

import type { Estimate, EstimateStatus, ProjectJob } from "@/lib/types/wip";
import { costingTotals } from "@/lib/costing-sheet";
import { openEstimatePrintWindow } from "@/lib/estimate-print";

const STATUS_OPTIONS: EstimateStatus[] = ["draft", "sent", "accepted", "rejected"];

function currency(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusClass: Record<EstimateStatus, string> = {
  draft: "bg-slate-100 text-text-secondary ring-border-light",
  sent: "bg-blue-100 text-blue-800 ring-blue-300/50",
  accepted: "bg-emerald-100 text-emerald-800 ring-emerald-300/50",
  rejected: "bg-red-100 text-red-700 ring-red-300/50",
};

export function EstimatesList({
  estimates,
  onChange,
  job,
  clientName,
}: {
  estimates: Estimate[];
  onChange: (next: Estimate[]) => void;
  job: ProjectJob;
  clientName?: string;
}) {
  if (estimates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-light bg-slate-50/80 px-4 py-6 text-center text-sm text-text-secondary">
        No estimates generated yet. Build the cost sheet and click <strong>Generate Estimate</strong>.
      </p>
    );
  }

  function patch(id: string, partial: Partial<Estimate>) {
    onChange(estimates.map((e) => (e.id === id ? { ...e, ...partial } : e)));
  }

  function remove(id: string) {
    onChange(estimates.filter((e) => e.id !== id));
  }

  function markSent(id: string) {
    patch(id, { status: "sent", sent_at: new Date().toISOString() });
  }

  return (
    <div className="space-y-2">
      {estimates.map((est) => {
        const totals = costingTotals(est.costing_sheet_snapshot);
        return (
          <div
            key={est.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm font-bold text-text-primary">
                {est.document_number}
              </p>
              <p className="text-[11px] text-text-secondary">
                Created {est.created_at ? new Date(est.created_at).toLocaleDateString() : "—"}
                {est.sent_at ? ` · Sent ${new Date(est.sent_at).toLocaleDateString()}` : null}
                {" · "}
                {est.costing_sheet_snapshot.lines.length} line
                {est.costing_sheet_snapshot.lines.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-700">
                {currency(totals.final_cost_to_quote_client)}
              </span>
              <select
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ring-1 ${statusClass[est.status]}`}
                value={est.status}
                onChange={(e) => patch(est.id, { status: e.target.value as EstimateStatus })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {est.status === "draft" ? (
                <button
                  type="button"
                  onClick={() => markSent(est.id)}
                  className="rounded-lg border border-accent/40 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-violet-50"
                >
                  Mark sent
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => openEstimatePrintWindow(job, est, { clientName })}
                className="rounded-lg border border-border-light px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-slate-50"
                title="Open print preview in a new tab"
              >
                Print preview
              </button>
              <button
                type="button"
                onClick={() => remove(est.id)}
                className="rounded-md px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"
                aria-label="Remove estimate"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
