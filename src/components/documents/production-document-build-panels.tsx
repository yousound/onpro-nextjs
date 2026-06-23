"use client";

import { useMemo } from "react";
import { formatUsdDetailed } from "@/lib/ledger/format";
import {
  computeProductionDocumentTotals,
  emptyProductionLine,
} from "@/lib/documents/production-document-draft";
import type {
  ProductionDocument,
  ProductionDocumentLine,
} from "@/lib/documents/production-document-types";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15";
const labelClass = "mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400";

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
    </label>
  );
}

function updateLine(
  lines: ProductionDocumentLine[],
  id: string,
  patch: Partial<ProductionDocumentLine>,
): ProductionDocumentLine[] {
  return lines.map((line) => (line.id === id ? { ...line, ...patch } : line));
}

function billToLabel(kind: ProductionDocument["kind"]): string {
  return kind === "vendor_po" ? "Vendor (for)" : "Bill to (client)";
}

function numberLabel(kind: ProductionDocument["kind"]): string {
  return kind === "vendor_po" ? "PO number" : "Estimate number";
}

export function ProductionDocumentFieldsPanel({
  draft,
  onChange,
}: {
  draft: ProductionDocument;
  onChange: (draft: ProductionDocument) => void;
}) {
  function patch(fields: Partial<ProductionDocument>) {
    onChange({ ...draft, ...fields });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Issuer</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Issuer name" value={draft.issuerName} onChange={(v) => patch({ issuerName: v })} />
          <Field label="Issuer email" value={draft.issuerEmail} onChange={(v) => patch({ issuerEmail: v })} />
          <Field label="Address 1" value={draft.issuerAddress1} onChange={(v) => patch({ issuerAddress1: v })} />
          <Field label="Address 2" value={draft.issuerAddress2} onChange={(v) => patch({ issuerAddress2: v })} />
          <Field label="Website" value={draft.issuerWebsite} onChange={(v) => patch({ issuerWebsite: v })} />
          <Field label="Tax reg #" value={draft.taxRegNumber} onChange={(v) => patch({ taxRegNumber: v })} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{billToLabel(draft.kind)}</h3>
          <div className="mt-4 space-y-3">
            <Field label="Name" value={draft.billToName} onChange={(v) => patch({ billToName: v })} />
            <Field label="Email" value={draft.billToEmail} onChange={(v) => patch({ billToEmail: v })} />
            <Field label="Address 1" value={draft.billToAddress1} onChange={(v) => patch({ billToAddress1: v })} />
            <Field
              label="Address 2"
              value={draft.billToAddress2}
              onChange={(v) => patch({ billToAddress2: v })}
              multiline
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Document details</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label={numberLabel(draft.kind)}
              value={draft.documentNumber}
              onChange={(v) => patch({ documentNumber: v })}
            />
            <Field label="Date" value={draft.documentDate} onChange={(v) => patch({ documentDate: v })} />
            <Field label="Terms" value={draft.terms} onChange={(v) => patch({ terms: v })} />
            <Field label="Due date" value={draft.dueDate} onChange={(v) => patch({ dueDate: v })} />
          </div>
        </section>
      </div>

      {draft.kind === "vendor_po" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Ship to</h3>
            <div className="mt-4 space-y-3">
              <Field label="Name" value={draft.shipToName} onChange={(v) => patch({ shipToName: v })} />
              <Field label="Address 1" value={draft.shipToAddress1} onChange={(v) => patch({ shipToAddress1: v })} />
              <Field
                label="Address 2"
                value={draft.shipToAddress2}
                onChange={(v) => patch({ shipToAddress2: v })}
                multiline
              />
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Shipping</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Tracking #" value={draft.trackingNumber} onChange={(v) => patch({ trackingNumber: v })} />
              <Field label="Ship via" value={draft.shipVia} onChange={(v) => patch({ shipVia: v })} />
              <Field label="FOB" value={draft.fob} onChange={(v) => patch({ fob: v })} />
              <Field label="Shipping $" value={draft.shipping} onChange={(v) => patch({ shipping: v })} />
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Shipping</h3>
          <div className="mt-4 max-w-xs">
            <Field label="Shipping $" value={draft.shipping} onChange={(v) => patch({ shipping: v })} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Project reference</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Project name" value={draft.projectName} onChange={(v) => patch({ projectName: v })} />
          <Field label="Project number" value={draft.projectNumber} onChange={(v) => patch({ projectNumber: v })} />
          <Field label="Job number" value={draft.jobNumber} onChange={(v) => patch({ jobNumber: v })} />
          <Field label="Reference" value={draft.referenceNotes} onChange={(v) => patch({ referenceNotes: v })} />
        </div>
      </section>
    </div>
  );
}

export function ProductionDocumentLinesPanel({
  draft,
  onChange,
}: {
  draft: ProductionDocument;
  onChange: (draft: ProductionDocument) => void;
}) {
  const totals = useMemo(() => computeProductionDocumentTotals(draft), [draft]);

  function patch(fields: Partial<ProductionDocument>) {
    onChange({ ...draft, ...fields });
  }

  function patchLines(lines: ProductionDocumentLine[]) {
    patch({ lines });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Line items</h3>
          <button
            type="button"
            onClick={() => patchLines([...draft.lines, emptyProductionLine()])}
            className="text-sm font-semibold text-[#7c3aed] hover:underline"
          >
            + Add line
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {draft.lines.map((line, index) => {
            const amountCents = totals.lineAmountsCents[index] ?? 0;
            return (
              <div key={line.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-500">Line {index + 1}</span>
                  {draft.lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => patchLines(draft.lines.filter((l) => l.id !== line.id))}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <Field
                      label="Description"
                      value={line.description}
                      onChange={(v) => patchLines(updateLine(draft.lines, line.id, { description: v }))}
                      multiline
                    />
                  </div>
                  <Field
                    label="Quantity"
                    value={line.quantity}
                    onChange={(v) => patchLines(updateLine(draft.lines, line.id, { quantity: v }))}
                  />
                  <Field
                    label="Rate"
                    value={line.rate}
                    onChange={(v) => patchLines(updateLine(draft.lines, line.id, { rate: v }))}
                  />
                </div>
                {draft.kind === "vendor_po" ? (
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(line.non_taxable)}
                      onChange={(e) =>
                        patchLines(updateLine(draft.lines, line.id, { non_taxable: e.target.checked }))
                      }
                    />
                    Non-taxable
                  </label>
                ) : null}
                <p className="mt-2 text-right text-sm tabular-nums text-slate-600">
                  Amount{" "}
                  <span className="font-bold text-slate-900">{formatUsdDetailed(amountCents)}</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Totals</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between tabular-nums">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="font-medium">{formatUsdDetailed(totals.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between tabular-nums">
              <dt className="text-slate-500">Shipping</dt>
              <dd className="font-medium">{formatUsdDetailed(totals.shippingCents)}</dd>
            </div>
            <div className="flex justify-between tabular-nums">
              <dt className="text-slate-500">Total</dt>
              <dd className="font-semibold">{formatUsdDetailed(totals.totalCents)}</dd>
            </div>
            <div className="pt-2">
              <Field label="Paid" value={draft.paid} onChange={(v) => patch({ paid: v })} />
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 tabular-nums">
              <dt className="font-medium">Balance due</dt>
              <dd className="font-bold">{formatUsdDetailed(totals.balanceDueCents)}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Notes & terms</h3>
          <div className="mt-4 space-y-3">
            <Field label="Memo / notes" value={draft.memoNotes} onChange={(v) => patch({ memoNotes: v })} multiline />
            <Field
              label="Terms and conditions"
              value={draft.termsAndConditions}
              onChange={(v) => patch({ termsAndConditions: v })}
              multiline
            />
          </div>
        </section>
      </div>
    </div>
  );
}
