"use client";

import { useMemo } from "react";
import type { ProjectJob, JobColorwayRow } from "@/lib/types/wip";
import { colorwayRowTotal } from "@/lib/job-colorways";
import { JobStatusBadge } from "@/components/job-status-badge";
import { jobTypeLabel } from "@/components/job-details-modal-helpers";

function MetaChip({
  label,
  value,
  dot,
}: {
  label: string;
  value: string;
  dot?: "blue" | "green" | "gray" | "amber";
}) {
  const dotClass =
    dot === "green"
      ? "bg-emerald-500"
      : dot === "blue"
        ? "bg-sky-500"
        : dot === "amber"
          ? "bg-amber-500"
          : "bg-slate-300";
  return (
    <div className="min-w-[8.5rem] flex-1 rounded-xl border border-border-light bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
        {dot ? <span className={`size-2 shrink-0 rounded-full ${dotClass}`} aria-hidden /> : null}
        {value}
      </p>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "green" | "gray" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        tone === "green" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

export function JobDetailsSummary({
  draft,
  categoryDropdown,
  colorwayRows,
  orderDueYmd,
}: {
  draft: ProjectJob;
  categoryDropdown: string;
  colorwayRows: JobColorwayRow[];
  orderDueYmd?: string | null;
}) {
  const qtyTotal = useMemo(
    () => colorwayRows.reduce((sum, row) => sum + colorwayRowTotal(row), 0),
    [colorwayRows],
  );

  const primaryColorway = colorwayRows[0];
  const sizeRange =
    primaryColorway?.size_run?.length
      ? `${primaryColorway.size_run[0] ?? ""} – ${primaryColorway.size_run[primaryColorway.size_run.length - 1] ?? ""}`
      : "—";

  const quotes = draft.vendor_quotes ?? [];
  const quoteReady = quotes.some((q) => q.status === "received");
  const estimates = draft.estimates ?? [];
  const estimateStatus =
    estimates.some((e) => e.status === "accepted")
      ? "Accepted"
      : estimates.some((e) => e.status === "sent")
        ? "Sent"
        : estimates.length > 0
          ? "Draft"
          : "Not added";

  const costingLines = draft.costing_sheet?.lines ?? [];
  const scopeRows =
    costingLines.length > 0
      ? costingLines.map((line) => ({
          item: line.description || "Line item",
          details: line.vendor ? `Vendor: ${line.vendor}` : line.note?.trim() || "—",
          ready: line.price > 0,
        }))
      : [
          { item: "Front print", details: "1-color screen print on front", ready: quoteReady },
          { item: "Neck print", details: "Inside neck print", ready: false },
          { item: "Tag removal", details: "Remove neck tag", ready: false },
          { item: "Fold & bag", details: "Fold and polybag", ready: false },
        ];

  const brandBlank =
    [draft.garment_brand, draft.garment_style_number].filter(Boolean).join(" ") ||
    draft.garment_style_number?.trim() ||
    "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <MetaChip label="Job type" value={jobTypeLabel(draft.job_type)} />
        <MetaChip label="Category" value={categoryDropdown || "—"} />
        <MetaChip label="Brand / Blank" value={brandBlank} />
        <MetaChip
          label="Status"
          value={draft.status}
          dot={draft.status === "Completed" ? "green" : draft.status === "In progress" ? "blue" : "gray"}
        />
        <MetaChip
          label="Quote readiness"
          value={quoteReady ? "Ready to quote" : "Draft"}
          dot={quoteReady ? "green" : "gray"}
        />
        <MetaChip
          label="Estimate status"
          value={estimateStatus}
          dot={estimateStatus === "Not added" ? "gray" : estimateStatus === "Sent" ? "green" : "blue"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border-light bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-text-primary">Product summary</h3>
          <div className="mt-4 flex gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-3xl">
              👕
            </div>
            <dl className="min-w-0 space-y-1.5 text-sm">
              <div>
                <dt className="text-text-secondary">Style #</dt>
                <dd className="font-semibold text-text-primary">{draft.style_number?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Style name</dt>
                <dd className="font-semibold text-text-primary">{draft.name?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Colorway</dt>
                <dd className="font-semibold text-text-primary">
                  {primaryColorway?.name?.trim() || draft.colorway?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Size range</dt>
                <dd className="font-semibold text-text-primary">{sizeRange}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Total qty</dt>
                <dd className="font-semibold text-text-primary">
                  {qtyTotal > 0 ? `${qtyTotal} units` : "—"}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-2xl border border-border-light bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-text-primary">Job progress</h3>
          <p className="mt-1 text-xs text-text-secondary">This job&apos;s production record.</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="text-text-secondary">Quote candidates</span>
              <StatusPill label={quoteReady ? "Ready to quote" : "Draft"} tone={quoteReady ? "green" : "gray"} />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-text-secondary">Costing</span>
              <StatusPill
                label={costingLines.length > 0 ? "In progress" : "Not added"}
                tone={costingLines.length > 0 ? "green" : "gray"}
              />
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-text-secondary">Outputs</span>
              <StatusPill
                label={estimates.length > 0 ? "Generated" : "Not generated"}
                tone={estimates.length > 0 ? "green" : "gray"}
              />
            </li>
          </ul>
          <div className="mt-4 flex justify-end">
            <JobStatusBadge job={draft} orderDueYmd={orderDueYmd} />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border-light bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-text-primary">Production scope</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border-light text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                <th className="pb-2 pr-4">Item</th>
                <th className="pb-2 pr-4">Details</th>
                <th className="pb-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {scopeRows.map((row) => (
                <tr key={row.item} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-text-primary">{row.item}</td>
                  <td className="py-2.5 pr-4 text-text-secondary">{row.details}</td>
                  <td className="py-2.5 text-right">
                    <StatusPill
                      label={row.ready ? "Ready to quote" : "Draft"}
                      tone={row.ready ? "green" : "gray"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
