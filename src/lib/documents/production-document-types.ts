/** Shared printable document for vendor POs and client estimates (production billing). */

export type ProductionDocumentKind = "vendor_po" | "client_estimate";

export interface ProductionDocumentLine {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  /** Show * non-taxable marker on print (vendor PO style). */
  non_taxable?: boolean;
}

export interface ProductionDocument {
  kind: ProductionDocumentKind;
  issuerName: string;
  issuerEmail: string;
  issuerAddress1: string;
  issuerAddress2: string;
  issuerWebsite: string;
  taxRegNumber: string;

  billToName: string;
  billToEmail: string;
  billToAddress1: string;
  billToAddress2: string;

  documentNumber: string;
  documentDate: string;
  terms: string;
  dueDate: string;

  shipToName: string;
  shipToAddress1: string;
  shipToAddress2: string;
  trackingNumber: string;
  shipVia: string;
  fob: string;

  projectName: string;
  projectNumber: string;
  jobNumber: string;
  referenceNotes: string;

  lines: ProductionDocumentLine[];
  shipping: string;
  paid: string;

  memoNotes: string;
  termsAndConditions: string;
}

export interface ProductionDocumentTotals {
  lineAmountsCents: number[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  paidCents: number;
  balanceDueCents: number;
}
