"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { OverviewAssistant } from "@/components/overview-assistant";
import { OPEN_ONPRO_AI_EVENT } from "@/lib/onpro-events";

export function AssistantChatModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ONPRO_AI_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ONPRO_AI_EVENT, onOpen);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-3 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="OnPro AI"
        className="relative flex min-h-[min(560px,85vh)] max-h-[min(720px,92vh)] w-full max-w-2xl flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-md ring-1 ring-slate-200/80 backdrop-blur-sm hover:bg-white hover:text-slate-900"
          aria-label="Close OnPro AI"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <OverviewAssistant layout="modal" />
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
