"use client";

import { Fragment, useState } from "react";
import {
  sortWorkRecords,
  taskWorkRecordsOnly,
  workRecordStatusLabel,
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
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const records = sortWorkRecords(
    taskWorkRecordsOnly(
      filterProject ? state.workRecords.filter((r) => r.projectId === filterProject) : state.workRecords,
    ),
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <LedgerSection
      title="Work completed by period"
      subtitle="Deliverables and engineering tasks in date order. Billing and retainers stay in the Invoices table above — project is capped at $75k, not priced per task."
    >
      <LedgerTable headers={["Period", "Project", "Deliverable", "Status"]}>
        {records.map((row) => {
          const isOpen = expanded.has(row.id);
          const canExpand = Boolean(row.detail);

          return (
            <Fragment key={row.id}>
              <tr
                className={canExpand ? "cursor-pointer hover:bg-surface-body/40" : undefined}
                onClick={canExpand ? () => toggle(row.id) : undefined}
              >
                <td className="py-2.5 whitespace-nowrap text-text-secondary">{row.periodLabel}</td>
                <td className="py-2.5 uppercase text-xs text-text-secondary">{row.projectId}</td>
                <td className="py-2.5 font-medium">
                  <div className="flex items-start gap-2">
                    {canExpand ? (
                      <span
                        className={`mt-0.5 shrink-0 text-xs text-text-secondary transition ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      >
                        ▾
                      </span>
                    ) : null}
                    <span>{row.description}</span>
                  </div>
                </td>
                <td className={`py-2.5 ${statusClass(row.status)}`}>{workRecordStatusLabel(row.status)}</td>
              </tr>
              {isOpen && row.detail ? (
                <tr className="bg-surface-body/50">
                  <td className="py-0" />
                  <td className="py-0" />
                  <td colSpan={2} className="py-2.5 pl-6 pr-0 text-xs font-normal leading-relaxed text-text-secondary whitespace-pre-line">
                    {row.detail}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </LedgerTable>
    </LedgerSection>
  );
}
