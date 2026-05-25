import { systemValueDisplay } from "@/lib/ledger/calculations";
import type { LedgerWorkRecord } from "@/lib/ledger/types";

const INTERNAL_WORK_RECORD_IDS = new Set(["wr-ledger"]);

/** Deliverables only — no retainer/invoice payout rows or internal tooling. */
export function taskWorkRecordsOnly(records: LedgerWorkRecord[]): LedgerWorkRecord[] {
  return records.filter((r) => !r.invoiceId && !INTERNAL_WORK_RECORD_IDS.has(r.id));
}

export function sortWorkRecords(records: LedgerWorkRecord[]): LedgerWorkRecord[] {
  return [...records].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function workRecordValueDisplay(
  row: Pick<LedgerWorkRecord, "valueCents" | "valueLabel">,
  formatUsd: (c: number) => string,
): string {
  return systemValueDisplay(row, formatUsd);
}

export function workRecordStatusLabel(status: LedgerWorkRecord["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "pending":
      return "Pending";
  }
}
