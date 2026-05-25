"use client";

import { formatUsd } from "@/lib/ledger/format";
import { useLedger } from "@/components/ledger/ledger-provider";

export function LedgerMetricGrid() {
  const { metrics } = useLedger();

  const items = [
    { label: "Project value", value: formatUsd(metrics.capCents) },
    { label: "Value accrued", value: formatUsd(metrics.accruedCents) },
    { label: "Money paid so far", value: formatUsd(metrics.paidCents) },
    { label: "Still owed on cap", value: formatUsd(metrics.remainingCapCents) },
    { label: "Monthly retainer", value: formatUsd(metrics.monthlyRetainerCents) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border-light bg-white px-4 py-3 shadow-sm"
        >
          <div className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            {item.label}
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-text-primary">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
