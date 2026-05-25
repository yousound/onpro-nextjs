/** Founder / partner ledger — local-only until backend exists. */

export type LedgerProjectId = "onpro" | "dropx" | "fbrc";

export type InvoiceStatus = "pending" | "paid";
export type InvoiceKind = "retainer" | "transfer" | "milestone" | "other";

export type MilestoneStatus = "pending" | "complete";
export type LedgerSystemStatus = "complete" | "pending" | "in_progress" | "included";
export type ScopeStatus = "proposed" | "approved";
export type WorkRecordStatus = "completed" | "in_progress" | "pending";

export interface LedgerInvoiceLineItem {
  id: string;
  description: string;
  amountCents: number;
}

export interface LedgerInvoice {
  id: string;
  dateLabel: string;
  label: string;
  amountCents: number;
  status: InvoiceStatus;
  projectId: LedgerProjectId;
  kind: InvoiceKind;
  lineItems?: LedgerInvoiceLineItem[];
  notes?: string;
}

/** Dated deliverables — master accounting list below invoices (staggered by period). */
export interface LedgerWorkRecord {
  id: string;
  /** Display period, e.g. "Jan 2026" or "June 2026" */
  periodLabel: string;
  /** Sortable key, e.g. "2026-01" */
  sortKey: string;
  projectId: LedgerProjectId;
  description: string;
  valueCents?: number;
  valueLabel?: string;
  /** Optional link to a billing invoice row */
  invoiceId?: string;
  status: WorkRecordStatus;
}

export interface LedgerMilestone {
  id: string;
  phase: 1 | 2 | 3;
  label: string;
  /** Weight toward “work finished” % (not dollars). */
  weight: number;
  status: MilestoneStatus;
  valueWeightCents?: number;
}

/** Major systems in the $75k cap — drives work-finished % and cap breakdown table. */
export interface LedgerSystemRow {
  id: string;
  label: string;
  status: LedgerSystemStatus;
  valueCents?: number;
  valueLabel?: string;
  /** Override status column text (e.g. "95% Complete"). */
  statusLabel?: string;
  /** 0–1 share of this row’s weight toward work-finished % (default 1 when complete, 0 otherwise). */
  completionFraction?: number;
}

export interface LedgerCapSystem extends LedgerSystemRow {
  weight: number;
}

/** Phase table rows (mirror cap systems; included rows have no valueCents). */
export type LedgerPhase1Row = LedgerSystemRow;

export interface LedgerFutureExpansion {
  id: string;
  label: string;
  /** Optional ballpark if discussed (e.g. Android ~$20k). */
  estValueLabel?: string;
  status: string;
}

export interface LedgerScopeItem {
  id: string;
  label: string;
  addValueCents: number;
  addValueLabel?: string;
  status: ScopeStatus;
}

export interface LedgerKeyValue {
  label: string;
  value: string;
}

export interface LedgerFbrcLine {
  id: string;
  label: string;
  amountCents: number | null;
  amountLabel?: string;
  status: string;
}

export interface LedgerOnProMeta {
  capCents: number;
  monthlyRetainerCents: number;
  includedInCap: string[];
}

export interface LedgerSeed {
  disclaimer: string;
  onpro: LedgerOnProMeta;
  capSystems: LedgerCapSystem[];
  phase1Frontend: LedgerPhase1Row[];
  phase2Backend: LedgerPhase1Row[];
  invoices: LedgerInvoice[];
  /** Chronological deliverables accounted for across billing periods */
  workRecords: LedgerWorkRecord[];
  milestones: LedgerMilestone[];
  futureExpansion: LedgerFutureExpansion[];
  /** @deprecated Cap approvals — use futureExpansion (read-only TBD) instead */
  expandableScope: LedgerScopeItem[];
  dropx: LedgerKeyValue[];
  dropxNote: string;
  fbrc: LedgerFbrcLine[];
  fbrcNote: string;
}

export interface LedgerOverrides {
  invoices?: LedgerInvoice[];
  milestones?: LedgerMilestone[];
  capSystems?: LedgerCapSystem[];
  expandableScope?: LedgerScopeItem[];
  capCentsExtra?: number;
}
