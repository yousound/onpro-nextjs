"use client";

import type { ReactNode } from "react";

export function AttachmentPreviewModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex flex-col bg-slate-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-preview-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preview</p>
          <h2 id="attachment-preview-title" className="truncate text-lg font-bold text-slate-900">
            {title}
          </h2>
          {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            aria-label="Print preview"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Close
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8 print:overflow-visible print:p-0">
        <div className="mx-auto max-w-4xl print:max-w-none">{children}</div>
      </div>
    </div>
  );
}
