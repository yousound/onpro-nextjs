"use client";

import type { ReactNode } from "react";
import { AssistantQuickOpenButton } from "@/components/assistant-quick-open-button";
import { NotificationsPopover } from "@/components/notifications-popover";

export function ContentHeader({
  breadcrumbs,
  actions,
}: {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200/80 bg-surface-body px-4 sm:px-6">
      <div className="min-w-0 flex-1">{breadcrumbs}</div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <AssistantQuickOpenButton buttonClassName="relative rounded-full p-2 text-accent hover:bg-violet-50" />
        <NotificationsPopover buttonClassName="relative rounded-full p-2 text-text-secondary hover:bg-surface-body" />
      </div>
    </header>
  );
}

