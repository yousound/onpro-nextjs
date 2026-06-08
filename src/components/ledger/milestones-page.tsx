"use client";

import {
  capSystemAccruedCents,
  capSystemCompletionFraction,
  completionPercent,
  milestonesByPhase,
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
  const { state, toggleCapSystem, toggleMilestone } = useLedger();
  const phase3 = milestonesByPhase(state.milestones, 3);
  const phase3Pct = completionPercent(phase3);

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

      {phase3.length > 0 ? (
        <LedgerSection
          title="Phase 3 — AI systems & automation"
          subtitle={`Deliverable checklist (not dollar-weighted). ${formatPercent(phase3Pct)} complete — shipped items are baseline scope; pending rows are remaining Phase 3 work.`}
        >
          <LedgerTable headers={["Deliverable", "Weight", "Status", ""]}>
            {phase3.map((m) => (
              <tr key={m.id}>
                <td className="py-2.5 font-medium">{m.label}</td>
                <td className="py-2.5 tabular-nums text-text-secondary">{m.weight}</td>
                <td className="py-2.5 capitalize">{m.status === "complete" ? "Complete" : "Pending"}</td>
                <td className="py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => toggleMilestone(m.id)}
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Toggle
                  </button>
                </td>
              </tr>
            ))}
          </LedgerTable>
        </LedgerSection>
      ) : null}
    </>
  );
}
