"use client";

import type { ThreadSmartAttachment } from "@/lib/mock/message-threads";

function kindLabel(kind: string) {
  const map: Record<string, string> = {
    job: "Job",
    estimate: "Estimate",
    quote: "Quote",
    approval: "Approval",
    purchase_order: "Purchase order",
    payment: "Payment",
    invoice: "Invoice",
    receiving: "Receiving",
    packing_list: "Packing list",
    tracking: "Tracking",
    task: "Task",
    calendar_event: "Calendar event",
  };
  return map[kind] ?? kind;
}

/**
 * Read-only view when opening an attachment from the thread (not the + composer).
 * Use “Edit attachment” to open the full builder workspace.
 */
export function AttachmentReaderModal(props: {
  open: boolean;
  attachment: ThreadSmartAttachment | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { open, attachment: a, onClose, onEdit } = props;
  if (!open || !a) return null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-attachment-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{kindLabel(a.kind)}</p>
            <h2 id="reader-attachment-title" className="text-lg font-bold text-slate-900">
              {a.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3">
            <p className="text-xs font-medium text-violet-900">Reading view</p>
            <p className="mt-1 text-xs leading-relaxed text-violet-800/90">
              This is how the attachment appears in the thread. Editing opens the attachment builder — separate from
              this preview.
            </p>
          </div>

          {a.badge ? (
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">{a.badge}</span>
            </p>
          ) : null}
          {a.subtitle ? <p className="text-sm text-slate-600">{a.subtitle}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Edit attachment
          </button>
        </div>
      </div>
    </div>
  );
}
