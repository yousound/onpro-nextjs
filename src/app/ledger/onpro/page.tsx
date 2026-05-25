import { LedgerPage } from "@/components/ledger/ledger-page";
import { OnProDashboard } from "@/components/ledger/onpro-dashboard";

export default function LedgerOnProPage() {
  return (
    <LedgerPage title="ONPRO — Development Ledger">
      <OnProDashboard />
    </LedgerPage>
  );
}
