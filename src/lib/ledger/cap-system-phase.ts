import { LEDGER_SEED } from "@/lib/ledger/seed";
import type { LedgerCapSystem, LedgerPhase1Row } from "@/lib/ledger/types";

const CAP_TO_PHASE_ID: Record<string, string> = {
  "cap-ios": "p1-ios",
  "cap-next": "p1-next",
  "cap-supabase-api": "p2-supabase-api",
  "cap-admin": "p2-admin",
};

const PHASE1_CAP_IDS = ["cap-ios", "cap-next"] as const;
const PHASE2_CAP_IDS = ["cap-supabase-api", "cap-admin"] as const;

function capToPhaseRow(cap: LedgerCapSystem): LedgerPhase1Row {
  return {
    id: CAP_TO_PHASE_ID[cap.id] ?? cap.id,
    label: cap.label,
    status: cap.status,
    valueCents: cap.valueCents,
    valueLabel: cap.valueLabel,
    statusLabel: cap.statusLabel,
    completionFraction: cap.completionFraction,
  };
}

/** Phase tables mirror cap systems so accrued % and status always match. */
export function buildPhaseViews(capSystems: LedgerCapSystem[]): {
  phase1Frontend: LedgerPhase1Row[];
  phase2Backend: LedgerPhase1Row[];
} {
  const byId = new Map(capSystems.map((s) => [s.id, s]));
  const phase1Frontend = PHASE1_CAP_IDS.map((id) => capToPhaseRow(byId.get(id)!));
  const phase2Caps = PHASE2_CAP_IDS.map((id) => capToPhaseRow(byId.get(id)!));
  const phase2Included = LEDGER_SEED.phase2Backend.filter(
    (r) => r.id === "p2-planning" || r.id === "p2-workflows",
  );
  return { phase1Frontend, phase2Backend: [...phase2Caps, ...phase2Included] };
}
