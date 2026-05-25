"use client";

import { formatUsd } from "@/lib/ledger/format";
import {
  sortWorkRecords,
  taskWorkRecordsOnly,
  workRecordStatusLabel,
  workRecordValueDisplay,
} from "@/lib/ledger/work-records";
import type { LedgerProjectId, LedgerWorkRecord } from "@/lib/ledger/types";
import { useLedger } from "@/components/ledger/ledger-provider";
import { LedgerSection } from "@/components/ledger/ledger-section";
import { LedgerTable } from "@/components/ledger/ledger-table";

function statusClass(status: LedgerWorkRecord["status"]): string {
  if (status === "completed") return "text-health-ok font-medium";
  if (status === "in_progress") return "text-health-warn font-medium";
  return "text-text-secondary";
}

export function LedgerWorkAccounting({ filterProject }: { filterProject?: LedgerProjectId }) {
  const { state } = useLedger();

  const records = sortWorkRecords(
    taskWorkRecordsOnly(
      filterProject ? state.workRecords.filter((r) => r.projectId === filterProject) : state.workRecords,
    ),
  );

  return (
    <LedgerSection
      title="Work completed by period"
      subtitle="Deliverables and engineering tasks in date order. Billing and retainers stay in the Invoices table above."
    >
      <LedgerTable headers={["Period", "Project", "Deliverable", "Value", "Status"]}>
        {records.map((row) => (
          <tr key={row.id}>
            <td className="py-2.5 whitespace-nowrap text-text-secondary">{row.periodLabel}</td>
            <td className="py-2.5 uppercase text-xs text-text-secondary">{row.projectId}</td>
            <td className="py-2.5 font-medium">{row.description}</td>
            <td className="py-2.5 tabular-nums text-text-secondary">
              {workRecordValueDisplay(row, formatUsd)}
            </td>
            <td className={`py-2.5 ${statusClass(row.status)}`}>{workRecordStatusLabel(row.status)}</td>
          </tr>
        ))}
      </LedgerTable>
    </LedgerSection>
  );
}
