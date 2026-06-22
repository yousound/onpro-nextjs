import { formatPercent, formatUsdDetailed, parseUsdInput } from "@/lib/ledger/format";
import type { LedgerInvoice, LedgerSeed } from "@/lib/ledger/types";
import type {
  LedgerInvoiceComputed,
  LedgerInvoiceLineDraft,
  LedgerPrintableInvoice,
} from "@/lib/ledger/invoice-types";
import { costingTotals } from "@/lib/costing-sheet";
import type { Estimate } from "@/lib/types/wip";

export const DEFAULT_BILL_TO = {
  name: "Connect Dots",
  email: "jerry@connectdots.la",
  address1: "2301 E. 7th St F101",
  address2: "Los Angeles, CA 90023",
} as const;

export const DEFAULT_PAYMENT_SCHEDULE_NOTE =
  "Slow-pay schedule: $1,500 for the first few scheduled monthly payments;\nthen $3,000 monthly installments on agreed start date;\nthen lump-sum cap paydowns thereafter.";

/** Slow-pay starting installment — before full $3k monthly retainer kicks in. */
export const SLOW_PAY_INSTALLMENT_CENTS = 150_000;

function todayUs(): string {
  return new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function invoiceNumberFromDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `ONPRO-${y}-${m}`;
}

function newLineId(): string {
  return `line-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyInvoiceLine(): LedgerInvoiceLineDraft {
  return { id: newLineId(), description: "", quantity: "1", rate: "" };
}

export function computeInvoiceTotals(
  draft: LedgerPrintableInvoice,
  capRemainingBeforeCents?: number,
): LedgerInvoiceComputed {
  const lineAmountsCents = draft.lines.map((line) => {
    const qty = Number.parseFloat(line.quantity.replace(/[^0-9.-]/g, "")) || 0;
    const rateCents = parseUsdInput(line.rate);
    return Math.round(qty * rateCents);
  });

  const subtotalCents = lineAmountsCents.reduce((s, n) => s + n, 0);
  const totalCents = subtotalCents;
  const paidCents = parseUsdInput(draft.paid);
  const balanceDueCents = Math.max(0, totalCents - paidCents);

  const capBefore =
    capRemainingBeforeCents ?? parseUsdInput(draft.capRemainingBefore);
  const capRemainingAfterCents = Math.max(0, capBefore - totalCents);

  return {
    lineAmountsCents,
    subtotalCents,
    totalCents,
    paidCents,
    balanceDueCents,
    capRemainingAfterCents,
  };
}

function buildMemoNotes(metrics: {
  capCents: number;
  accruedCents: number;
  workFinished: number;
}): string {
  return [
    `Payment installment against the ${formatUsdDetailed(metrics.capCents)} OnPro development cap.`,
    "Deliverable detail is tracked in the OnPro Development Ledger.",
    `Current ledger: ${formatPercent(metrics.workFinished)} finished; ${formatUsdDetailed(metrics.accruedCents)} accrued.`,
  ].join("\n");
}

function lineFromLedgerInvoice(inv: LedgerInvoice): LedgerInvoiceLineDraft {
  const amount = formatUsdDetailed(inv.amountCents);
  return {
    id: newLineId(),
    description: inv.label,
    quantity: "1",
    rate: amount,
  };
}

export function buildInvoiceDraftFromLedger(input: {
  metrics: {
    capCents: number;
    accruedCents: number;
    paidCents: number;
    remainingCapCents: number;
    workFinished: number;
    monthlyRetainerCents: number;
  };
  sourceInvoice?: LedgerInvoice;
  /** Next pending OnPro invoice — sets default amount/period when no source invoice. */
  nextPendingOnProInvoice?: LedgerInvoice;
  seed?: Pick<LedgerSeed, "disclaimer">;
}): LedgerPrintableInvoice {
  const { metrics, sourceInvoice, nextPendingOnProInvoice } = input;
  const now = todayUs();
  const billingInvoice = sourceInvoice ?? nextPendingOnProInvoice;
  const period = billingInvoice?.dateLabel ?? "current period";
  const installmentCents = billingInvoice?.amountCents ?? SLOW_PAY_INSTALLMENT_CENTS;

  const defaultLine: LedgerInvoiceLineDraft = billingInvoice
    ? lineFromLedgerInvoice(billingInvoice)
    : {
        id: newLineId(),
        description: `ONPRO development cap installment - ${period}\nGeneral development work; details tracked in OnPro Development Ledger.`,
        quantity: "1",
        rate: formatUsdDetailed(installmentCents),
      };

  return {
    issuerName: "Ricci Rucker",
    billToName: DEFAULT_BILL_TO.name,
    billToEmail: DEFAULT_BILL_TO.email,
    billToAddress1: DEFAULT_BILL_TO.address1,
    billToAddress2: DEFAULT_BILL_TO.address2,
    invoiceNumber: invoiceNumberFromDate(),
    invoiceDate: now,
    terms: "Due upon receipt",
    dueDate: now,
    scheduledPaymentDate: now,
    projectName: "ONPRO - Development Cap",
    ledgerReference: "OnPro Development Ledger",
    projectValue: formatUsdDetailed(metrics.capCents),
    valueAccrued: formatUsdDetailed(metrics.accruedCents),
    workFinishedPercent: formatPercent(metrics.workFinished),
    paidToDate: formatUsdDetailed(metrics.paidCents),
    capRemainingBefore: formatUsdDetailed(metrics.remainingCapCents),
    lines: [defaultLine, emptyInvoiceLine(), emptyInvoiceLine()],
    paid: formatUsdDetailed(0),
    memoNotes: buildMemoNotes(metrics),
    paymentScheduleNote: DEFAULT_PAYMENT_SCHEDULE_NOTE,
  };
}

/** Refresh ledger summary fields without overwriting bill-to or line items. */
export function syncLedgerSummaryFields(
  draft: LedgerPrintableInvoice,
  metrics: {
    capCents: number;
    accruedCents: number;
    paidCents: number;
    remainingCapCents: number;
    workFinished: number;
  },
): LedgerPrintableInvoice {
  return {
    ...draft,
    projectValue: formatUsdDetailed(metrics.capCents),
    valueAccrued: formatUsdDetailed(metrics.accruedCents),
    workFinishedPercent: formatPercent(metrics.workFinished),
    paidToDate: formatUsdDetailed(metrics.paidCents),
    capRemainingBefore: formatUsdDetailed(metrics.remainingCapCents),
    memoNotes: buildMemoNotes(metrics),
  };
}

export const INVOICE_PREFILL_SESSION_KEY = "onpro-invoice-prefill";

export function storeInvoicePrefill(draft: LedgerPrintableInvoice): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(INVOICE_PREFILL_SESSION_KEY, JSON.stringify(draft));
}

export function readInvoicePrefill(): LedgerPrintableInvoice | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(INVOICE_PREFILL_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LedgerPrintableInvoice;
  } catch {
    return null;
  }
}

export function clearInvoicePrefill(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INVOICE_PREFILL_SESSION_KEY);
}

/** Build a client invoice draft from an accepted job estimate (production billing). */
export function buildInvoiceDraftFromAcceptedEstimate(input: {
  projectName: string;
  projectNumber?: string | null;
  clientName: string;
  jobNumber?: string | null;
  estimate: Estimate;
}): LedgerPrintableInvoice {
  const now = todayUs();
  const sheet = input.estimate.costing_sheet_snapshot;
  const totals = costingTotals(sheet);
  const lines: LedgerInvoiceLineDraft[] = sheet.lines.map((line) => ({
    id: newLineId(),
    description: [line.description, line.vendor ? `(${line.vendor})` : ""].filter(Boolean).join(" "),
    quantity: String(line.qty || 1),
    rate: formatUsdDetailed(Math.round(line.price * 100)),
  }));
  while (lines.length < 3) lines.push(emptyInvoiceLine());

  const projectLabel = [input.projectName, input.projectNumber].filter(Boolean).join(" · ");
  const jobRef = input.jobNumber ? `Job ${input.jobNumber}` : input.estimate.document_number;

  return {
    issuerName: "Connect Dots",
    billToName: input.clientName,
    billToEmail: "",
    billToAddress1: "",
    billToAddress2: "",
    invoiceNumber: invoiceNumberFromDate(),
    invoiceDate: now,
    terms: "Net 30",
    dueDate: now,
    scheduledPaymentDate: now,
    projectName: projectLabel || input.projectName,
    ledgerReference: jobRef,
    projectValue: formatUsdDetailed(Math.round(totals.final_cost_to_quote_client * 100)),
    valueAccrued: formatUsdDetailed(Math.round(totals.total_price * 100)),
    workFinishedPercent: "0%",
    paidToDate: formatUsdDetailed(0),
    capRemainingBefore: formatUsdDetailed(Math.round(totals.final_cost_to_quote_client * 100)),
    lines,
    paid: formatUsdDetailed(0),
    memoNotes: `Invoice from accepted estimate ${input.estimate.document_number}.`,
    paymentScheduleNote: DEFAULT_PAYMENT_SCHEDULE_NOTE,
  };
}
