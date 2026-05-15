"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: "projects" | "jobs" | "calendar" | "messages" | "documents" | "team" | "reports" | "settings";
  disabled?: boolean;
};

/**
 * Desktop default: Projects first. OnPro iOS uses Messages as the first tab; this web shell
 * keeps production workflow primary.
 */
const NAV: NavItem[] = [
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/messages", label: "Messages", icon: "messages" },
  { href: "/production", label: "Jobs", icon: "jobs" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/documents", label: "Documents", icon: "documents" },
  { href: "/settings", label: "Settings", icon: "settings" },
  { href: "#", label: "Team", icon: "team", disabled: true },
  { href: "#", label: "Reports", icon: "reports", disabled: true },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "#") return false;
  if (href === "/messages") return pathname === "/messages" || pathname.startsWith("/messages/");
  if (href === "/settings") return pathname === "/settings";
  if (href === "/production") return pathname === "/production";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ kind }: { kind: NavItem["icon"] }) {
  const cls = "h-5 w-5 shrink-0";
  switch (kind) {
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

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-border-light bg-surface-card transition-[width] ${
        collapsed ? "w-[4.5rem]" : "w-56"
      }`}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border-light px-3">
        <Link href="/projects" className="flex min-w-0 items-center gap-2">
          <Image
            src="/onpro-logo.png"
            alt="OnPro"
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-border-light"
            priority
          />
          {!collapsed ? <span className="truncate font-semibold text-text-primary">OnPro</span> : null}
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 p-2" aria-label="Main">
        {NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          const base =
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition";
          const activeCls = active
            ? "bg-violet-50 text-accent ring-1 ring-violet-100"
            : "text-text-secondary hover:bg-surface-body hover:text-text-primary";
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
              className={`${base} ${activeCls}`}
            >
              <NavIcon kind={item.icon} />
              {!collapsed ? item.label : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border-light p-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text-secondary hover:bg-surface-body"
          aria-expanded={!collapsed}
        >
          <span className={collapsed ? "rotate-180" : ""}>‹</span>
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  );
}
