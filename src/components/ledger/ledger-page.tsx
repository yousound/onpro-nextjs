import type { ReactNode } from "react";

export function LedgerPage({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 border-b border-border-light pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-text-secondary">{subtitle}</p> : null}
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
