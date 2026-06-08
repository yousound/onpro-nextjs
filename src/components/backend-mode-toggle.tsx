"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clientBackendMode,
  defaultBackendMode,
  isLiveBackendFeatureEnabled,
  setClientBackendMode,
  type BackendMode,
} from "@/lib/config/backend-mode";
import { clearLiveCache } from "@/lib/data/live-cache";

export function BackendModeToggle({ collapsed }: { collapsed?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<BackendMode>("mock");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isLiveBackendFeatureEnabled());
    setMode(clientBackendMode() ?? defaultBackendMode());
  }, []);

  const setModeAndRefresh = useCallback(
    (next: BackendMode) => {
      setClientBackendMode(next);
      clearLiveCache();
      setMode(next);
      router.refresh();
    },
    [router],
  );

  if (!visible) return null;

  const isLive = mode === "live";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setModeAndRefresh(isLive ? "mock" : "live")}
        title={isLive ? "Using live Supabase data — click for mock" : "Using mock data — click for live"}
        className={`shrink-0 rounded-md px-1.5 py-1 text-[9px] font-bold uppercase tracking-wide ${
          isLive
            ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
            : "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
        }`}
      >
        {isLive ? "Live" : "Mock"}
      </button>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center rounded-lg border border-border-light bg-slate-100/80 p-0.5"
      role="group"
      aria-label="Data source"
    >
      <button
        type="button"
        onClick={() => setModeAndRefresh("live")}
        className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
          isLive ? "bg-white text-emerald-700 shadow-sm" : "text-text-secondary hover:text-text-primary"
        }`}
        title="Load projects, people, and mailroom apply from Supabase"
      >
        Live
      </button>
      <button
        type="button"
        onClick={() => setModeAndRefresh("mock")}
        className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
          !isLive ? "bg-white text-amber-800 shadow-sm" : "text-text-secondary hover:text-text-primary"
        }`}
        title="Use demo mocks and localStorage (no login required)"
      >
        Mock
      </button>
    </div>
  );
}
