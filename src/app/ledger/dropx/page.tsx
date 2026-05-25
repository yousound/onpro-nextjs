import { DropxPage } from "@/components/ledger/dropx-page";
import { LedgerPage } from "@/components/ledger/ledger-page";

export default function LedgerDropxPage() {
  return (
    <LedgerPage title="DROPX" subtitle="Founder venture — separate from OnPro payable balance.">
      <DropxPage />
    </LedgerPage>
  );
}
