"use client";

import { useEffect, useRef } from "react";
import { ToastViewport } from "@/components/toast-viewport";
import type { PeopleSegment } from "@/lib/mock/people";
import { segmentBadgeSoftClass, segmentLabel } from "@/lib/mock/people";

export type InviteToastPayload = {
  email: string;
  segment: PeopleSegment;
  loginUrl?: string;
};

export function InviteSentToast({
  payload,
  onDismiss,
}: {
  payload: InviteToastPayload | null;
  onDismiss: () => void;
}) {
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!payload) return;
    const id = window.setTimeout(() => dismissRef.current(), 5200);
    return () => window.clearTimeout(id);
  }, [payload]);

  if (!payload) return null;

  return (
    <ToastViewport>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-auto flex w-full max-w-[440px] items-start gap-4 rounded-2xl border border-slate-200/95 bg-white/[0.97] px-5 py-4 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.28),0_0_0_1px_rgba(124,58,237,0.07),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl animate-[invite-toast-in_0.52s_cubic-bezier(0.22,1,0.36,1)_both]"
      >
        <div
          className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-white shadow-[inset_0_2px_6px_rgba(255,255,255,0.35),0_8px_16px_-6px_rgba(16,185,129,0.55)]"
          aria-hidden
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="drop-shadow-sm">
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.35"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="bg-gradient-to-r from-violet-700 to-indigo-700 bg-clip-text text-[15px] font-bold tracking-tight text-transparent">
            Invitation sent
          </p>
          <p className="mt-1 truncate text-[13px] font-medium text-text-primary">{payload.email}</p>
          {payload.loginUrl ? (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(payload.loginUrl!);
              }}
              className="mt-2 text-left text-[11px] font-semibold text-[#7c3aed] hover:underline"
            >
              Copy invite link
            </button>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(payload.segment)}`}
            >
              {segmentLabel(payload.segment)}
            </span>
            <span className="text-[11px] leading-none text-text-secondary">
              {payload.loginUrl ? "Invite link ready — copy and send" : "Listed in pending invites below"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => dismissRef.current()}
          className="-mr-1 -mt-1 shrink-0 rounded-xl p-2 text-text-secondary transition hover:bg-slate-100 hover:text-text-primary"
          aria-label="Dismiss"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </ToastViewport>
  );
}
