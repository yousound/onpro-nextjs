"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type LedgerStateApi, useLedgerState } from "@/lib/ledger/use-ledger-state";

const LedgerContext = createContext<LedgerStateApi | null>(null);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const api = useLedgerState();
  return <LedgerContext.Provider value={api}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerStateApi {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within LedgerProvider");
  return ctx;
}
