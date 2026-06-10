"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { refreshLiveWorkspaceData } from "@/lib/data/refresh-live-workspace";

/** Keeps client-side live cache aligned when the active workspace changes. */
export function WorkspaceDataSync() {
  const router = useRouter();

  useEffect(() => {
    if (!isClientLiveBackend()) return;

    async function onWorkspaceChanged() {
      await refreshLiveWorkspaceData();
      router.refresh();
    }

    window.addEventListener("onpro-workspace-changed", onWorkspaceChanged);
    return () => window.removeEventListener("onpro-workspace-changed", onWorkspaceChanged);
  }, [router]);

  return null;
}
