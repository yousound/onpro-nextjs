"use client";

import type { ReactNode } from "react";

export function ContentHeader({
  breadcrumbs,
  actions,
}: {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border-light bg-surface-card px-4 sm:px-6">
      <div className="min-w-0 flex-1">{breadcrumbs}</div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <button
          type="button"
          className="rounded-full p-2 text-text-secondary hover:bg-surface-body"
          aria-label="Notifications"
        >
          <BellIcon />
        </button>
        <div className="flex items-center gap-2 pl-1">
          <span className="hidden text-sm text-text-secondary sm:inline">Demo user</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
            DU
          </span>
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
