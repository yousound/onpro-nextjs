"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { formatUsdDetailed } from "@/lib/ledger/format";
import {
  computeProductionDocumentTotals,
  emptyProductionLine,
} from "@/lib/documents/production-document-draft";
import type {
  ProductionDocument,
  ProductionDocumentLine,
} from "@/lib/documents/production-document-types";
import "./production-document-editable-preview.css";

/** US Letter at 96dpi — matches print CSS in production-document-print. */
export const LETTER_WIDTH_PX = 816;
export const LETTER_HEIGHT_PX = 1056;

function docHeading(kind: ProductionDocument["kind"]): string {
  return kind === "vendor_po" ? "PURCHASE ORDER" : "ESTIMATE";
}

function docNumberLabel(kind: ProductionDocument["kind"]): string {
  return kind === "vendor_po" ? "Purchase Order No." : "Estimate No.";
}

function billToLabel(kind: ProductionDocument["kind"]): string {
  return kind === "vendor_po" ? "For" : "Bill To";
}

function updateLine(
  lines: ProductionDocumentLine[],
  id: string,
  patch: Partial<ProductionDocumentLine>,
): ProductionDocumentLine[] {
  return lines.map((line) => (line.id === id ? { ...line, ...patch } : line));
}

function EditableText({
  value,
  onChange,
  multiline,
  className = "",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const base =
    "doc-editable w-full border-0 bg-transparent p-0 font-inherit text-inherit outline-none placeholder:text-slate-300 focus:rounded-sm focus:bg-violet-50/80 focus:ring-1 focus:ring-violet-300/60";

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(1, value.split("\n").length)}
        placeholder={placeholder}
        className={`${base} resize-none ${className}`}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${base} ${className}`}
    />
  );
}

function MetaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="doc-meta-field">
      <span className="doc-meta-label">{label}</span>
      <EditableText value={value} onChange={onChange} className="font-semibold" />
    </div>
  );
}

export function ProductionDocumentEditablePreview({
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

  function workingLines(): ProductionDocumentLine[] {
    return draft.lines.length > 0 ? draft.lines : [emptyProductionLine()];
  }

  function patchLine(id: string, linePatch: Partial<ProductionDocumentLine>) {
    patchLines(updateLine(workingLines(), id, linePatch));
  }

  const visibleLines = workingLines();

  return (
    <article className="production-doc-preview">
      <header className="doc-preview-top">
        <div className="doc-preview-brand">
          <Image
            src="/cd-label-logo.png"
            alt="Connect Dots"
            width={120}
            height={52}
            className="doc-preview-logo"
          />
          <div>
            <p className="doc-preview-issuer">{draft.issuerName || "Connect Dots"}</p>
            <h1 className="doc-preview-heading">{docHeading(draft.kind)}</h1>
          </div>
        </div>
      </header>

      <section className="doc-preview-meta-grid">
        <div className="doc-preview-bill-to">
          <h2>{billToLabel(draft.kind)}</h2>
          <EditableText
            value={draft.billToName}
            onChange={(v) => patch({ billToName: v })}
            className="doc-preview-name font-bold"
            placeholder="Name"
          />
          <EditableText
            value={draft.billToEmail}
            onChange={(v) => patch({ billToEmail: v })}
            placeholder="Email"
          />
          <EditableText
            value={draft.billToAddress1}
            onChange={(v) => patch({ billToAddress1: v })}
            multiline
            placeholder="Address"
          />
          <EditableText
            value={draft.billToAddress2}
            onChange={(v) => patch({ billToAddress2: v })}
            multiline
            placeholder="City, state, zip"
          />
        </div>
        <div className="doc-preview-doc-meta">
          <MetaField
            label={docNumberLabel(draft.kind)}
            value={draft.documentNumber}
            onChange={(v) => patch({ documentNumber: v })}
          />
          <MetaField label="Date" value={draft.documentDate} onChange={(v) => patch({ documentDate: v })} />
          <MetaField label="Terms" value={draft.terms} onChange={(v) => patch({ terms: v })} />
          <MetaField label="Due Date" value={draft.dueDate} onChange={(v) => patch({ dueDate: v })} />
        </div>
      </section>

      {draft.kind === "vendor_po" ? (
        <section className="doc-preview-meta-grid">
          <div className="doc-preview-bill-to">
            <h2>Ship To</h2>
            <EditableText
              value={draft.shipToName}
              onChange={(v) => patch({ shipToName: v })}
              className="doc-preview-name font-bold"
              placeholder="Name"
            />
            <EditableText
              value={draft.shipToAddress1}
              onChange={(v) => patch({ shipToAddress1: v })}
              multiline
              placeholder="Address"
            />
            <EditableText
              value={draft.shipToAddress2}
              onChange={(v) => patch({ shipToAddress2: v })}
              multiline
              placeholder="City, state, zip"
            />
          </div>
          <div className="doc-preview-doc-meta">
            <MetaField
              label="Tracking No."
              value={draft.trackingNumber}
              onChange={(v) => patch({ trackingNumber: v })}
            />
            <MetaField label="Ship Via" value={draft.shipVia} onChange={(v) => patch({ shipVia: v })} />
            <MetaField label="FOB" value={draft.fob} onChange={(v) => patch({ fob: v })} />
          </div>
        </section>
      ) : null}

      <section className="doc-preview-summary-box">
        <EditableText
          value={draft.projectName}
          onChange={(v) => patch({ projectName: v })}
          className="doc-preview-summary-title font-bold"
          placeholder="Project name"
        />
        <div className="doc-preview-summary-meta">
          <p>
            <strong>Project #:</strong>{" "}
            <EditableText
              value={draft.projectNumber}
              onChange={(v) => patch({ projectNumber: v })}
              className="inline min-w-[4rem]"
              placeholder="—"
            />
          </p>
          <p>
            <strong>Job #:</strong>{" "}
            <EditableText
              value={draft.jobNumber}
              onChange={(v) => patch({ jobNumber: v })}
              className="inline min-w-[4rem]"
              placeholder="—"
            />
          </p>
          <p>
            <strong>Reference:</strong>{" "}
            <EditableText
              value={draft.referenceNotes}
              onChange={(v) => patch({ referenceNotes: v })}
              className="inline min-w-[4rem]"
              placeholder="—"
            />
          </p>
        </div>
      </section>

      <table className="doc-preview-lines">
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Quantity</th>
            <th className="num">Rate</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {visibleLines.map((line, index) => {
            const amountCents = totals.lineAmountsCents[index] ?? 0;
            const hasContent = line.description.trim() || line.rate.trim();
            return (
              <tr key={line.id} className="group">
                <td className="desc">
                  <EditableText
                    value={line.description}
                    onChange={(v) => patchLine(line.id, { description: v })}
                    multiline
                    placeholder="Line description"
                  />
                </td>
                <td className="num">
                  <EditableText
                    value={line.quantity}
                    onChange={(v) => patchLine(line.id, { quantity: v })}
                    className="text-right"
                  />
                </td>
                <td className="num">
                  <EditableText
                    value={line.rate}
                    onChange={(v) => patchLine(line.id, { rate: v })}
                    className="text-right"
                    placeholder="0.00"
                  />
                </td>
                <td className="num amount">
                  {hasContent ? formatUsdDetailed(amountCents) : "—"}
                  {visibleLines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => patchLines(visibleLines.filter((l) => l.id !== line.id))}
                      className="ml-2 hidden text-[10px] font-semibold text-red-500 group-hover:inline"
                      aria-label="Remove line"
                    >
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => patchLines([...visibleLines, emptyProductionLine()])}
        className="mb-3 text-xs font-semibold text-violet-700 hover:underline"
      >
        + Add line item
      </button>

      <p className="doc-preview-tax-note">*Indicates non-taxable item</p>

      <div className="doc-preview-totals-wrap">
        <table className="doc-preview-totals">
          <tbody>
            <tr>
              <td>Subtotal</td>
              <td className="num">{formatUsdDetailed(totals.subtotalCents)}</td>
            </tr>
            <tr>
              <td>
                Shipping{" "}
                <EditableText
                  value={draft.shipping}
                  onChange={(v) => patch({ shipping: v })}
                  className="ml-1 inline w-16 text-right text-xs"
                  placeholder="0"
                />
              </td>
              <td className="num">{formatUsdDetailed(totals.shippingCents)}</td>
            </tr>
            <tr className="emph">
              <td>Total</td>
              <td className="num">{formatUsdDetailed(totals.totalCents)}</td>
            </tr>
            <tr>
              <td>
                Paid{" "}
                <EditableText
                  value={draft.paid}
                  onChange={(v) => patch({ paid: v })}
                  className="ml-1 inline w-16 text-right text-xs"
                  placeholder="0"
                />
              </td>
              <td className="num">{formatUsdDetailed(totals.paidCents)}</td>
            </tr>
            <tr className="emph balance">
              <td>Balance Due</td>
              <td className="num">{formatUsdDetailed(totals.balanceDueCents)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer className="doc-preview-footer">
        <section className="doc-preview-notes">
          <h3>Notes</h3>
          <EditableText
            value={draft.memoNotes}
            onChange={(v) => patch({ memoNotes: v })}
            multiline
            placeholder="Thank you for your business."
          />
        </section>
        <section className="doc-preview-notes terms">
          <h3>Terms and Conditions</h3>
          <EditableText
            value={draft.termsAndConditions}
            onChange={(v) => patch({ termsAndConditions: v })}
            multiline
            placeholder="Payment terms…"
          />
        </section>
        <section className="doc-preview-issuer-footer">
          <p>{draft.issuerAddress1}</p>
          <p>{draft.issuerAddress2}</p>
          <p>
            {draft.issuerEmail} · {draft.issuerWebsite}
          </p>
          {draft.taxRegNumber ? <p>Tax Reg N°: {draft.taxRegNumber}</p> : null}
        </section>
      </footer>
    </article>
  );
}

/** Letter-sized frame with zoom + editable WYSIWYG document. */
export function ProductionDocumentEditablePreviewFrame({
  draft,
  onChange,
  title,
}: {
  draft: ProductionDocument;
  onChange: (draft: ProductionDocument) => void;
  title?: string;
}) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200/90 bg-[#e8eaed]"
      aria-label={title ?? `Document ${draft.documentNumber}`}
    >
      <EditablePreviewCanvas draft={draft} onChange={onChange} />
    </div>
  );
}

function EditablePreviewCanvas({
  draft,
  onChange,
}: {
  draft: ProductionDocument;
  onChange: (draft: ProductionDocument) => void;
}) {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const scale = zoom / 100;

  const page = (
    <div className="flex flex-col items-center">
      <div
        className="origin-top transition-transform duration-150"
        style={{
          transform: `scale(${scale})`,
          width: LETTER_WIDTH_PX,
          minHeight: LETTER_HEIGHT_PX,
        }}
      >
        <div
          className="overflow-hidden bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80"
          style={{ width: LETTER_WIDTH_PX, minHeight: LETTER_HEIGHT_PX }}
        >
          <ProductionDocumentEditablePreview draft={draft} onChange={onChange} />
        </div>
      </div>
      <div
        className="shrink-0"
        style={{ height: Math.max(0, LETTER_HEIGHT_PX * scale - LETTER_HEIGHT_PX) + 24 }}
        aria-hidden
      />
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[130] flex flex-col bg-slate-200/95">
        <div className="flex items-center justify-between border-b border-slate-300/80 bg-white px-4 py-2">
          <p className="text-sm font-semibold text-slate-800">Document preview</p>
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Exit full screen
          </button>
        </div>
        <div className="flex-1 overflow-auto p-8">{page}</div>
        <PreviewZoomBar zoom={zoom} onZoom={setZoom} onFullscreen={() => setFullscreen(false)} fullscreen />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-auto px-4 py-8 sm:px-8">{page}</div>
      <PreviewZoomBar
        zoom={zoom}
        onZoom={setZoom}
        onFullscreen={() => setFullscreen(true)}
        fullscreen={false}
      />
    </>
  );
}

function PreviewZoomBar({
  zoom,
  onZoom,
  onFullscreen,
  fullscreen,
}: {
  zoom: number;
  onZoom: (z: number) => void;
  onFullscreen: () => void;
  fullscreen: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-3 border-t border-slate-300/60 bg-white/90 px-4 py-2.5 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => onZoom(Math.max(50, zoom - 10))}
        className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        aria-label="Zoom out"
      >
        −
      </button>
      <span className="min-w-[3rem] text-center text-sm font-semibold tabular-nums text-slate-700">
        {zoom}%
      </span>
      <button
        type="button"
        onClick={() => onZoom(Math.min(150, zoom + 10))}
        className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        aria-label="Zoom in"
      >
        +
      </button>
      <span className="text-slate-300">|</span>
      <span className="text-xs font-medium text-slate-500">1 / 1</span>
      {!fullscreen ? (
        <button
          type="button"
          onClick={onFullscreen}
          className="ml-2 flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Full screen preview"
        >
          ⛶
        </button>
      ) : null}
    </div>
  );
}
