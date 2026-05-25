"use client";

import Link from "next/link";
import { capSystemAccruedCents, systemValueDisplay } from "@/lib/ledger/calculations";
import { formatUsd } from "@/lib/ledger/format";
/* Phase tables (commented out below) — restore imports if re-enabled:
import { systemStatusLabel } from "@/lib/ledger/calculations";
import type { LedgerSystemRow } from "@/lib/ledger/types";
*/
import { useLedger } from "@/components/ledger/ledger-provider";
import { LedgerMetricGrid } from "@/components/ledger/ledger-metric-grid";
import { LedgerProgressPair } from "@/components/ledger/ledger-progress-pair";
import { LedgerSection } from "@/components/ledger/ledger-section";
import { LedgerCapCompletionEditor } from "@/components/ledger/ledger-cap-completion-editor";
import { LedgerExpansionLabel } from "@/components/ledger/ledger-expansion-label";
import { LedgerTable } from "@/components/ledger/ledger-table";

/*
function statusClass(row: Pick<LedgerSystemRow, "status" | "completionFraction">): string {
  if (row.completionFraction != null && row.completionFraction < 1) {
    return "text-health-warn font-medium";
  }
  if (row.status === "complete") return "text-health-ok font-medium";
  if (row.status === "in_progress") return "text-health-warn font-medium";
  return "text-text-secondary";
}

function SystemRows({ rows }: { rows: LedgerSystemRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <tr key={row.id}>
          <td className="py-2.5 pr-3 font-medium">{row.label}</td>
          <td className={`py-2.5 pr-3 ${statusClass(row)}`}>{systemStatusLabel(row)}</td>
          <td className="py-2.5 tabular-nums text-text-secondary">
            {systemValueDisplay(row, formatUsd)}
          </td>
        </tr>
      ))}
    </>
  );
}
*/

export function OnProDashboard() {
  const { state, metrics } = useLedger();
  // const phase1Total = state.phase1Frontend.reduce((s, r) => s + (r.valueCents ?? 0), 0);
  // const phase2Total = state.phase2Backend.reduce((s, r) => s + (r.valueCents ?? 0), 0);

  return (
    <>
      <div className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
        <LedgerMetricGrid />
      </div>

      <LedgerProgressPair />

      <LedgerSection
        title="Work value accrued (detail)"
        subtitle="Adjust completion % below — saved in this browser (localStorage). Drives value accrued and work-finished."
      >
        <LedgerTable headers={["System", "Completion %", "Value", "Accrued"]}>
          {state.capSystems.map((s) => (
            <tr key={s.id}>
              <td className="py-2.5 font-medium">{s.label}</td>
              <td className="py-2.5">
                {s.valueCents != null ? (
                  <LedgerCapCompletionEditor system={s} />
                ) : (
                  <span className="text-text-secondary">—</span>
                )}
              </td>
              <td className="py-2.5 tabular-nums text-text-secondary">
                {systemValueDisplay(s, formatUsd)}
              </td>
              <td className="py-2.5 tabular-nums font-medium text-text-primary">
                {formatUsd(capSystemAccruedCents(s))}
              </td>
            </tr>
          ))}
          <tr className="border-t border-border-light font-semibold">
            <td className="py-3 pr-3" colSpan={3}>
              Total accrued
            </td>
            <td className="py-3 tabular-nums text-text-primary">{formatUsd(metrics.accruedCents)}</td>
          </tr>
        </LedgerTable>
      </LedgerSection>

      {/*
      <LedgerSection title="Phase 1 — Frontend platform">
        <LedgerTable headers={["System", "Status", "Value"]}>
          <SystemRows rows={state.phase1Frontend} />
          <tr className="border-t border-border-light font-semibold">
            <td className="py-3 pr-3">Subtotal</td>
            <td className="py-3 pr-3" />
            <td className="py-3 tabular-nums text-text-primary">{formatUsd(phase1Total)}</td>
          </tr>
        </LedgerTable>
      </LedgerSection>

      <LedgerSection title="Phase 2 — Backend & operations platform">
        <LedgerTable headers={["System", "Status", "Value"]}>
          <SystemRows rows={state.phase2Backend} />
          <tr className="border-t border-border-light font-semibold">
            <td className="py-3 pr-3">Subtotal</td>
            <td className="py-3 pr-3" />
            <td className="py-3 tabular-nums text-text-primary">{formatUsd(phase2Total)}</td>
          </tr>
        </LedgerTable>
      </LedgerSection>
      */}

      <LedgerSection title="Deliverables in baseline scope">
        <ul className="grid gap-2 sm:grid-cols-2">
          {state.onpro.includedInCap.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm">
              <span className="text-health-ok">✔</span>
              {item}
            </li>
          ))}
        </ul>
      </LedgerSection>

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

      <LedgerSection
        title="Invoices"
        action={
          <Link href="/ledger/financial/invoices" className="text-sm font-medium text-accent hover:underline">
            All invoices →
          </Link>
        }
      >
        <LedgerTable headers={["Date", "Description", "Amount", "Status"]}>
          {state.invoices.map((inv) => (
            <tr key={inv.id}>
              <td className="py-2.5">{inv.dateLabel}</td>
              <td className="py-2.5">{inv.label}</td>
              <td className="py-2.5 tabular-nums">{formatUsd(inv.amountCents)}</td>
              <td className="py-2.5 capitalize">{inv.status}</td>
            </tr>
          ))}
        </LedgerTable>
      </LedgerSection>
    </>
  );
}
