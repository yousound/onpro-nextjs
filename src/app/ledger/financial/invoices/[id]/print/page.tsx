import { LedgerInvoiceEditor } from "@/components/ledger/ledger-invoice-editor";
import { LedgerPage } from "@/components/ledger/ledger-page";

export default async function LedgerInvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <LedgerPage title="Printable invoice" subtitle="Pre-filled from ledger invoice — edit and export PDF.">
      <LedgerInvoiceEditor sourceInvoiceId={id} />
    </LedgerPage>
  );
}
