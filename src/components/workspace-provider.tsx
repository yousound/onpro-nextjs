"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { clearLiveCache } from "@/lib/data/live-cache";
import { joinWorkspaceMatch } from "@/lib/workspace-join-client";
import { writeActiveWorkspaceSession, readActiveWorkspaceSession } from "@/lib/workspace-context";
import type { WorkspaceView } from "@/lib/workspace-context";
import type { WorkspaceMatch } from "@/lib/types/workspace";

type WorkspaceContextValue = {
  loading: boolean;
  active: WorkspaceView;
  teams: WorkspaceMatch[];
  joinedTeams: WorkspaceMatch[];
  pendingTeams: WorkspaceMatch[];
  authUserId: string | null;
  isTeamView: boolean;
  canSwitch: boolean;
  switchWorkspace: (operatorUserId: string | null) => Promise<void>;
  joinTeam: (match: WorkspaceMatch) => Promise<void>;
  refresh: () => Promise<void>;
};

const defaultActive: WorkspaceView = {
  mode: "self",
  operatorUserId: "",
  workspaceName: "My workspace",
};

function initialActiveFromSession(): WorkspaceView {
  if (typeof window === "undefined") return defaultActive;
  const operatorUserId = readActiveWorkspaceSession();
  if (!operatorUserId) return defaultActive;
  return {
    mode: "team",
    operatorUserId,
    workspaceName: "Workspace",
  };
}

const WorkspaceCtx = createContext<WorkspaceContextValue>({
  loading: true,
  active: defaultActive,
  teams: [],
  authUserId: null,
  isTeamView: false,
  canSwitch: false,
  joinedTeams: [],
  pendingTeams: [],
  switchWorkspace: async () => {},
  joinTeam: async () => {},
  refresh: async () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceCtx);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const live = isClientLiveBackend();
  const [loading, setLoading] = useState(live);
  const [active, setActive] = useState<WorkspaceView>(initialActiveFromSession);
  const hasLoadedOnceRef = useRef(false);
  const [teams, setTeams] = useState<WorkspaceMatch[]>([]);
  const [joinedTeams, setJoinedTeams] = useState<WorkspaceMatch[]>([]);
  const [pendingTeams, setPendingTeams] = useState<WorkspaceMatch[]>([]);
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!live) {
      setLoading(false);
      setTeams([]);
      setJoinedTeams([]);
      setPendingTeams([]);
      setActive(defaultActive);
      setAuthUserId(null);
      return;
    }
    const isInitialLoad = !hasLoadedOnceRef.current;
    if (isInitialLoad) setLoading(true);
    try {
      const res = await fetch("/api/workspace/context", { cache: "no-store" });
      if (!res.ok) throw new Error("context failed");
      const data = (await res.json()) as {
        active?: WorkspaceView;
        teams?: WorkspaceMatch[];
        joined?: WorkspaceMatch[];
        pending?: WorkspaceMatch[];
        authUserId?: string;
      };
      const all = data.teams ?? [];
      const authId = data.authUserId ?? null;
      setActive(data.active ?? defaultActive);
      setTeams(all);
      if (data.joined && data.pending) {
        setJoinedTeams(data.joined);
        setPendingTeams(data.pending);
      } else {
        const { splitWorkspaceTeams } = await import("@/lib/workspace-team-filters");
        const split = splitWorkspaceTeams(all, authId);
        setJoinedTeams(split.joined);
        setPendingTeams(split.pending);
      }
      setAuthUserId(data.authUserId ?? null);
    } catch {
      setTeams([]);
      setJoinedTeams([]);
      setPendingTeams([]);
      setActive(defaultActive);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const lastFocusLoadRef = { at: 0 };
    const onFocus = () => {
      if (Date.now() - lastFocusLoadRef.at < 90_000) return;
      lastFocusLoadRef.at = Date.now();
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [live, load]);

  const joinTeam = useCallback(
    async (match: WorkspaceMatch) => {
      if (!live) return;
      await joinWorkspaceMatch(match);
      writeActiveWorkspaceSession(match.operatorUserId);
      await fetch("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_user_id: match.operatorUserId }),
      });
      if (isClientLiveBackend()) clearLiveCache();
      await load();
      router.refresh();
      window.dispatchEvent(new Event("onpro-workspace-changed"));
    },
    [live, load, router],
  );

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
      if (isClientLiveBackend()) clearLiveCache();
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
      joinedTeams,
      pendingTeams,
      authUserId,
      isTeamView: active.mode === "team",
      canSwitch: joinedTeams.length > 0 || pendingTeams.length > 0,
      switchWorkspace,
      joinTeam,
      refresh: load,
    }),
    [loading, active, teams, joinedTeams, pendingTeams, authUserId, switchWorkspace, joinTeam, load],
  );

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}
