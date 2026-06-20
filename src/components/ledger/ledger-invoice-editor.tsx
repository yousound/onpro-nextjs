"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useLedger } from "@/components/ledger/ledger-provider";
import { formatUsdDetailed } from "@/lib/ledger/format";
import {
  buildInvoiceDraftFromLedger,
  computeInvoiceTotals,
  emptyInvoiceLine,
  syncLedgerSummaryFields,
} from "@/lib/ledger/invoice-draft";
import {
  buildInvoicePreviewDocument,
  exportInvoicePdf,
} from "@/lib/ledger/invoice-print";
import type { LedgerInvoiceLineDraft, LedgerPrintableInvoice } from "@/lib/ledger/invoice-types";

const inputClass =
  "w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary";
const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-text-secondary";

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

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function updateLine(
  lines: LedgerInvoiceLineDraft[],
  id: string,
  patch: Partial<LedgerInvoiceLineDraft>,
): LedgerInvoiceLineDraft[] {
  return lines.map((line) => (line.id === id ? { ...line, ...patch } : line));
}

export function LedgerInvoiceEditor({ sourceInvoiceId }: { sourceInvoiceId?: string }) {
  const { state, metrics } = useLedger();
  const sourceInvoice = sourceInvoiceId
    ? state.invoices.find((i) => i.id === sourceInvoiceId)
    : undefined;

  const [draft, setDraft] = useState<LedgerPrintableInvoice>(() => {
    const nextPendingOnProInvoice = state.invoices.find(
      (i) => i.projectId === "onpro" && i.status === "pending",
    );
    return buildInvoiceDraftFromLedger({
      metrics: { ...metrics, monthlyRetainerCents: state.onpro.monthlyRetainerCents },
      sourceInvoice,
      nextPendingOnProInvoice,
    });
  });

  const totals = useMemo(() => computeInvoiceTotals(draft), [draft]);
  const previewDoc = useMemo(() => buildInvoicePreviewDocument(draft), [draft]);

  const patch = (patchFields: Partial<LedgerPrintableInvoice>) => {
    setDraft((d) => ({ ...d, ...patchFields }));
  };

  const syncFromLedger = () => {
    setDraft((d) => syncLedgerSummaryFields(d, metrics));
  };

  const exportPdf = () => {
    exportInvoicePdf(draft);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/ledger/financial/invoices" className="text-sm text-accent hover:underline">
            ← Back to invoices
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={syncFromLedger}
            className="rounded-lg border border-border-light px-3 py-2 text-sm font-medium hover:bg-surface-body"
          >
            Sync ledger totals
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Print / Export PDF
          </button>
        </div>
      </div>

      <Section title="Header">
        <div className="max-w-sm">
          <Field label="Issuer name" value={draft.issuerName} onChange={(v) => patch({ issuerName: v })} />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Bill to">
          <div className="space-y-3">
            <Field label="Bill to name" value={draft.billToName} onChange={(v) => patch({ billToName: v })} />
            <Field label="Bill to email" value={draft.billToEmail} onChange={(v) => patch({ billToEmail: v })} />
            <Field
              label="Bill to address 1"
              value={draft.billToAddress1}
              onChange={(v) => patch({ billToAddress1: v })}
            />
            <Field
              label="Bill to address 2"
              value={draft.billToAddress2}
              onChange={(v) => patch({ billToAddress2: v })}
            />
          </div>
        </Section>

        <Section title="Invoice details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Invoice number"
              value={draft.invoiceNumber}
              onChange={(v) => patch({ invoiceNumber: v })}
            />
            <Field label="Invoice date" value={draft.invoiceDate} onChange={(v) => patch({ invoiceDate: v })} />
            <Field label="Terms" value={draft.terms} onChange={(v) => patch({ terms: v })} />
            <Field label="Due date" value={draft.dueDate} onChange={(v) => patch({ dueDate: v })} />
            <Field
              label="Scheduled payment date"
              value={draft.scheduledPaymentDate}
              onChange={(v) => patch({ scheduledPaymentDate: v })}
            />
          </div>
        </Section>
      </div>

      <Section
        title="OnPro development summary"
        action={
          <span className="text-xs text-text-secondary">Cap after this invoice: {formatUsdDetailed(totals.capRemainingAfterCents)}</span>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Field label="Project name" value={draft.projectName} onChange={(v) => patch({ projectName: v })} />
          <Field
            label="Ledger reference"
            value={draft.ledgerReference}
            onChange={(v) => patch({ ledgerReference: v })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Project value" value={draft.projectValue} onChange={(v) => patch({ projectValue: v })} />
          <Field label="Value accrued" value={draft.valueAccrued} onChange={(v) => patch({ valueAccrued: v })} />
          <Field
            label="Work finished %"
            value={draft.workFinishedPercent}
            onChange={(v) => patch({ workFinishedPercent: v })}
          />
          <Field label="Paid to date" value={draft.paidToDate} onChange={(v) => patch({ paidToDate: v })} />
          <Field
            label="Cap remaining (before)"
            value={draft.capRemainingBefore}
            onChange={(v) => patch({ capRemainingBefore: v })}
          />
        </div>
      </Section>

      <Section
        title="Line items"
        action={
          <button
            type="button"
            onClick={() => patch({ lines: [...draft.lines, emptyInvoiceLine()] })}
            className="text-sm font-medium text-accent hover:underline"
          >
            + Add line
          </button>
        }
      >
        <div className="space-y-4">
          {draft.lines.map((line, index) => {
            const amountCents = totals.lineAmountsCents[index] ?? 0;
            return (
              <div key={line.id} className="rounded-lg border border-border-light p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-text-secondary">Line {index + 1}</span>
                  {draft.lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => patch({ lines: draft.lines.filter((l) => l.id !== line.id) })}
                      className="text-xs text-red-600 hover:underline"
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
                      onChange={(v) => patch({ lines: updateLine(draft.lines, line.id, { description: v }) })}
                      multiline
                    />
                  </div>
                  <Field
                    label="Quantity"
                    value={line.quantity}
                    onChange={(v) => patch({ lines: updateLine(draft.lines, line.id, { quantity: v }) })}
                  />
                  <Field
                    label="Rate"
                    value={line.rate}
                    onChange={(v) => patch({ lines: updateLine(draft.lines, line.id, { rate: v }) })}
                  />
                </div>
                <p className="mt-2 text-right text-sm tabular-nums text-text-secondary">
                  Amount: <span className="font-semibold text-text-primary">{formatUsdDetailed(amountCents)}</span>
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Totals">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between tabular-nums">
              <dt className="text-text-secondary">Subtotal</dt>
              <dd className="font-medium">{formatUsdDetailed(totals.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between tabular-nums">
              <dt className="text-text-secondary">Total</dt>
              <dd className="font-semibold">{formatUsdDetailed(totals.totalCents)}</dd>
            </div>
            <div className="pt-2">
              <Field label="Paid (on this invoice)" value={draft.paid} onChange={(v) => patch({ paid: v })} />
            </div>
            <div className="flex justify-between border-t border-border-light pt-2 tabular-nums text-base">
              <dt className="font-medium">Balance due</dt>
              <dd className="font-bold">{formatUsdDetailed(totals.balanceDueCents)}</dd>
            </div>
            <div className="flex justify-between tabular-nums text-sm">
              <dt className="text-text-secondary">Cap after payment</dt>
              <dd className="font-semibold text-accent">{formatUsdDetailed(totals.capRemainingAfterCents)}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Notes">
          <div className="space-y-3">
            <Field label="Memo / payment context" value={draft.memoNotes} onChange={(v) => patch({ memoNotes: v })} multiline />
            <Field
              label="Payment schedule note"
              value={draft.paymentScheduleNote}
              onChange={(v) => patch({ paymentScheduleNote: v })}
              multiline
            />
          </div>
        </Section>
      </div>

      <Section title="Export preview">
        <p className="mb-3 text-sm text-text-secondary">
          Live preview below. Print / Export PDF opens a new window with the print dialog — save as PDF or send to a printer.
        </p>
        <iframe
          title={`Invoice ${draft.invoiceNumber} preview`}
          srcDoc={previewDoc}
          className="h-[min(1100px,80vh)] w-full rounded-lg border border-border-light bg-slate-100"
        />
      </Section>
    </div>
  );
}
