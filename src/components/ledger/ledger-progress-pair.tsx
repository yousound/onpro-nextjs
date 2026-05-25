"use client";

import { formatPercent, formatUsd } from "@/lib/ledger/format";
import { useLedger } from "@/components/ledger/ledger-provider";

function ProgressBar({ label, hint, percent, sub }: { label: string; hint: string; percent: number; sub: string }) {
  const pct = Math.round(percent * 1000) / 10;
  return (
    <div className="rounded-xl border border-border-light bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold text-text-primary">{label}</h3>
          <p className="mt-0.5 text-xs text-text-secondary">{hint}</p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-text-primary">{formatPercent(percent)}</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-text-secondary">{sub}</p>
    </div>
  );
}

export function LedgerProgressPair() {
  const { metrics } = useLedger();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ProgressBar
        label="Work finished"
        hint="Approved by team"
        percent={metrics.workFinished}
        sub={`${formatUsd(metrics.accruedCents)} accrued of ${formatUsd(metrics.capCents)} project value`}
      />
      <ProgressBar
        label="Money paid toward project cap"
        hint="OnPro invoices only — FBRC and DROPX are separate."
        percent={metrics.moneyPaid}
        sub={`${formatUsd(metrics.paidCents)} paid · ${formatUsd(metrics.remainingCapCents)} remaining on cap`}
      />
    </div>
  );
}
