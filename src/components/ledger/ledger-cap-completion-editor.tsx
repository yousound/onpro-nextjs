"use client";

import { capSystemCompletionFraction } from "@/lib/ledger/calculations";
import type { LedgerCapSystem } from "@/lib/ledger/types";
import { useLedger } from "@/components/ledger/ledger-provider";

export function LedgerCapCompletionEditor({ system }: { system: LedgerCapSystem }) {
  const { setCapSystemCompletion } = useLedger();
  const percent = Math.round(capSystemCompletionFraction(system) * 100);

  if (system.valueCents == null) return <span className="text-text-secondary">—</span>;

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={(e) => setCapSystemCompletion(system.id, Number(e.target.value))}
        className="h-1.5 w-24 cursor-pointer accent-accent"
        aria-label={`${system.label} completion percent`}
      />
      <input
        type="number"
        min={0}
        max={100}
        value={percent}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) setCapSystemCompletion(system.id, n);
        }}
        className="w-14 rounded border border-border-light px-1.5 py-0.5 text-right text-sm tabular-nums"
        aria-label={`${system.label} completion percent`}
      />
      <span className="text-xs text-text-secondary">%</span>
    </div>
  );
}
