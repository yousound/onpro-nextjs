"use client";

import { useMemo } from "react";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { ProjectJob, VendorQuote, VendorQuoteStatus } from "@/lib/types/wip";
import { newVendorQuote } from "@/lib/costing-sheet";
import type { FinancialDocMode } from "@/components/financial-document-fullscreen";
import { MailroomThreadLink } from "@/components/documents/document-compose-modal";
import { VendorFieldSelect } from "@/components/vendor-select";
import {
  defaultVendorForNewQuote,
  jobVendorsMissingQuotes,
} from "@/lib/job-vendors";

const fieldClass =
  "w-full min-w-0 rounded-md border border-border-light px-2.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const numFieldClass =
  "w-full min-w-[5.5rem] rounded-md border border-border-light px-2.5 py-2 text-right text-sm tabular-nums text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const noteFieldClass =
  "w-full min-w-[10rem] rounded-md border border-border-light px-2.5 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const STATUS_OPTIONS: VendorQuoteStatus[] = ["draft", "sent", "received"];

const statusClass: Record<VendorQuoteStatus, string> = {
  draft: "bg-slate-100 text-text-secondary",
  sent: "bg-blue-100 text-blue-800",
  received: "bg-emerald-100 text-emerald-800",
};

function parseNumber(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function VendorQuotesSection({
  project: _project,
  job,
  quotes,
  vendors,
  onChange,
  onPullToCosting,
  onQuoteReceived,
  onOpenInFinancials,
}: {
  project: Project;
  job: ProjectJob;
  quotes: VendorQuote[];
  vendors: Contact[];
  onChange: (next: VendorQuote[]) => void;
  onPullToCosting?: (quoteId: string) => void;
  onQuoteReceived?: (quoteId: string) => void;
  /** Opens the quote in the project Financials workspace (preview / send). */
  onOpenInFinancials?: (quoteId: string, mode?: FinancialDocMode) => void;
}) {
  const quoteIdsInCosting = useMemo(() => {
    const ids = new Set<string>();
    for (const line of job.costing_sheet?.lines ?? []) {
      if (line.vendor_quote_id) ids.add(line.vendor_quote_id);
    }
    return ids;
  }, [job.costing_sheet?.lines]);

  function handlePullToCosting(quoteId: string) {
    if (quoteIdsInCosting.has(quoteId)) return;
    onPullToCosting?.(quoteId);
  }

  function patch(id: string, partial: Partial<VendorQuote>) {
    onChange(quotes.map((q) => (q.id === id ? { ...q, ...partial } : q)));
  }
  function add(partial?: Partial<VendorQuote>) {
    const vendor = partial?.vendor?.trim() || defaultVendorForNewQuote(job, quotes);
    onChange([
      ...quotes,
      newVendorQuote({
        vendor,
        item_description:
          partial?.item_description ??
          job.name?.trim() ??
          job.style_name?.trim() ??
          "",
        ...partial,
      }),
    ]);
  }

  function addForVendor(vendorName: string) {
    add({ vendor: vendorName });
  }

  const missingJobVendors = jobVendorsMissingQuotes(job, quotes);
  function remove(id: string) {
    onChange(quotes.filter((q) => q.id !== id));
  }

  function markReceived(id: string) {
    const now = new Date().toISOString();
    patch(id, { status: "received", received_at: now });
    onQuoteReceived?.(id);
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-text-secondary">
            Inbound vendor quotes for this job. Each sent request has a unique vendor PO. Vendors
            come from <strong>Job vendors</strong> above or the job <strong>Supplier</strong> on
            Overview. Preview and send POs in the project <strong>Financials</strong> tab.
          </p>
          <button
            type="button"
            onClick={() => add()}
            className="shrink-0 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-violet-50"
          >
            + Add quote
          </button>
        </div>

        {missingJobVendors.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2">
            <span className="text-xs text-text-secondary">Add quote row for:</span>
            {missingJobVendors.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => addForVendor(name)}
                className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-accent ring-1 ring-accent/30 hover:bg-violet-100"
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}

        {quotes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-light bg-slate-50/80 px-4 py-6 text-center text-sm text-text-secondary">
            No vendor quotes yet. Use <strong>Request vendor quotes</strong> on the project or add
            manually.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-text-secondary sm:hidden">
              Swipe the table sideways — <strong>Preview / Send</strong> stays pinned on the right.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border-light bg-white">
            <table className="w-full min-w-[68rem] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="min-w-[6.5rem] whitespace-nowrap px-3 py-2.5">Vendor PO</th>
                  <th className="min-w-[5.5rem] whitespace-nowrap px-3 py-2.5">Status</th>
                  <th className="min-w-[9rem] px-3 py-2.5">Vendor</th>
                  <th className="min-w-[12rem] px-3 py-2.5">Item / description</th>
                  <th className="min-w-[6.5rem] whitespace-nowrap px-3 py-2.5 text-right">Unit cost</th>
                  <th className="min-w-[5rem] whitespace-nowrap px-3 py-2.5 text-right">Qty</th>
                  <th className="min-w-[11rem] px-3 py-2.5">Notes</th>
                  <th className="sticky right-0 z-10 min-w-[10.5rem] whitespace-nowrap border-l border-border-light bg-slate-50 px-3 py-2.5 text-right shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.12)]">
                    Send / actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const status = q.status ?? "draft";
                  const inCosting = quoteIdsInCosting.has(q.id);
                  return (
                    <tr key={q.id} className="border-t border-border-light/70 align-top">
                      <td className="px-3 py-2">
                        <p className="font-mono text-xs font-semibold text-accent">
                          {q.po_number?.trim() || "—"}
                        </p>
                        {q.mailroom_thread_id ? (
                          <MailroomThreadLink threadId={q.mailroom_thread_id} />
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${statusClass[status]}`}
                          value={status}
                          onChange={(e) => {
                            const next = e.target.value as VendorQuoteStatus;
                            patch(q.id, {
                              status: next,
                              ...(next === "received"
                                ? { received_at: new Date().toISOString() }
                                : {}),
                              ...(next === "sent" ? { sent_at: new Date().toISOString() } : {}),
                            });
                            if (next === "received") onQuoteReceived?.(q.id);
                          }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="min-w-[9rem] px-3 py-2">
                        <VendorFieldSelect
                          label=""
                          labelClassName="sr-only"
                          vendors={vendors}
                          value={q.vendor}
                          onChange={(name) => patch(q.id, { vendor: name ?? "" })}
                        />
                      </td>
                      <td className="min-w-[12rem] px-3 py-2">
                        <input
                          className={fieldClass}
                          value={q.item_description}
                          onChange={(e) => patch(q.id, { item_description: e.target.value })}
                          placeholder="e.g. 5-color plastisol print"
                        />
                      </td>
                      <td className="min-w-[6.5rem] px-3 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className={numFieldClass}
                          value={q.unit_cost || ""}
                          onChange={(e) => patch(q.id, { unit_cost: parseNumber(e.target.value) })}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="min-w-[5rem] px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          className={numFieldClass}
                          value={q.qty || ""}
                          onChange={(e) => patch(q.id, { qty: parseNumber(e.target.value) })}
                          placeholder="1"
                        />
                      </td>
                      <td className="min-w-[11rem] px-3 py-2">
                        <input
                          className={noteFieldClass}
                          value={q.notes ?? ""}
                          onChange={(e) => patch(q.id, { notes: e.target.value || undefined })}
                          placeholder="Optional note"
                        />
                      </td>
                      <td className="sticky right-0 z-10 border-l border-border-light/70 bg-white px-3 py-2 shadow-[-4px_0_8px_-4px_rgba(15,23,42,0.08)]">
                        <div className="flex w-[10.5rem] flex-col items-stretch gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenInFinancials?.(q.id, "edit")}
                            disabled={!onOpenInFinancials}
                            className="relative z-10 whitespace-nowrap rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Preview / Send
                          </button>
                          {onPullToCosting ? (
                            inCosting ? (
                              <p className="text-center text-[11px] font-semibold leading-snug text-emerald-700">
                                This has been sent to costing
                              </p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePullToCosting(q.id)}
                                className="whitespace-nowrap rounded-md bg-accent/10 px-2 py-1.5 text-[11px] font-bold text-accent hover:bg-accent/20"
                                title="Add as a line on the cost sheet"
                              >
                                → Cost
                              </button>
                            )
                          ) : null}
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {status === "sent" ? (
                              <button
                                type="button"
                                onClick={() => markReceived(q.id)}
                                className="shrink-0 whitespace-nowrap rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100"
                                title="Mark quote received"
                              >
                                Received
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => remove(q.id)}
                              className="shrink-0 rounded-md px-1.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50"
                              aria-label="Remove quote"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
