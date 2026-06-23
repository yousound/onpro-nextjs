"use client";

import { useMemo, useState, type ReactNode } from "react";
import { formatUsdDetailed } from "@/lib/ledger/format";
import {
  computeProductionDocumentTotals,
  emptyProductionLine,
} from "@/lib/documents/production-document-draft";
import {
  buildProductionDocumentPreviewDocument,
  exportProductionDocumentPdf,
} from "@/lib/documents/production-document-print";
import type {
  ProductionDocument,
  ProductionDocumentLine,
} from "@/lib/documents/production-document-types";

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

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
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
  lines: ProductionDocumentLine[],
  id: string,
  patch: Partial<ProductionDocumentLine>,
): ProductionDocumentLine[] {
  return lines.map((line) => (line.id === id ? { ...line, ...patch } : line));
}

function kindLabel(kind: ProductionDocument["kind"]): string {
  return kind === "vendor_po" ? "Purchase order" : "Client estimate";
}

function billToLabel(kind: ProductionDocument["kind"]): string {
  return kind === "vendor_po" ? "Vendor (for)" : "Bill to (client)";
}

function numberLabel(kind: ProductionDocument["kind"]): string {
  return kind === "vendor_po" ? "PO number" : "Estimate number";
}

export function ProductionDocumentEditor({
  initialDraft,
  onDraftChange,
  onPrint,
  onSend,
  hideToolbar,
  hidePreviewSection,
}: {
  initialDraft: ProductionDocument;
  onDraftChange?: (draft: ProductionDocument) => void;
  onPrint?: (draft: ProductionDocument) => void;
  onSend?: (draft: ProductionDocument) => void;
  hideToolbar?: boolean;
  /** Hide embedded PDF iframe (fullscreen preview tab renders it separately). */
  hidePreviewSection?: boolean;
}) {
  const [draft, setDraft] = useState(initialDraft);

  const totals = useMemo(() => computeProductionDocumentTotals(draft), [draft]);
  const previewDoc = useMemo(() => buildProductionDocumentPreviewDocument(draft), [draft]);

  function patch(fields: Partial<ProductionDocument>) {
    setDraft((d) => {
      const next = { ...d, ...fields };
      onDraftChange?.(next);
      return next;
    });
  }

  function patchLines(lines: ProductionDocumentLine[]) {
    patch({ lines });
  }

  function exportPdf() {
    onPrint?.(draft);
    exportProductionDocumentPdf(draft);
  }

  return (
    <div className="space-y-6">
      {hideToolbar ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-text-primary">{kindLabel(draft.kind)}</p>
            <p className="text-sm text-text-secondary">
              {draft.documentNumber || "Draft"} · Connect Dots
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSend ? (
              <button
                type="button"
                onClick={() => onSend(draft)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
              >
                Send via Mailroom
              </button>
            ) : null}
            <button
              type="button"
              onClick={exportPdf}
              className="rounded-lg border border-accent/40 bg-white px-4 py-2 text-sm font-semibold text-accent hover:bg-violet-50"
            >
              Print / Export PDF
            </button>
          </div>
        </div>
      )}

      <Section title="Connect Dots (issuer)">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Issuer name" value={draft.issuerName} onChange={(v) => patch({ issuerName: v })} />
          <Field label="Issuer email" value={draft.issuerEmail} onChange={(v) => patch({ issuerEmail: v })} />
          <Field
            label="Issuer address 1"
            value={draft.issuerAddress1}
            onChange={(v) => patch({ issuerAddress1: v })}
          />
          <Field
            label="Issuer address 2"
            value={draft.issuerAddress2}
            onChange={(v) => patch({ issuerAddress2: v })}
          />
          <Field label="Website" value={draft.issuerWebsite} onChange={(v) => patch({ issuerWebsite: v })} />
          <Field label="Tax reg #" value={draft.taxRegNumber} onChange={(v) => patch({ taxRegNumber: v })} />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={billToLabel(draft.kind)}>
          <div className="space-y-3">
            <Field label="Name" value={draft.billToName} onChange={(v) => patch({ billToName: v })} />
            <Field label="Email" value={draft.billToEmail} onChange={(v) => patch({ billToEmail: v })} />
            <Field
              label="Address 1"
              value={draft.billToAddress1}
              onChange={(v) => patch({ billToAddress1: v })}
            />
            <Field
              label="Address 2"
              value={draft.billToAddress2}
              onChange={(v) => patch({ billToAddress2: v })}
              multiline
            />
          </div>
        </Section>

        <Section title="Document details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={numberLabel(draft.kind)}
              value={draft.documentNumber}
              onChange={(v) => patch({ documentNumber: v })}
            />
            <Field label="Date" value={draft.documentDate} onChange={(v) => patch({ documentDate: v })} />
            <Field label="Terms" value={draft.terms} onChange={(v) => patch({ terms: v })} />
            <Field label="Due date" value={draft.dueDate} onChange={(v) => patch({ dueDate: v })} />
          </div>
        </Section>
      </div>

      {draft.kind === "vendor_po" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Ship to">
            <div className="space-y-3">
              <Field label="Name" value={draft.shipToName} onChange={(v) => patch({ shipToName: v })} />
              <Field
                label="Address 1"
                value={draft.shipToAddress1}
                onChange={(v) => patch({ shipToAddress1: v })}
              />
              <Field
                label="Address 2"
                value={draft.shipToAddress2}
                onChange={(v) => patch({ shipToAddress2: v })}
                multiline
              />
            </div>
          </Section>
          <Section title="Shipping details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Tracking #"
                value={draft.trackingNumber}
                onChange={(v) => patch({ trackingNumber: v })}
              />
              <Field label="Ship via" value={draft.shipVia} onChange={(v) => patch({ shipVia: v })} />
              <Field label="FOB" value={draft.fob} onChange={(v) => patch({ fob: v })} />
              <Field label="Shipping $" value={draft.shipping} onChange={(v) => patch({ shipping: v })} />
            </div>
          </Section>
        </div>
      ) : (
        <Section title="Shipping">
          <div className="max-w-xs">
            <Field label="Shipping $" value={draft.shipping} onChange={(v) => patch({ shipping: v })} />
          </div>
        </Section>
      )}

      <Section title="Project reference">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Project name" value={draft.projectName} onChange={(v) => patch({ projectName: v })} />
          <Field
            label="Project number"
            value={draft.projectNumber}
            onChange={(v) => patch({ projectNumber: v })}
          />
          <Field label="Job number" value={draft.jobNumber} onChange={(v) => patch({ jobNumber: v })} />
          <Field
            label="Reference"
            value={draft.referenceNotes}
            onChange={(v) => patch({ referenceNotes: v })}
          />
        </div>
      </Section>

      <Section
        title="Line items"
        action={
          <button
            type="button"
            onClick={() => patchLines([...draft.lines, emptyProductionLine()])}
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
                  <span className="text-xs font-semibold uppercase text-text-secondary">
                    Line {index + 1}
                  </span>
                  {draft.lines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => patchLines(draft.lines.filter((l) => l.id !== line.id))}
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
                  <label className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={Boolean(line.non_taxable)}
                      onChange={(e) =>
                        patchLines(updateLine(draft.lines, line.id, { non_taxable: e.target.checked }))
                      }
                    />
                    Non-taxable (shows * on PDF)
                  </label>
                ) : null}
                <p className="mt-2 text-right text-sm tabular-nums text-text-secondary">
                  Amount:{" "}
                  <span className="font-semibold text-text-primary">
                    {formatUsdDetailed(amountCents)}
                  </span>
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
              <dt className="text-text-secondary">Shipping</dt>
              <dd className="font-medium">{formatUsdDetailed(totals.shippingCents)}</dd>
            </div>
            <div className="flex justify-between tabular-nums">
              <dt className="text-text-secondary">Total</dt>
              <dd className="font-semibold">{formatUsdDetailed(totals.totalCents)}</dd>
            </div>
            <div className="pt-2">
              <Field label="Paid" value={draft.paid} onChange={(v) => patch({ paid: v })} />
            </div>
            <div className="flex justify-between border-t border-border-light pt-2 tabular-nums text-base">
              <dt className="font-medium">Balance due</dt>
              <dd className="font-bold">{formatUsdDetailed(totals.balanceDueCents)}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Notes & terms">
          <div className="space-y-3">
            <Field label="Memo / notes" value={draft.memoNotes} onChange={(v) => patch({ memoNotes: v })} multiline />
            <Field
              label="Terms and conditions"
              value={draft.termsAndConditions}
              onChange={(v) => patch({ termsAndConditions: v })}
              multiline
            />
          </div>
        </Section>
      </div>

      {hidePreviewSection ? null : (
      <Section title="Export preview">
        <p className="mb-3 text-sm text-text-secondary">
          Live preview with Connect Dots branding. Print / Export PDF opens the print dialog — save as
          PDF or send to a printer.
        </p>
        <iframe
          title={`${kindLabel(draft.kind)} ${draft.documentNumber} preview`}
          srcDoc={previewDoc}
          className="h-[min(1100px,80vh)] w-full rounded-lg border border-border-light bg-slate-100"
        />
      </Section>
      )}
    </div>
  );
}
