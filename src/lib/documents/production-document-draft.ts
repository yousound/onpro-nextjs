import { colorwayRowTotal, formatJobSizeBreakdown } from "@/lib/job-colorways";
import { formatUsdDetailed, parseUsdInput } from "@/lib/ledger/format";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { Estimate, ProjectJob, VendorQuote } from "@/lib/types/wip";
import { projectPoNumber } from "@/lib/po-number";
import type {
  ProductionDocument,
  ProductionDocumentLine,
  ProductionDocumentTotals,
} from "@/lib/documents/production-document-types";

export const CONNECT_DOTS_ISSUER = {
  name: "Connect Dots",
  email: "jerry@connectdots.la",
  address1: "2301 E. 7th St. Suite F101",
  address2: "Los Angeles, CA 90023",
  website: "connectdots.la",
  taxReg: "102-634556",
} as const;

export const DEFAULT_VENDOR_PO_TERMS =
  "Orders may have a variance of ±10% from the original quantity, and will be considered complete if the final shipped amount falls within this range.";

export const DEFAULT_CLIENT_ESTIMATE_TERMS = "Estimate valid for 30 days from the date above unless otherwise noted.";

export const PRODUCTION_DOCUMENT_PREFILL_KEY = "onpro-production-document-prefill";

function todayUs(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function newLineId(): string {
  return `pdl-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyProductionLine(): ProductionDocumentLine {
  return { id: newLineId(), description: "", quantity: "1", rate: "" };
}

function formatContactAddress(contact?: Contact | null): { line1: string; line2: string } {
  if (!contact) return { line1: "", line2: "" };
  const addr = contact.billing_address ?? contact.shipping_address;
  if (!addr) return { line1: "", line2: "" };
  const line1 = addr.line1?.trim() ?? "";
  const cityLine = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ");
  const line2 = [addr.line2?.trim(), cityLine, addr.country?.trim()].filter(Boolean).join("\n");
  return { line1, line2 };
}

function baseDocument(
  kind: ProductionDocument["kind"],
  partial: Partial<ProductionDocument> = {},
): ProductionDocument {
  const now = todayUs();
  return {
    kind,
    issuerName: CONNECT_DOTS_ISSUER.name,
    issuerEmail: CONNECT_DOTS_ISSUER.email,
    issuerAddress1: CONNECT_DOTS_ISSUER.address1,
    issuerAddress2: CONNECT_DOTS_ISSUER.address2,
    issuerWebsite: CONNECT_DOTS_ISSUER.website,
    taxRegNumber: CONNECT_DOTS_ISSUER.taxReg,
    billToName: "",
    billToEmail: "",
    billToAddress1: "",
    billToAddress2: "",
    documentNumber: "",
    documentDate: now,
    terms:
      kind === "vendor_po"
        ? "Net 30"
        : kind === "vendor_quote"
          ? "Quote request"
          : "Estimate",
    dueDate: now,
    shipToName: CONNECT_DOTS_ISSUER.name,
    shipToAddress1: CONNECT_DOTS_ISSUER.address1,
    shipToAddress2: CONNECT_DOTS_ISSUER.address2,
    trackingNumber: "",
    shipVia: "",
    fob: "",
    projectName: "",
    projectNumber: "",
    jobNumber: "",
    referenceNotes: "",
    lines: [emptyProductionLine(), emptyProductionLine(), emptyProductionLine()],
    shipping: formatUsdDetailed(0),
    paid: formatUsdDetailed(0),
    memoNotes: "",
    termsAndConditions:
      kind === "vendor_po"
        ? DEFAULT_VENDOR_PO_TERMS
        : kind === "vendor_quote"
          ? "Pricing and lead times subject to vendor confirmation."
          : DEFAULT_CLIENT_ESTIMATE_TERMS,
    ...partial,
  };
}

export function computeProductionDocumentTotals(
  draft: ProductionDocument,
): ProductionDocumentTotals {
  const lineAmountsCents = draft.lines.map((line) => {
    const qty = Number.parseFloat(line.quantity.replace(/[^0-9.\-]/g, "")) || 0;
    const rateCents = parseUsdInput(line.rate);
    return Math.round(qty * rateCents);
  });
  const subtotalCents = lineAmountsCents.reduce((s, n) => s + n, 0);
  const shippingCents = parseUsdInput(draft.shipping);
  const totalCents = subtotalCents + shippingCents;
  const paidCents = parseUsdInput(draft.paid);
  const balanceDueCents = Math.max(0, totalCents - paidCents);
  return {
    lineAmountsCents,
    subtotalCents,
    shippingCents,
    totalCents,
    paidCents,
    balanceDueCents,
  };
}

export function buildVendorQuoteDocument(input: {
  project: Project;
  job: ProjectJob;
  quote: VendorQuote;
  vendorContact?: Contact | null;
}): ProductionDocument {
  const { project, job, quote, vendorContact } = input;
  const pn = projectPoNumber(project) ?? "";
  const addr = formatContactAddress(vendorContact);
  const rate =
    quote.unit_cost > 0 ? formatUsdDetailed(Math.round(quote.unit_cost * 100)) : "";

  const lines: ProductionDocumentLine[] = [
    {
      id: newLineId(),
      description: quote.item_description?.trim() || job.name?.trim() || "Quote request",
      quantity: String(quote.qty || 1),
      rate,
      non_taxable: true,
    },
  ];
  while (lines.length < 3) lines.push(emptyProductionLine());

  const jobRef = job.job_number?.trim() || job.id;
  return baseDocument("vendor_quote", {
    billToName: vendorContact?.name?.trim() || quote.vendor?.trim() || "",
    billToEmail: vendorContact?.email?.trim() ?? "",
    billToAddress1: addr.line1,
    billToAddress2: addr.line2,
    documentNumber: quote.po_number?.trim() || `VQ-${jobRef}`,
    projectName: project.name?.trim() ?? "",
    projectNumber: pn,
    jobNumber: job.job_number?.trim() ?? "",
    referenceNotes: [job.style_number, job.name].filter(Boolean).join(" · "),
    lines,
    memoNotes: quote.notes?.trim() ?? "",
  });
}

export function buildVendorPoDocument(input: {
  project: Project;
  job: ProjectJob;
  quote: VendorQuote;
  vendorContact?: Contact | null;
}): ProductionDocument {
  const { project, job, quote, vendorContact } = input;
  const pn = projectPoNumber(project) ?? "";
  const addr = formatContactAddress(vendorContact);
  const rate =
    quote.unit_cost > 0 ? formatUsdDetailed(Math.round(quote.unit_cost * 100)) : "";

  const lines: ProductionDocumentLine[] = [
    {
      id: newLineId(),
      description: quote.item_description?.trim() || job.name?.trim() || "Quote request",
      quantity: String(quote.qty || 1),
      rate,
      non_taxable: true,
    },
  ];
  while (lines.length < 3) lines.push(emptyProductionLine());

  return baseDocument("vendor_po", {
    billToName: vendorContact?.name?.trim() || quote.vendor?.trim() || "",
    billToEmail: vendorContact?.email?.trim() ?? "",
    billToAddress1: addr.line1,
    billToAddress2: addr.line2,
    documentNumber: quote.po_number?.trim() || pn,
    projectName: project.name?.trim() ?? "",
    projectNumber: pn,
    jobNumber: job.job_number?.trim() ?? "",
    referenceNotes: [job.style_number, job.name].filter(Boolean).join(" · "),
    lines,
    memoNotes: quote.notes?.trim() ?? "",
  });
}

export function buildClientEstimateDocument(input: {
  project: Project;
  job: ProjectJob;
  estimate: Estimate;
  clientName: string;
  clientContact?: Contact | null;
  orderJobs?: ProjectJob[];
}): ProductionDocument {
  const { project, job, estimate, clientName, clientContact, orderJobs } = input;
  const pn = projectPoNumber(project) ?? "";
  const addr = formatContactAddress(clientContact);
  const sheet = estimate.costing_sheet_snapshot;
  const jobsForLines = orderJobs?.length ? orderJobs : [job];

  let lines: ProductionDocumentLine[] = sheet.lines.map((line) => ({
    id: newLineId(),
    description: [line.description, line.vendor ? `(${line.vendor})` : ""].filter(Boolean).join(" "),
    quantity: String(line.qty || 1),
    rate: formatUsdDetailed(Math.round(line.price * 100)),
  }));

  if (lines.length === 0 || (jobsForLines.length > 1 && lines.length < jobsForLines.length)) {
    lines = jobsForLines.map((orderJob) => {
      const rows = orderJob.colorway_rows ?? [];
      const qtyTotal = rows.reduce((sum, row) => sum + colorwayRowTotal(row), 0);
      const unitPrice = parseFloat(String(orderJob.price ?? "").replace(/[^0-9.\-]/g, "")) || 0;
      const colorSummary = formatJobSizeBreakdown(rows).replace(/\n/g, "; ");
      const description = [
        orderJob.name?.trim(),
        orderJob.style_number?.trim() ? `Style ${orderJob.style_number.trim()}` : null,
        colorSummary || null,
      ]
        .filter(Boolean)
        .join(" — ");
      return {
        id: newLineId(),
        description: description || orderJob.name?.trim() || "Line item",
        quantity: String(qtyTotal || 1),
        rate: unitPrice > 0 ? formatUsdDetailed(Math.round(unitPrice * 100)) : "",
      };
    });
  }

  while (lines.length < 3) lines.push(emptyProductionLine());

  const jobNumbers = jobsForLines
    .map((j) => j.job_number?.trim())
    .filter(Boolean)
    .join(", ");

  return baseDocument("client_estimate", {
    billToName: clientName,
    billToEmail: clientContact?.email?.trim() ?? "",
    billToAddress1: addr.line1,
    billToAddress2: addr.line2,
    documentNumber: estimate.document_number,
    projectName: project.name?.trim() ?? "",
    projectNumber: pn,
    jobNumber: jobNumbers || (job.job_number?.trim() ?? ""),
    referenceNotes: estimate.document_number,
    lines,
    memoNotes: sheet.notes?.trim() ?? "",
  });
}

export function buildJobPreviewEstimateDocument(input: {
  project: Project;
  job: ProjectJob;
  clientName: string;
  clientContact?: Contact | null;
}): ProductionDocument {
  const { project, job, clientName, clientContact } = input;
  const pn = projectPoNumber(project) ?? "";
  const addr = formatContactAddress(clientContact);
  const rows = job.colorway_rows ?? [];
  const qtyTotal = rows.reduce((sum, row) => sum + colorwayRowTotal(row), 0);
  const unitPrice = parseFloat(String(job.price ?? "").replace(/[^0-9.\-]/g, "")) || 0;
  const colorSummary = formatJobSizeBreakdown(rows).replace(/\n/g, "; ");

  const description = [
    job.name?.trim(),
    job.style_number?.trim() ? `Style ${job.style_number.trim()}` : null,
    colorSummary,
    job.description?.trim(),
  ]
    .filter(Boolean)
    .join(" — ");

  const lines: ProductionDocumentLine[] = [
    {
      id: newLineId(),
      description: description || "Job line",
      quantity: String(qtyTotal || 1),
      rate: unitPrice > 0 ? formatUsdDetailed(Math.round(unitPrice * 100)) : "",
    },
  ];
  while (lines.length < 3) lines.push(emptyProductionLine());

  return baseDocument("client_estimate", {
    billToName: clientName,
    billToEmail: clientContact?.email?.trim() ?? "",
    billToAddress1: addr.line1,
    billToAddress2: addr.line2,
    documentNumber: job.job_number?.trim() || pn,
    projectName: project.name?.trim() ?? "",
    projectNumber: pn,
    jobNumber: job.job_number?.trim() ?? "",
    referenceNotes: job.style_number?.trim() ?? "",
    lines,
    memoNotes: job.description?.trim() ?? "",
  });
}

export function storeProductionDocumentPrefill(draft: ProductionDocument): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PRODUCTION_DOCUMENT_PREFILL_KEY, JSON.stringify(draft));
}

export function readProductionDocumentPrefill(): ProductionDocument | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PRODUCTION_DOCUMENT_PREFILL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProductionDocument;
  } catch {
    return null;
  }
}

export function clearProductionDocumentPrefill(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PRODUCTION_DOCUMENT_PREFILL_KEY);
}

export function productionDocumentTitle(draft: ProductionDocument): string {
  const label =
    draft.kind === "vendor_po" ? "PO" : draft.kind === "vendor_quote" ? "Quote" : "Estimate";
  const num = draft.documentNumber.trim() || "draft";
  return `ConnectDots-${label}-${num}`;
}
