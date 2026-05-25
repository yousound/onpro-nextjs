"use client";

import { useCallback, useMemo, useState } from "react";
import { capSystemWithCompletionPercent } from "@/lib/ledger/calculations";
import {
  capSystemsCompletionPercent,
  effectiveCapCents,
  paydownPercent,
  sumCapSystemsAccruedCents,
  sumPaidOnProCap,
} from "@/lib/ledger/calculations";
import { LEDGER_SEED } from "@/lib/ledger/seed";
import {
  loadLedgerState,
  newId,
  resetLedgerOverrides,
  saveCapSystems,
  saveInvoices,
  saveMilestones,
  saveScope,
} from "@/lib/ledger/store";
import type {
  InvoiceKind,
  LedgerCapSystem,
  LedgerInvoice,
  LedgerMilestone,
  LedgerProjectId,
  LedgerScopeItem,
  MilestoneStatus,
} from "@/lib/ledger/types";

export function useLedgerState() {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const state = useMemo(() => loadLedgerState(), [tick]);

  const capCents = useMemo(
    () => effectiveCapCents(state.onpro.capCents, state.expandableScope),
    [state.onpro.capCents, state.expandableScope],
  );

  const paidCents = useMemo(() => sumPaidOnProCap(state.invoices), [state.invoices]);

  const accruedCents = useMemo(
    () => sumCapSystemsAccruedCents(state.capSystems),
    [state.capSystems],
  );

  const metrics = useMemo(
    () => ({
      capCents,
      accruedCents,
      paidCents,
      remainingCapCents: capCents - paidCents,
      deferredCents: accruedCents - paidCents,
      monthlyRetainerCents: state.onpro.monthlyRetainerCents,
      workFinished: capSystemsCompletionPercent(state.capSystems),
      moneyPaid: paydownPercent(paidCents, capCents),
    }),
    [accruedCents, capCents, paidCents, state.capSystems, state.onpro.monthlyRetainerCents],
  );

  const markInvoicePaid = useCallback(
    (id: string) => {
      const next = state.invoices.map((i) => (i.id === id ? { ...i, status: "paid" as const } : i));
      saveInvoices(next);
      refresh();
    },
    [state.invoices, refresh],
  );

  const addInvoice = useCallback(
    (input: {
      dateLabel: string;
      label: string;
      amountCents: number;
      projectId: LedgerProjectId;
      kind: InvoiceKind;
    }) => {
      const inv: LedgerInvoice = {
        id: newId("inv"),
        status: "pending",
        lineItems: [],
        ...input,
      };
      saveInvoices([...state.invoices, inv]);
      refresh();
    },
    [state.invoices, refresh],
  );

  const setCapSystemCompletion = useCallback(
    (id: string, percent: number) => {
      const next = state.capSystems.map((s) =>
        s.id === id ? capSystemWithCompletionPercent(s, percent) : s,
      );
      saveCapSystems(next);
      refresh();
    },
    [state.capSystems, refresh],
  );

  const toggleCapSystem = useCallback(
    (id: string) => {
      const next: LedgerCapSystem[] = state.capSystems.map((s) => {
        if (s.id !== id || s.status === "in_progress" || s.status === "included") return s;
        const seed = LEDGER_SEED.capSystems.find((row) => row.id === id);
        if (s.status === "complete") {
          return { ...s, status: "pending", completionFraction: undefined, statusLabel: undefined };
        }
        const pct =
          seed?.completionFraction != null
            ? Math.round(seed.completionFraction * 100)
            : 100;
        return capSystemWithCompletionPercent(s, pct);
      });
      saveCapSystems(next);
      refresh();
    },
    [state.capSystems, refresh],
  );

  const toggleMilestone = useCallback(
    (id: string) => {
      const next: LedgerMilestone[] = state.milestones.map((m) => {
        if (m.id !== id) return m;
        const status: MilestoneStatus = m.status === "complete" ? "pending" : "complete";
        return { ...m, status };
      });
      saveMilestones(next);
      refresh();
    },
    [state.milestones, refresh],
  );

  const addMilestone = useCallback(
    (input: { phase: 1 | 2 | 3; label: string; weight: number }) => {
      const m: LedgerMilestone = {
        id: newId("m"),
        status: "pending",
        ...input,
      };
      saveMilestones([...state.milestones, m]);
      refresh();
    },
    [state.milestones, refresh],
  );

  const approveScope = useCallback(
    (id: string) => {
      const next = state.expandableScope.map((s) =>
        s.id === id ? { ...s, status: "approved" as const } : s,
      );
      saveScope(next);
      refresh();
    },
    [state.expandableScope, refresh],
  );

  const addScope = useCallback(
    (input: { label: string; addValueCents: number }) => {
      const s: LedgerScopeItem = {
        id: newId("scope"),
        status: "proposed",
        ...input,
      };
      saveScope([...state.expandableScope, s]);
      refresh();
    },
    [state.expandableScope, refresh],
  );

  const resetToSeed = useCallback(() => {
    resetLedgerOverrides();
    refresh();
  }, [refresh]);

  return {
    state,
    metrics,
    markInvoicePaid,
    addInvoice,
    setCapSystemCompletion,
    toggleCapSystem,
    toggleMilestone,
    addMilestone,
    approveScope,
    addScope,
    resetToSeed,
    refresh,
  };
}

export type LedgerStateApi = ReturnType<typeof useLedgerState>;
