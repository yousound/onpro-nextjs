"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { dispatchOpenOnProAi } from "@/lib/onpro-events";
import { getNotificationRows } from "@/lib/notifications";
import { writeActiveWorkspaceSession } from "@/lib/workspace-context";

function BellGlyph({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-[18px]"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export type NotificationsPopoverProps = {
  /** Outer button classes (layout, size, colors). */
  buttonClassName: string;
  /** Show count badge when there are notifications. */
  showBadge?: boolean;
  panelAlign?: "right" | "left";
};

export function NotificationsPopover({
  buttonClassName,
  showBadge = true,
  panelAlign = "right",
}: NotificationsPopoverProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { switchWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [memberEvents, setMemberEvents] = useState<
    { id: string; eventId: number; title: string; subtitle: string; href: string }[]
  >([]);
  const [inboxEvents, setInboxEvents] = useState<
    {
      id: string;
      eventId: number;
      title: string;
      subtitle: string;
      href: string;
      operatorUserId: string;
    }[]
  >([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const todayYmd = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const baseRows = useMemo(() => getNotificationRows(todayYmd), [todayYmd, pathname]);
  const rows = useMemo(
    () => [...inboxEvents, ...memberEvents, ...baseRows],
    [inboxEvents, memberEvents, baseRows],
  );
  const count = rows.length;
  const live = isClientLiveBackend();

  useEffect(() => {
    if (!live) return;
    void fetch("/api/workspace/member-events")
      .then((r) => r.json())
      .then(
        (data: {
          events?: {
            id: number;
            eventType: string;
            memberEmail: string | null;
            memberName: string | null;
          }[];
        }) => {
          const mapped = (data.events ?? []).map((ev) => ({
            id: `wme-${ev.id}`,
            eventId: ev.id,
            title:
              ev.eventType === "joined"
                ? `${ev.memberName ?? ev.memberEmail ?? "Someone"} joined your workspace`
                : "Workspace access revoked",
            subtitle: ev.memberEmail ?? "Client account",
            href: "/people?segment=client",
          }));
          setMemberEvents(mapped);
        },
      )
      .catch(() => setMemberEvents([]));

    void fetch("/api/workspace/member-inbox")
      .then((r) => r.json())
      .then(
        (data: {
          events?: {
            id: number;
            eventType: string;
            workspaceName: string;
            operatorUserId: string;
          }[];
        }) => {
          const mapped = (data.events ?? []).map((ev) => ({
            id: `inbox-${ev.id}`,
            eventId: ev.id,
            title:
              ev.eventType === "joined"
                ? `You were added to ${ev.workspaceName}`
                : `Access removed from ${ev.workspaceName}`,
            subtitle: "Open this team workspace",
            href: "/projects",
            operatorUserId: ev.operatorUserId,
          }));
          setInboxEvents(mapped);
        },
      )
      .catch(() => setInboxEvents([]));
  }, [live, pathname]);

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
        aria-label={
          count > 0
            ? open
              ? `Notifications (${count} items, open)`
              : `Notifications (${count} items)`
            : open
              ? "Notifications (open)"
              : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
      >
        <BellGlyph />
        {showBadge && count > 0 ? (
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
            <p className="mt-0.5 text-[11px] text-text-secondary">
              {live ? "From your live workspace." : "Items that need attention today."}
            </p>
          </div>
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-secondary">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-[min(60vh,22rem)] overflow-y-auto py-1">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.href}
                    className="block px-3 py-2.5 transition hover:bg-surface-body"
                    onClick={() => {
                      const inboxRow = inboxEvents.find((e) => e.id === r.id);
                      if (inboxRow && live) {
                        void fetch("/api/workspace/member-inbox", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ event_ids: [inboxRow.eventId] }),
                        });
                        setInboxEvents((prev) => prev.filter((e) => e.id !== r.id));
                        writeActiveWorkspaceSession(inboxRow.operatorUserId);
                        void switchWorkspace(inboxRow.operatorUserId).then(() => {
                          router.push(inboxRow.href);
                        });
                        setOpen(false);
                        return;
                      }
                      const memberRow = memberEvents.find((e) => e.id === r.id);
                      if (memberRow && live) {
                        void fetch("/api/workspace/member-events", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ event_ids: [memberRow.eventId] }),
                        });
                        setMemberEvents((prev) => prev.filter((e) => e.id !== r.id));
                      }
                      setOpen(false);
                    }}
                  >
                    <p className="text-sm font-medium text-text-primary">{r.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{r.subtitle}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border-light px-2 py-2">
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-center text-xs font-semibold text-accent hover:bg-violet-50"
              onClick={() => {
                setOpen(false);
                dispatchOpenOnProAi();
              }}
            >
              Open OnPro Ai
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
