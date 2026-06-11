"use client";

import { useEffect, useRef } from "react";
import { ToastViewport } from "@/components/toast-viewport";

export const TOAST_AUTO_DISMISS_MS = 5000;

type AppToastProps = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
};

/** Top-layer transient toast — auto-dismisses after 5s by default. */
export function AppToast({ message, onDismiss, durationMs = TOAST_AUTO_DISMISS_MS }: AppToastProps) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => dismissRef.current(), durationMs);
    return () => window.clearTimeout(id);
  }, [message, durationMs]);

  if (!message) return null;

  return (
    <ToastViewport>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-auto flex max-w-[min(calc(100vw-2rem),28rem)] items-center gap-3 rounded-full bg-text-primary px-4 py-2.5 text-xs font-semibold text-white shadow-xl ring-1 ring-black/10 animate-[invite-toast-in_0.35s_cubic-bezier(0.22,1,0.36,1)_both]"
      >
        <span className="min-w-0 flex-1 leading-snug">{message}</span>
        <button
          type="button"
          onClick={() => dismissRef.current()}
          className="shrink-0 rounded px-2 py-0.5 text-[10px] uppercase ring-1 ring-white/30 hover:bg-white/10"
        >
          Dismiss
        </button>
      </div>
    </ToastViewport>
  );
}
