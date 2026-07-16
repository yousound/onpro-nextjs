"use client";

import { buildPhaseViews } from "@/lib/ledger/cap-system-phase";
import { LEDGER_SEED } from "@/lib/ledger/seed";
import type {
  LedgerCapSystem,
  LedgerInvoice,
  LedgerMilestone,
  LedgerOverrides,
  LedgerScopeItem,
  LedgerSeed,
} from "@/lib/ledger/types";

const OVERRIDES_KEY = "onpro.ledger.v13.overrides";
const AUTH_KEY = "onpro.ledger.v1.authed";

export function isLedgerAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

export function setLedgerAuthed(ok: boolean): void {
  if (typeof window === "undefined") return;
  if (ok) sessionStorage.setItem(AUTH_KEY, "1");
  else sessionStorage.removeItem(AUTH_KEY);
}

function readOverrides(): LedgerOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LedgerOverrides;
  } catch {
    return {};
  }
}

function writeOverrides(o: LedgerOverrides): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
}

export function resetLedgerOverrides(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OVERRIDES_KEY);
}

const LEGACY_CAP_SYSTEM_IDS: Record<string, string> = {
  "cap-rails": "cap-supabase-api",
};

/** Merge saved cap rows with seed so partial completion (e.g. iOS 95%) is not lost. */
export function mergeCapSystemsWithSeed(overrides?: LedgerCapSystem[]): LedgerCapSystem[] {
  const seedById = new Map(LEDGER_SEED.capSystems.map((s) => [s.id, s]));
  const rows = (overrides ?? LEDGER_SEED.capSystems).map((row) => {
    const id = LEGACY_CAP_SYSTEM_IDS[row.id] ?? row.id;
    return id === row.id ? row : { ...row, id };
  });
  return rows.map((row) => {
    const seed = seedById.get(row.id);
    if (!seed) return row;
    return {
      ...seed,
      ...row,
      completionFraction: row.completionFraction ?? seed.completionFraction,
      statusLabel: row.statusLabel ?? seed.statusLabel,
    };
  });
}

export function loadLedgerState(): LedgerSeed & { capCentsExtra: number } {
  const o = readOverrides();
  const capSystems = mergeCapSystemsWithSeed(o.capSystems);
  const { phase1Frontend, phase2Backend } = buildPhaseViews(capSystems);
  return {
    ...LEDGER_SEED,
    invoices: o.invoices ?? LEDGER_SEED.invoices,
    capSystems,
    phase1Frontend,
    milestones: o.milestones ?? LEDGER_SEED.milestones,
    phase2Backend,
    futureExpansion: LEDGER_SEED.futureExpansion,
    expandableScope: o.expandableScope ?? LEDGER_SEED.expandableScope,
    capCentsExtra: o.capCentsExtra ?? 0,
  };
}

export function saveInvoices(invoices: LedgerInvoice[]): void {
  const o = readOverrides();
  writeOverrides({ ...o, invoices });
}

export function saveCapSystems(capSystems: LedgerCapSystem[]): void {
  const o = readOverrides();
  writeOverrides({ ...o, capSystems });
}

export function saveMilestones(milestones: LedgerMilestone[]): void {
  const o = readOverrides();
  writeOverrides({ ...o, milestones });
}

export function saveScope(scope: LedgerScopeItem[]): void {
  const o = readOverrides();
  writeOverrides({ ...o, expandableScope: scope });
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
