import type { LedgerCapSystem, LedgerInvoice, LedgerMilestone, LedgerScopeItem, LedgerSystemRow } from "@/lib/ledger/types";

export function sumPaidInvoices(invoices: LedgerInvoice[], projectId?: "onpro" | "fbrc"): number {
  return invoices
    .filter((i) => i.status === "paid" && (projectId == null || i.projectId === projectId))
    .reduce((s, i) => s + i.amountCents, 0);
}

/** Paid invoices that draw down the OnPro project cap (excludes FBRC / DROPX). */
export function sumPaidOnProCap(invoices: LedgerInvoice[]): number {
  return sumPaidInvoices(invoices, "onpro");
}

export function effectiveCapCents(baseCapCents: number, scope: LedgerScopeItem[]): number {
  const approved = scope
    .filter((s) => s.status === "approved")
    .reduce((sum, s) => sum + s.addValueCents, 0);
  return baseCapCents + approved;
}

export function paydownPercent(paidCents: number, capCents: number): number {
  if (capCents <= 0) return 0;
  return Math.min(1, paidCents / capCents);
}

export function completionPercent(milestones: LedgerMilestone[]): number {
  const total = milestones.reduce((s, m) => s + m.weight, 0);
  if (total <= 0) return 0;
  const done = milestones.filter((m) => m.status === "complete").reduce((s, m) => s + m.weight, 0);
  return done / total;
}

/** 0–1 completion for a cap system (explicit fraction, or 1 when complete, else 0). */
export function capSystemCompletionFraction(system: LedgerSystemRow): number {
  if (system.completionFraction != null) {
    return Math.min(1, Math.max(0, system.completionFraction));
  }
  if (system.status === "complete") return 1;
  return 0;
}

export function capSystemAccruedCents(system: LedgerCapSystem): number {
  const value = system.valueCents ?? 0;
  return Math.round(value * capSystemCompletionFraction(system));
}

export function sumCapSystemsValueCents(systems: LedgerCapSystem[]): number {
  return systems.reduce((s, m) => s + (m.valueCents ?? 0), 0);
}

export function sumCapSystemsAccruedCents(systems: LedgerCapSystem[]): number {
  return systems.reduce((s, m) => s + capSystemAccruedCents(m), 0);
}

/** Dollar-weighted work finished: total accrued ÷ total system value ($75k cap systems). */
export function capSystemsCompletionPercent(systems: LedgerCapSystem[]): number {
  const total = sumCapSystemsValueCents(systems);
  if (total <= 0) return 0;
  return sumCapSystemsAccruedCents(systems) / total;
}

export function systemStatusLabel(row: {
  status: LedgerCapSystem["status"];
  statusLabel?: string;
  completionFraction?: number;
}): string {
  if (row.statusLabel) return row.statusLabel;
  if (row.status === "complete" && row.completionFraction != null && row.completionFraction < 1) {
    return `${Math.round(row.completionFraction * 100)}% Complete`;
  }
  if (row.status === "in_progress" && row.completionFraction != null && row.completionFraction > 0) {
    return `${Math.round(row.completionFraction * 100)}% Complete`;
  }
  switch (row.status) {
    case "complete":
      return "Complete";
    case "pending":
      return "Pending";
    case "in_progress":
      return "In progress";
    case "included":
      return "Included";
  }
}

export function systemValueDisplay(row: { valueCents?: number; valueLabel?: string }, formatUsd: (c: number) => string): string {
  if (row.valueLabel) return row.valueLabel;
  if (row.valueCents != null) return formatUsd(row.valueCents);
  return "—";
}

export function milestonesByPhase(milestones: LedgerMilestone[], phase: 1 | 2 | 3): LedgerMilestone[] {
  return milestones.filter((m) => m.phase === phase);
}

/** Apply UI completion % (0–100); persists via capSystems in localStorage. */
export function capSystemWithCompletionPercent(
  system: LedgerCapSystem,
  percent: number,
): LedgerCapSystem {
  const p = Math.round(Math.min(100, Math.max(0, percent)));
  const f = p / 100;
  if (p === 0) {
    return { ...system, status: "pending", completionFraction: undefined, statusLabel: undefined };
  }
  if (p === 100) {
    return { ...system, status: "complete", completionFraction: 1, statusLabel: "Complete" };
  }
  return {
    ...system,
    status: "in_progress",
    completionFraction: f,
    statusLabel: `${p}% Complete`,
  };
}
