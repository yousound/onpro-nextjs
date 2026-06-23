"use client";

import type { ReactNode } from "react";

export function CollapsibleLineCard({
  title,
  subtitle,
  open,
  onToggle,
  onRemove,
  removeLabel = "Remove",
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/80"
          aria-expanded={open}
        >
          <span
            className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            ▶
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-slate-900">{title}</span>
            {subtitle ? (
              <span className="mt-0.5 block truncate text-xs text-slate-500">{subtitle}</span>
            ) : null}
          </span>
        </button>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 border-l border-slate-100 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            {removeLabel}
          </button>
        ) : null}
      </div>
      {open ? <div className="border-t border-slate-100 px-4 py-4">{children}</div> : null}
    </div>
  );
}
