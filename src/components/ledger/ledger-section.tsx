import type { ReactNode } from "react";

export function LedgerSection({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-light bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-light px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
