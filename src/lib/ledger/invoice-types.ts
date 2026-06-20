/** Editable printable invoice — mirrors OnPro_Invoice_Fillable_Template.pdf fields. */

export interface LedgerInvoiceLineDraft {
  id: string;
  description: string;
  quantity: string;
  rate: string;
}

export interface LedgerPrintableInvoice {
  issuerName: string;
  billToName: string;
  billToEmail: string;
  billToAddress1: string;
  billToAddress2: string;
  invoiceNumber: string;
  invoiceDate: string;
  terms: string;
  dueDate: string;
  scheduledPaymentDate: string;
  projectName: string;
  ledgerReference: string;
  projectValue: string;
  valueAccrued: string;
  workFinishedPercent: string;
  paidToDate: string;
  capRemainingBefore: string;
  lines: LedgerInvoiceLineDraft[];
  paid: string;
  memoNotes: string;
  paymentScheduleNote: string;
}

export interface LedgerInvoiceComputed {
  lineAmountsCents: number[];
  subtotalCents: number;
  totalCents: number;
  paidCents: number;
  balanceDueCents: number;
  capRemainingAfterCents: number;
}
