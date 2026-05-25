"use client";

import {
  capSystemAccruedCents,
  capSystemCompletionFraction,
  systemStatusLabel,
  systemValueDisplay,
} from "@/lib/ledger/calculations";
import { formatPercent, formatUsd } from "@/lib/ledger/format";
import { useLedger } from "@/components/ledger/ledger-provider";
import { LedgerCapCompletionEditor } from "@/components/ledger/ledger-cap-completion-editor";
import { LedgerProgressPair } from "@/components/ledger/ledger-progress-pair";
import { LedgerSection } from "@/components/ledger/ledger-section";
import { LedgerTable } from "@/components/ledger/ledger-table";

export function MilestonesPage() {
  const { state, toggleCapSystem } = useLedger();

  return (
    <>
      <LedgerProgressPair />
      <LedgerSection title="OnPro systems ($75k cap)">
        <p className="mb-4 text-sm text-text-secondary">
          Set completion % per system — updates accrued value, work-finished bar, and the OnPro project
          page. Saved in this browser only (localStorage). Toggle still sets backend/admin to pending or
          100% complete.
        </p>
        <LedgerTable headers={["System", "Status", "Completion %", "Value", "Accrued", ""]}>
          {state.capSystems.map((s) => (
            <tr key={s.id}>
              <td className="py-2.5 font-medium">{s.label}</td>
              <td className="py-2.5">{systemStatusLabel(s)}</td>
              <td className="py-2.5">
                {s.valueCents != null ? (
                  <LedgerCapCompletionEditor system={s} />
                ) : (
                  formatPercent(capSystemCompletionFraction(s))
                )}
              </td>
              <td className="py-2.5 tabular-nums">{systemValueDisplay(s, formatUsd)}</td>
              <td className="py-2.5 tabular-nums font-medium">{formatUsd(capSystemAccruedCents(s))}</td>
              <td className="py-2.5 text-right">
                {s.status === "complete" || s.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => toggleCapSystem(s.id)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Toggle
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </LedgerTable>
      </LedgerSection>
    </>
  );
}
