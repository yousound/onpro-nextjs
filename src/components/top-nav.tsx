"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/messages", label: "Messages" },
  { href: "/production", label: "Production" },
  { href: "/calendar", label: "Calendar" },
  { href: "/documents", label: "Documents" },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/messages") {
    return pathname === "/messages";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-chrome-dark text-text-on-chrome">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link href="/projects" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
          <Image
            src="/onpro-logo.png"
            alt="OnPro"
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
            priority
          />
          <span className="hidden sm:inline">OnPro</span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
          {NAV.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-md px-3 py-2 font-medium transition-colors ${
                  active
                    ? "bg-chrome-elevated text-white"
                    : "text-text-muted-chrome hover:bg-chrome-elevated/80 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="rounded-full p-2 text-text-muted-chrome transition hover:bg-chrome-elevated hover:text-white"
            aria-label="Notifications"
            title="Notifications (demo)"
          >
            <BellIcon />
          </button>
          <div className="flex items-center gap-2 pl-1">
            <span className="hidden max-w-[120px] truncate text-sm text-text-muted-chrome sm:inline" title="Account">
              Demo user
            </span>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white ring-2 ring-border-subtle"
              title="Account"
            >
              DU
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
