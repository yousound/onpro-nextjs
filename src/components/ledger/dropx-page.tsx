"use client";

import { useLedger } from "@/components/ledger/ledger-provider";
import { LedgerSection } from "@/components/ledger/ledger-section";
import { LedgerTable } from "@/components/ledger/ledger-table";

export function DropxPage() {
  const { state } = useLedger();

  return (
    <>
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-900">
        {state.dropxNote}
      </div>
      <LedgerSection title="DROPX — Founder venture">
        <LedgerTable headers={["Item", "Status"]}>
          {state.dropx.map((row) => (
            <tr key={row.label}>
              <td className="py-2.5 font-medium">{row.label}</td>
              <td className="py-2.5 text-text-secondary">{row.value}</td>
            </tr>
          ))}
        </LedgerTable>
      </LedgerSection>
    </>
  );
}
