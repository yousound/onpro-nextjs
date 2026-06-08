"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AssistantChatModal } from "@/components/assistant-chat-modal";
import { CommandPalette } from "@/components/command-palette";
import { ProfileProvider } from "@/components/profile-provider";
import { WorkspaceWelcomeGate } from "@/components/workspace-welcome-gate";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <div className="flex h-svh min-h-0 overflow-hidden bg-surface-body">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-contain">
          {children}
        </div>
        <CommandPalette />
        <AssistantChatModal />
        <WorkspaceWelcomeGate />
      </div>
    </ProfileProvider>
  );
}
