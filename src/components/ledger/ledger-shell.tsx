"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { resetLedgerOverrides, setLedgerAuthed } from "@/lib/ledger/store";

type NavLink = { href: string; label: string };

const PROJECTS: NavLink[] = [
  { href: "/ledger/onpro", label: "OnPro" },
  { href: "/ledger/fbrc", label: "FBRC.LA" },
  { href: "/ledger/dropx", label: "DROPX" },
];

const FINANCIAL: NavLink[] = [{ href: "/ledger/financial/invoices", label: "Invoices" }];

const ENGINEERING: NavLink[] = [
  { href: "/ledger/engineering/milestones", label: "Milestones" },
  { href: "/ledger/engineering/scope", label: "Future expansion" },
];

function NavSection({ title, links }: { title: string; links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <div className="mt-6">
      <div className="px-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted-chrome">
        {title}
      </div>
      <ul className="mt-2 space-y-0.5">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-accent/20 font-medium text-text-on-chrome"
                    : "text-text-muted-chrome hover:bg-chrome-elevated hover:text-text-on-chrome"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LedgerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const onLogin = pathname === "/ledger/login";

  if (onLogin) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-svh min-h-0 overflow-hidden bg-chrome-dark text-text-on-chrome">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border-subtle bg-chrome-dark">
        <div className="border-b border-border-subtle px-4 py-5">
          <div className="text-xs font-medium uppercase tracking-wide text-text-muted-chrome">Private</div>
          <h1 className="mt-1 text-lg font-bold tracking-tight">Development Ledger</h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <NavSection title="Projects" links={PROJECTS} />
          <NavSection title="Financial" links={FINANCIAL} />
          <NavSection title="Engineering" links={ENGINEERING} />
        </nav>
        <div className="border-t border-border-subtle p-3 space-y-2">
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset all local ledger changes to seed data?")) {
                localStorage.removeItem("onpro.ledger.v1.overrides");
                localStorage.removeItem("onpro.ledger.v2.overrides");
                resetLedgerOverrides();
                window.location.reload();
              }
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-text-muted-chrome hover:bg-chrome-elevated"
          >
            Reset to seed
          </button>
          <button
            type="button"
            onClick={() => {
              setLedgerAuthed(false);
              router.push("/ledger/login");
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-text-muted-chrome hover:bg-chrome-elevated"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto bg-surface-body text-text-primary">{children}</main>
    </div>
  );
}
