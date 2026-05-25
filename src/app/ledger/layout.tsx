import { LedgerAuthGate } from "@/components/ledger/ledger-auth-gate";
import { LedgerProvider } from "@/components/ledger/ledger-provider";
import { LedgerShell } from "@/components/ledger/ledger-shell";

export const metadata = {
  title: "Development Ledger — OnPro",
  description: "Private founder / partner development ledger.",
};

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  return (
    <LedgerAuthGate>
      <LedgerProvider>
        <LedgerShell>{children}</LedgerShell>
      </LedgerProvider>
    </LedgerAuthGate>
  );
}
