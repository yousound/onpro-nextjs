import type { ProjectJob } from "@/lib/types/wip";
import type { ISODate } from "@/lib/types/project";
import { formatCellValue } from "@/lib/format";

export type JobWipColumn = {
  id: string;
  label: string;
  minWidth: number;
  accessor: (job: ProjectJob) => unknown;
};

/** Production board columns sourced from job-level fields. */
export const JOB_WIP_COLUMNS: JobWipColumn[] = [
  {
    id: "quote_requested",
    label: "Vendor inquiries",
    minWidth: 120,
    accessor: (j) => j.estimate?.quote_requested_date ?? null,
  },
  {
    id: "mock_up",
    label: "Mock up",
    minWidth: 110,
    accessor: (j) => j.estimate?.references_sent_date ?? null,
  },
  {
    id: "cost_sheet",
    label: "Cost sheets",
    minWidth: 110,
    accessor: (j) => j.costing?.cost_sheet_prepared_date ?? null,
  },
  {
    id: "estimate_sent",
    label: "Costing summary",
    minWidth: 120,
    accessor: (j) => j.costing?.estimate_sent_date ?? null,
  },
  {
    id: "deposit",
    label: "Deposit / payment",
    minWidth: 120,
    accessor: (j) => j.costing?.costing_approved ?? null,
  },
  {
    id: "tp_setup",
    label: "Tech pack set up",
    minWidth: 120,
    accessor: (j) => j.tech_pack?.cs_tech_pack_request_date ?? null,
  },
  {
    id: "blanks",
    label: "Blanks / PG",
    minWidth: 110,
    accessor: (j) => j.costing?.blanks_purchased_date ?? j.costing?.pg_requested_date ?? null,
  },
  {
    id: "lab_dip",
    label: "Lab dip",
    minWidth: 110,
    accessor: (j) => j.costing?.dye_costing_tracks?.[0]?.lab_dip_request_date ?? null,
  },
  {
    id: "trims",
    label: "Trims ordered",
    minWidth: 110,
    accessor: (j) => j.bulk_production_tracks?.[0]?.new_product_request_date ?? null,
  },
  {
    id: "tp_complete",
    label: "TP complete",
    minWidth: 110,
    accessor: (j) => j.tech_pack?.cs_tech_pack_complete_date ?? null,
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
