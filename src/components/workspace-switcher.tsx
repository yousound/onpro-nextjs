"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { useCurrentUser } from "@/components/profile-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { isActiveTeamWorkspace } from "@/lib/workspace-team-filters";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { displayAvatarUrl } from "@/lib/current-user-display";

type Props = {
  collapsed?: boolean;
};

export function WorkspaceSwitcher({ collapsed = false }: Props) {
  const { user: profileUser, loading: profileLoading } = useCurrentUser();
  const {
    active,
    joinedTeams,
    pendingTeams,
    canSwitch,
    switchWorkspace,
    joinTeam,
    loading: wsLoading,
  } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const sidebarUser = profileUser
    ? {
        name: profileUser.fullName,
        avatarSrc: displayAvatarUrl(profileUser.avatarUrl, {
          useMockPlaceholder: !isSupabaseConfigured(),
        }),
      }
    : profileLoading
      ? { name: "…", avatarSrc: null as string | null }
      : { name: "Sign in", avatarSrc: null as string | null };

  const orgLabel = active.workspaceName || sidebarUser.name;
  const showMenu = canSwitch && !collapsed;

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

  if (!showMenu) {
    return (
      <Link
        href="/settings"
        title={collapsed ? `${sidebarUser.name} — ${orgLabel}` : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-200/90 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <DirectoryAvatar name={sidebarUser.name} avatarUrl={sidebarUser.avatarSrc} size="sm" />
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-1">
              <span className="truncate text-sm font-semibold text-text-primary">{sidebarUser.name}</span>
              <ChevronDownGlyph className="shrink-0 text-text-secondary" />
            </span>
            {orgLabel ? (
              <span className="mt-0.5 block truncate text-xs text-text-secondary">{orgLabel}</span>
            ) : null}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={collapsed ? `${sidebarUser.name} — ${orgLabel}` : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-200/90 ${
          collapsed ? "justify-center" : ""
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <DirectoryAvatar name={sidebarUser.name} avatarUrl={sidebarUser.avatarSrc} size="sm" />
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-1">
              <span className="truncate text-sm font-semibold text-text-primary">{sidebarUser.name}</span>
              <ChevronDownGlyph className="shrink-0 text-text-secondary" />
            </span>
            <span className="mt-0.5 block truncate text-xs text-text-secondary">
              {wsLoading ? "Loading…" : orgLabel}
            </span>
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Switch workspace"
          className="absolute bottom-full left-0 z-[90] mb-2 w-[min(calc(100vw-2rem),14rem)] rounded-xl border border-border-light bg-white py-1 shadow-xl ring-1 ring-black/5"
        >
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
            Switch workspace
          </p>
          <button
            type="button"
            role="menuitem"
            className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-surface-body ${
              active.mode === "self" ? "font-semibold text-accent" : "text-text-primary"
            }`}
            onClick={() => {
              setOpen(false);
              void switchWorkspace(null);
            }}
          >
            My workspace
          </button>
          {pendingTeams.map((team) => {
            const key = `${team.operatorUserId}:${team.contactId}`;
            return (
              <button
                key={`pending-${key}`}
                type="button"
                role="menuitem"
                disabled={joiningId === key}
                className="block w-full px-3 py-2 text-left text-sm transition hover:bg-amber-50 disabled:opacity-60"
                onClick={() => {
                  setJoiningId(key);
                  void joinTeam(team)
                    .then(() => setOpen(false))
                    .finally(() => setJoiningId(null));
                }}
              >
                <span className="block truncate font-medium text-text-primary">
                  {team.workspaceName}
                </span>
                <span className="block truncate text-xs font-semibold text-amber-800">
                  {joiningId === key ? "Joining…" : "Tap to join team"}
                </span>
              </button>
            );
          })}
          {joinedTeams.map((team) => {
            const key = `${team.operatorUserId}:${team.contactId}`;
            const selected = isActiveTeamWorkspace(active, team);
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-surface-body ${
                  selected ? "font-semibold text-accent" : "text-text-primary"
                }`}
                onClick={() => {
                  setOpen(false);
                  void switchWorkspace(team.operatorUserId);
                }}
              >
                <span className="block truncate font-medium">{team.workspaceName}</span>
                <span className="block truncate text-xs text-text-secondary">
                  {selected
                    ? "Connected"
                    : `${team.projectCount} ${team.projectCount === 1 ? "project" : "projects"}`}
                </span>
              </button>
            );
          })}
          <div className="my-1 border-t border-border-light" />
          <Link
            href="/settings"
            role="menuitem"
            className="block px-3 py-2 text-sm text-text-secondary hover:bg-surface-body"
            onClick={() => setOpen(false)}
          >
            Account settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ChevronDownGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
