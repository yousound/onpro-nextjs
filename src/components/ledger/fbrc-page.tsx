"use client";

import { formatUsd } from "@/lib/ledger/format";
import { useLedger } from "@/components/ledger/ledger-provider";
import { LedgerSection } from "@/components/ledger/ledger-section";
import { LedgerTable } from "@/components/ledger/ledger-table";

export function FbrcPage() {
  const { state } = useLedger();

  return (
    <>
      <p className="text-sm text-text-secondary">{state.fbrcNote}</p>
      <LedgerSection title="FBRC.LA">
        <LedgerTable headers={["Item", "Value", "Status"]}>
          {state.fbrc.map((row) => (
            <tr key={row.id}>
              <td className="py-2.5 font-medium">{row.label}</td>
              <td className="py-2.5 tabular-nums">
                {row.amountCents != null ? formatUsd(row.amountCents) : row.amountLabel ?? "—"}
              </td>
              <td className="py-2.5">{row.status}</td>
            </tr>
          ))}
        </LedgerTable>
      </LedgerSection>
    </>
  );
}
