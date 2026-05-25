import { MilestonesPage } from "@/components/ledger/milestones-page";
import { LedgerPage } from "@/components/ledger/ledger-page";

export default function LedgerMilestonesPage() {
  return (
    <LedgerPage title="Milestones" subtitle="Toggle complete to update the work-finished bar.">
      <MilestonesPage />
    </LedgerPage>
  );
}
