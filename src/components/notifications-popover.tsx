"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildOverviewDigest } from "@/lib/mock/overview-digest";

type NotifRow = { id: string; title: string; subtitle: string; href: string };

function BellGlyph({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-[18px]"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function useNotificationsRows(): NotifRow[] {
  return useMemo(() => {
    const ymd = new Date().toISOString().slice(0, 10);
    const d = buildOverviewDigest(ymd);
    const out: NotifRow[] = d.focusItems.map((f) => ({
      id: f.id,
      title: f.title,
      subtitle: f.subtitle,
      href: f.href,
    }));
    const fillers: NotifRow[] = [
      {
        id: "n-quick-find",
        title: "Quick find",
        subtitle: "Press ⌘K to jump to pages and projects.",
        href: "/",
      },
      {
        id: "n-demo",
        title: "Demo workspace",
        subtitle: "Notifications use mock digest data for this preview.",
        href: "/",
      },
      {
        id: "n-overview",
        title: "Overview",
        subtitle: "Your morning digest lists what needs attention.",
        href: "/",
      },
    ];
    for (const f of fillers) {
      if (out.length >= 3) break;
      if (!out.some((x) => x.id === f.id)) out.push(f);
    }
    return out.slice(0, 8);
  }, []);
}

export type NotificationsPopoverProps = {
  /** Outer button classes (layout, size, colors). */
  buttonClassName: string;
  /** Badge position/size; omit wrapper span when count is 0 if desired — we always show digest-based count. */
  showBadge?: boolean;
  panelAlign?: "right" | "left";
};

export function NotificationsPopover({
  buttonClassName,
  showBadge = true,
  panelAlign = "right",
}: NotificationsPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const rows = useNotificationsRows();
  const count = Math.min(Math.max(rows.length, 1), 9);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={buttonClassName}
        aria-label={open ? "Notifications (open)" : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <BellGlyph />
        {showBadge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className={`absolute top-full z-[80] mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-xl border border-border-light bg-white shadow-xl ring-1 ring-black/5 ${
            panelAlign === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="border-b border-border-light px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Notifications</p>
            <p className="mt-0.5 text-[11px] text-text-secondary">Mock inbox — links open the relevant screen.</p>
          </div>
          <ul className="max-h-[min(60vh,22rem)] overflow-y-auto py-1">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="block px-3 py-2.5 transition hover:bg-surface-body"
                  onClick={() => setOpen(false)}
                >
                  <p className="text-sm font-medium text-text-primary">{r.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{r.subtitle}</p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-border-light px-2 py-2">
            <Link
              href="/messages"
              className="block rounded-lg px-2 py-2 text-center text-xs font-semibold text-accent hover:bg-violet-50"
              onClick={() => setOpen(false)}
            >
              Open Messages
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
