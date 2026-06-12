import type { ProjectJob } from "@/lib/types/wip";
import type { ISODate } from "@/lib/types/project";
import { formatCellValue } from "@/lib/format";
import { techPackCompleteDate } from "@/lib/job-development";

export type JobWipColumn = {
  id: string;
  label: string;
  minWidth: number;
  accessor: (job: ProjectJob) => unknown;
};

/** Production board milestone columns (team sequence, June 2026). */
export const JOB_WIP_COLUMNS: JobWipColumn[] = [
  {
    id: "cost_sheet",
    label: "Cost sheets complete",
    minWidth: 130,
    accessor: (j) => j.costing?.cost_sheet_prepared_date ?? null,
  },
  {
    id: "estimate_sent",
    label: "Estimate sent to client",
    minWidth: 140,
    accessor: (j) => j.costing?.estimate_sent_date ?? null,
  },
  {
    id: "deposit",
    label: "Deposit / payment received",
    minWidth: 150,
    accessor: (j) => j.costing?.costing_approved_at ?? null,
  },
  {
    id: "tp_complete",
    label: "Tech pack complete",
    minWidth: 130,
    accessor: (j) => techPackCompleteDate(j.tech_pack) ?? null,
  },
  {
    id: "blanks_complete",
    label: "Blanks complete",
    minWidth: 120,
    accessor: (j) => j.costing?.blanks_received_date ?? null,
  },
  {
    id: "ex_factory",
    label: "Ex-factory",
    minWidth: 100,
    accessor: (j) => j.bulk_production_tracks?.[0]?.ex_factory_date ?? null,
  },
];

export function formatJobWipCell(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return formatCellValue(value as ISODate);
}
