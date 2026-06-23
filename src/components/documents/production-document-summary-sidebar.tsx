"use client";

import { formatUsdDetailed } from "@/lib/ledger/format";
import { computeProductionDocumentTotals } from "@/lib/documents/production-document-draft";
import type { ProductionDocument } from "@/lib/documents/production-document-types";

type DocUiKind = "estimate" | "invoice" | "po" | "vendor_quote";

const underlineInput =
  "w-full border-0 border-b border-slate-300 bg-transparent py-1 text-sm font-medium text-slate-900 outline-none focus:border-accent";

function docTitle(kind: ProductionDocument["kind"], uiKind: DocUiKind): string {
  if (uiKind === "invoice") return "Invoice";
  if (uiKind === "po" || kind === "vendor_po") return "Purchase order";
  if (uiKind === "vendor_quote" || kind === "vendor_quote") return "Vendor quote";
  return "Estimate";
}

export function ProductionDocumentSummarySidebar({
  draft,
  uiKind,
  status,
  onChange,
  readOnly,
}: {
  draft: ProductionDocument;
  uiKind: DocUiKind;
  status: string;
  onChange?: (draft: ProductionDocument) => void;
  readOnly?: boolean;
}) {
  const totals = computeProductionDocumentTotals(draft);
  const title = docTitle(draft.kind, uiKind);

  function patch(fields: Partial<ProductionDocument>) {
    if (!onChange || readOnly) return;
    onChange({ ...draft, ...fields });
  }

  return (
    <aside className="flex min-h-0 min-w-0 w-full shrink-0 flex-col border-t border-slate-200 bg-white xl:w-72 xl:max-w-[20rem] xl:border-l xl:border-t-0">
      <div className="max-h-[min(42vh,28rem)] flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 xl:max-h-none">
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>
        <p className="mt-0.5 break-all font-mono text-sm text-slate-600">
          # {draft.documentNumber || "Draft"}
        </p>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{status}</p>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-slate-500">Date</dt>
            {readOnly || !onChange ? (
              <dd className="mt-0.5 font-medium">{draft.documentDate || "—"}</dd>
            ) : (
              <input
                className={underlineInput}
                value={draft.documentDate}
                onChange={(e) => patch({ documentDate: e.target.value })}
              />
            )}
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Terms</dt>
            {readOnly || !onChange ? (
              <dd className="mt-0.5 font-medium">{draft.terms || "—"}</dd>
            ) : (
              <input
                className={underlineInput}
                value={draft.terms}
                onChange={(e) => patch({ terms: e.target.value })}
              />
            )}
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Due date</dt>
            {readOnly || !onChange ? (
              <dd className="mt-0.5 font-medium">{draft.dueDate || "—"}</dd>
            ) : (
              <input
                className={underlineInput}
                value={draft.dueDate}
                onChange={(e) => patch({ dueDate: e.target.value })}
              />
            )}
          </div>
        </dl>

        <div className="mt-6 space-y-2 border-t border-slate-100 pt-6 text-sm">
          <div className="flex min-w-0 justify-between gap-3 tabular-nums">
            <span className="shrink-0 text-slate-600">Subtotal</span>
            <span className="min-w-0 truncate text-right font-medium">
              {formatUsdDetailed(totals.subtotalCents)}
            </span>
          </div>
          <div className="flex min-w-0 justify-between gap-3 tabular-nums">
            <span className="shrink-0 text-slate-600">Shipping</span>
            {readOnly || !onChange ? (
              <span className="min-w-0 truncate text-right font-medium">
                {formatUsdDetailed(totals.shippingCents)}
              </span>
            ) : (
              <input
                className={`${underlineInput} min-w-0 max-w-[7rem] shrink-0 text-right`}
                value={draft.shipping}
                onChange={(e) => patch({ shipping: e.target.value })}
              />
            )}
          </div>
          <div className="flex min-w-0 justify-between gap-3 border-t border-slate-100 pt-2 text-base tabular-nums">
            <span className="shrink-0 font-semibold text-slate-800">Total</span>
            <span className="min-w-0 truncate text-right font-bold">
              {formatUsdDetailed(totals.totalCents)}
            </span>
          </div>
          <div className="flex min-w-0 justify-between gap-3 tabular-nums">
            <span className="shrink-0 text-slate-600">Paid</span>
            {readOnly || !onChange ? (
              <span className="min-w-0 truncate text-right font-medium">
                {formatUsdDetailed(totals.paidCents)}
              </span>
            ) : (
              <input
                className={`${underlineInput} min-w-0 max-w-[7rem] shrink-0 text-right`}
                value={draft.paid}
                onChange={(e) => patch({ paid: e.target.value })}
              />
            )}
          </div>
          <div className="flex min-w-0 justify-between gap-3 pt-1 text-base tabular-nums">
            <span className="shrink-0 font-semibold text-slate-800">Balance</span>
            <span className="min-w-0 truncate text-right font-bold">
              {formatUsdDetailed(totals.balanceDueCents)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
