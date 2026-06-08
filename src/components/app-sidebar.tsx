"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { OnProLogoIntroModal } from "@/components/onpro-logo-intro-modal";
import { useCurrentUser } from "@/components/profile-provider";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { displayAvatarUrl } from "@/lib/current-user-display";

type NavItem = {
  href: string;
  label: string;
  icon:
    | "overview"
    | "projects"
    | "jobs"
    | "calendar"
    | "messages"
    | "documents"
    | "team"
    | "reports"
    | "mailroom";
  disabled?: boolean;
};

/**
 * OnPro AI (home) first, then the rest of the desktop shell.
 */
const NAV: NavItem[] = [
  { href: "/", label: "OnPro AI", icon: "overview" },
  { href: "/messages", label: "Messages", icon: "messages" },
  { href: "/mailroom", label: "Mailroom", icon: "mailroom" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/production", label: "Jobs", icon: "jobs" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/documents", label: "Documents", icon: "documents" },
  { href: "/people", label: "Contacts", icon: "team" },
  { href: "#", label: "Reports", icon: "reports", disabled: true },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/") return pathname === "/";
  if (href === "/messages") return pathname === "/messages" || pathname.startsWith("/messages/");
  if (href === "/people") return pathname === "/people";
  if (href === "/production") return pathname === "/production";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ kind }: { kind: NavItem["icon"] }) {
  const cls = "h-5 w-5 shrink-0";
  switch (kind) {
    case "overview":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="11" width="7" height="10" rx="1" />
          <rect x="3" y="15" width="7" height="6" rx="1" />
        </svg>
      );
    case "projects":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "jobs":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "messages":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "documents":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    case "team":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "reports":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
      );
    case "mailroom":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 8l9 6 9-6" />
          <circle cx="19" cy="6" r="2" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
  }
}

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user: profileUser, loading: profileLoading } = useCurrentUser();

  const sidebarUser = profileUser
    ? {
        name: profileUser.fullName,
        org: profileUser.companyName || "Add company in Settings",
        avatarSrc: displayAvatarUrl(profileUser.avatarUrl, {
          useMockPlaceholder: !isSupabaseConfigured(),
        }),
        initials: profileUser.initials,
      }
    : profileLoading
      ? { name: "…", org: "", avatarSrc: null as string | null, initials: "…" }
      : { name: "Sign in", org: "Settings → Account", avatarSrc: null as string | null, initials: "?" };
  const [introOpen, setIntroOpen] = useState(false);

  return (
    <aside
      className={`flex h-svh min-h-0 shrink-0 flex-col border-r border-border-light bg-surface-card transition-[width] ${
        collapsed ? "w-[4.5rem]" : "w-56"
      }`}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border-light px-3">
        <button
          type="button"
          onClick={() => setIntroOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 ease-out hover:bg-slate-200/95 hover:text-slate-900"
          aria-label="About OnPro"
        >
          <Image
            src="/onpro-logo.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-border-light"
            priority
          />
          {!collapsed ? <span className="truncate font-semibold text-text-primary">OnPro</span> : null}
        </button>
      </div>

      <OnProLogoIntroModal open={introOpen} onDismiss={() => setIntroOpen(false)} />

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2" aria-label="Main">
        {NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          const base =
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out";
          const activeCls = active
            ? "bg-violet-50 text-accent shadow-sm ring-1 ring-violet-100/90 hover:bg-violet-100 hover:text-violet-800 hover:ring-violet-200"
            : "text-text-secondary hover:bg-slate-200/95 hover:text-slate-900 hover:shadow-sm active:bg-slate-300/80";
          const disabledCls = "cursor-not-allowed opacity-45";

          if (item.disabled) {
            return (
              <span
                key={item.label}
                title={`${item.label} (coming soon)`}
                className={`${base} ${disabledCls}`}
              >
                <NavIcon kind={item.icon} />
                {!collapsed ? item.label : null}
              </span>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              {...(collapsed ? { "aria-label": item.label } : {})}
              className={`${base} ${activeCls} ${collapsed ? "justify-center px-2" : ""}`}
            >
              <NavIcon kind={item.icon} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-light p-2">
        <Link
          href="/settings"
          title={collapsed ? `${sidebarUser.name} — ${sidebarUser.org}` : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-slate-200/90 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <DirectoryAvatar
            name={sidebarUser.name}
            avatarUrl={sidebarUser.avatarSrc}
            size="sm"
          />
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-sm font-semibold text-text-primary">{sidebarUser.name}</span>
                <ChevronDownGlyph className="shrink-0 text-text-secondary" />
              </span>
              {sidebarUser.org ? (
                <span className="mt-0.5 block truncate text-xs text-text-secondary">{sidebarUser.org}</span>
              ) : null}
            </span>
          ) : null}
        </Link>
      </div>

      <div className="border-t border-border-light p-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text-secondary transition-colors duration-200 ease-out hover:bg-slate-200/95 hover:text-slate-900 hover:shadow-sm active:bg-slate-300/80"
          aria-expanded={!collapsed}
        >
          <span className={collapsed ? "rotate-180" : ""}>‹</span>
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  );
}

function ChevronDownGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
