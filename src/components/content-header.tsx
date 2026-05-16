"use client";

import type { ReactNode } from "react";
import { NotificationsPopover } from "@/components/notifications-popover";

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
        <NotificationsPopover buttonClassName="relative rounded-full p-2 text-text-secondary hover:bg-surface-body" />
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

