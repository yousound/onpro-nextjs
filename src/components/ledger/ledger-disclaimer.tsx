"use client";

import { useLedger } from "@/components/ledger/ledger-provider";

export function LedgerDisclaimer() {
  const { state } = useLedger();
  return (
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
      {state.disclaimer}
    </p>
  );
}
