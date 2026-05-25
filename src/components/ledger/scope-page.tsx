"use client";

import { useLedger } from "@/components/ledger/ledger-provider";
import { LedgerExpansionLabel } from "@/components/ledger/ledger-expansion-label";
import { LedgerSection } from "@/components/ledger/ledger-section";
import { LedgerTable } from "@/components/ledger/ledger-table";

export function ScopePage() {
  const { state } = useLedger();

  return (
    <LedgerSection
      title="Future expansion scope"
      subtitle="The following features are outside the baseline OnPro project scope and would be discussed separately if added."
    >
      <LedgerTable headers={["Expansion", "Est. value", "Status"]}>
        {state.futureExpansion.map((row) => (
          <tr key={row.id}>
            <td className="py-2.5 font-medium">
              <LedgerExpansionLabel id={row.id} label={row.label} />
            </td>
            <td className="py-2.5 tabular-nums text-text-secondary">
              {row.estValueLabel ?? "TBD"}
            </td>
            <td className="py-2.5 text-text-secondary">{row.status}</td>
          </tr>
        ))}
      </LedgerTable>
    </LedgerSection>
  );
}
