"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { writeActiveWorkspaceSession } from "@/lib/workspace-context";
import type { WorkspaceView } from "@/lib/workspace-context";
import type { WorkspaceMatch } from "@/lib/types/workspace";

type WorkspaceContextValue = {
  loading: boolean;
  active: WorkspaceView;
  teams: WorkspaceMatch[];
  authUserId: string | null;
  isTeamView: boolean;
  canSwitch: boolean;
  switchWorkspace: (operatorUserId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
};

const defaultActive: WorkspaceView = {
  mode: "self",
  operatorUserId: "",
  workspaceName: "My workspace",
};

const WorkspaceCtx = createContext<WorkspaceContextValue>({
  loading: true,
  active: defaultActive,
  teams: [],
  authUserId: null,
  isTeamView: false,
  canSwitch: false,
  switchWorkspace: async () => {},
  refresh: async () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceCtx);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const live = isClientLiveBackend();
  const [loading, setLoading] = useState(live);
  const [active, setActive] = useState<WorkspaceView>(defaultActive);
  const [teams, setTeams] = useState<WorkspaceMatch[]>([]);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!live) {
      setLoading(false);
      setTeams([]);
      setActive(defaultActive);
      setAuthUserId(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/context", { cache: "no-store" });
      if (!res.ok) throw new Error("context failed");
      const data = (await res.json()) as {
        active?: WorkspaceView;
        teams?: WorkspaceMatch[];
        authUserId?: string;
      };
      setActive(data.active ?? defaultActive);
      setTeams(data.teams ?? []);
      setAuthUserId(data.authUserId ?? null);
    } catch {
      setTeams([]);
      setActive(defaultActive);
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void load();
  }, [load]);

  const switchWorkspace = useCallback(
    async (operatorUserId: string | null) => {
      if (!live) return;
      const target =
        operatorUserId && authUserId && operatorUserId !== authUserId ? operatorUserId : null;
      writeActiveWorkspaceSession(target);
      const res = await fetch("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_user_id: target }),
      });
      if (!res.ok) return;
      await load();
      router.refresh();
      window.dispatchEvent(new Event("onpro-workspace-changed"));
    },
    [live, authUserId, load, router],
  );

  const value = useMemo(
    () => ({
      loading,
      active,
      teams,
      authUserId,
      isTeamView: active.mode === "team",
      canSwitch: teams.length > 0,
      switchWorkspace,
      refresh: load,
    }),
    [loading, active, teams, authUserId, switchWorkspace, load],
  );

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}
