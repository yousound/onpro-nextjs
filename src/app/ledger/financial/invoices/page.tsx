import { LedgerInvoiceList } from "@/components/ledger/ledger-invoice-list";
import { LedgerPage } from "@/components/ledger/ledger-page";

export default function LedgerInvoicesPage() {
  return (
    <LedgerPage title="Invoices">
      <LedgerInvoiceList />
    </LedgerPage>
  );
}
