"use client";

import { useWorkspace } from "@/components/workspace-provider";
import { isClientLiveBackend } from "@/lib/config/backend-mode";

export function WorkspaceTeamViewBanner() {
  const { isTeamView, active, canSwitch, switchWorkspace, loading } = useWorkspace();

  if (!isClientLiveBackend() || loading || !isTeamView || !canSwitch) return null;

  return (
    <div className="shrink-0 border-b border-violet-200/80 bg-violet-50/90 px-4 py-2 text-center text-sm text-violet-950">
      Viewing{" "}
      <span className="font-semibold">{active.workspaceName}</span>
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
