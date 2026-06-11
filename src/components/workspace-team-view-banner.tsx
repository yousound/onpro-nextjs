"use client";

import { useMemo } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { workspaceDisplayName } from "@/lib/workspace-display-name";

export function WorkspaceTeamViewBanner() {
  const { isTeamView, active, joinedTeams, canSwitch, switchWorkspace } = useWorkspace();

  const viewedName = useMemo(() => {
    if (!isTeamView) return active.workspaceName;
    const team = joinedTeams.find((t) => t.operatorUserId === active.operatorUserId);
    return workspaceDisplayName({
      workspaceName: team?.workspaceName ?? active.workspaceName,
      contactCompanyName: team?.contactDisplayName,
      fallback: active.workspaceName,
    });
  }, [isTeamView, active, joinedTeams]);

  if (!isClientLiveBackend() || !isTeamView || !canSwitch) return null;

  return (
    <div className="shrink-0 border-b border-violet-200/80 bg-violet-50/90 px-4 py-2 text-center text-sm text-violet-950">
      Viewing &ldquo;<span className="font-semibold">{viewedName}</span>&rdquo; Workspace
      {" · "}
      <button
        type="button"
        className="font-semibold text-accent underline-offset-2 hover:underline"
        onClick={() => void switchWorkspace(null)}
      >
        Switch to my workspace
      </button>
    </div>
  );
}
