import { systemValueDisplay } from "@/lib/ledger/calculations";
import type { LedgerWorkRecord } from "@/lib/ledger/types";

const INTERNAL_WORK_RECORD_IDS = new Set(["wr-ledger"]);

/** Cap-system mirror rows — dollar weight lives in capSystems / progress pair, not deliverables. */
const CAP_MIRROR_WORK_RECORD_IDS = new Set([
  "wr-cap-ios",
  "wr-cap-next",
  "wr-supabase-api",
  "wr-admin",
]);

/** Engineering deliverables in date order (includes invoice-period tasks; no per-task billing). */
export function taskWorkRecordsOnly(records: LedgerWorkRecord[]): LedgerWorkRecord[] {
  return records.filter(
    (r) => !INTERNAL_WORK_RECORD_IDS.has(r.id) && !CAP_MIRROR_WORK_RECORD_IDS.has(r.id),
  );
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
