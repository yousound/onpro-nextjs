import { LedgerInvoiceEditor } from "@/components/ledger/ledger-invoice-editor";
import { LedgerPage } from "@/components/ledger/ledger-page";

export default function LedgerNewInvoicePage() {
  return (
    <LedgerPage title="Printable invoice" subtitle="Edit fields, then export PDF to send.">
      <LedgerInvoiceEditor />
    </LedgerPage>
  );
}
