"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette } from "@/components/command-palette";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh min-h-0 overflow-hidden bg-surface-body">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-contain">{children}</div>
      <CommandPalette />
    </div>
  );
}
