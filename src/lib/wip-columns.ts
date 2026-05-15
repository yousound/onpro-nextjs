import type { Project } from "@/lib/types/project";

export type WipColumn = {
  id: string;
  /** PDF-aligned or module label */
  label: string;
  minWidth: number;
  accessor: (p: Project) => unknown;
};

/** Production-style columns; each accessor reads real `Project` fields only. */
export const WIP_COLUMNS: WipColumn[] = [
  { id: "name", label: "Project", minWidth: 160, accessor: (p) => p.name },
  { id: "client", label: "Client", minWidth: 120, accessor: (p) => p.client.name },
  { id: "status", label: "Status", minWidth: 130, accessor: (p) => p.status },
  {
    id: "hand_off",
    label: "Hand off",
    minWidth: 110,
    accessor: (p) => p.project_hand_off_date,
  },
  { id: "due", label: "Due", minWidth: 100, accessor: (p) => p.due_date },
  {
    id: "vendor_inquiries",
    label: "Vendor inquiries",
    minWidth: 120,
    accessor: (p) => p.quote_requested_date,
  },
  {
    id: "mock_up",
    label: "Mock up",
    minWidth: 110,
    accessor: (p) => p.references_sent_date,
  },
  {
    id: "cost_sheet",
    label: "Cost sheets",
    minWidth: 110,
    accessor: (p) => p.cost_sheet_prepared_date,
  },
  {
    id: "estimate_sent",
    label: "Costing summary",
    minWidth: 120,
    accessor: (p) => p.estimate_sent_date,
  },
  {
    id: "deposit",
    label: "Deposit / payment",
    minWidth: 120,
    accessor: (p) => p.costing_approved,
  },
  {
    id: "status_overview",
    label: "Status detail",
    minWidth: 160,
    accessor: (p) => p.status_overview,
  },
  {
    id: "tp_setup",
    label: "Tech pack set up",
    minWidth: 120,
    accessor: (p) => p.cs_tech_pack_request_date,
  },
  {
    id: "tp_sent",
    label: "Sent to contractors",
    minWidth: 130,
    accessor: (p) => p.tp_sent_date,
  },
  {
    id: "cs_tp_done",
    label: "C&S TP complete",
    minWidth: 130,
    accessor: (p) => p.cs_tech_pack_complete_date,
  },
  {
    id: "art_tp_done",
    label: "Artwork TP complete",
    minWidth: 140,
    accessor: (p) => p.artwork_tech_pack_complete_date,
  },
  {
    id: "lab_dip",
    label: "Lab dip received",
    minWidth: 120,
    accessor: (p) => p.lab_dip_received_date,
  },
  {
    id: "strike_off",
    label: "Strike-off received",
    minWidth: 140,
    accessor: (p) => p.strike_off_received_date,
  },
  {
    id: "top_approved",
    label: "TOP approved",
    minWidth: 110,
    accessor: (p) => p.top_approved_date,
  },
  {
    id: "ex_factory",
    label: "Ex-factory",
    minWidth: 100,
    accessor: (p) => p.ex_factory_date,
  },
  {
    id: "bulk_target",
    label: "Bulk target",
    minWidth: 110,
    accessor: (p) => p.bulk_target_delivery_date,
  },
  {
    id: "client_received",
    label: "Client received",
    minWidth: 120,
    accessor: (p) => p.client_received_date,
  },
];
