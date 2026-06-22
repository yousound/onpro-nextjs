"use client";

import { useEffect, useState } from "react";
import { DocumentComposeModal } from "@/components/documents/document-compose-modal";
import { ProductionDocumentEditor } from "@/components/documents/production-document-editor";
import type { DocumentMailCategory } from "@/lib/documents/document-mail-send";
import { exportProductionDocumentPdf } from "@/lib/documents/production-document-print";
import type { ProductionDocument } from "@/lib/documents/production-document-types";

export type MailroomSendContext = {
  category: DocumentMailCategory;
  projectId: number;
  jobId: string;
  vendorName?: string;
  onSent: (result: {
    threadId: string;
    messageId: string;
    toEmail: string;
    ccEmails: string[];
  }) => void;
};

export function ProductionDocumentModal({
  open,
  draft: initialDraft,
  onClose,
  onPrint,
  mailroomSend,
}: {
  open: boolean;
  draft: ProductionDocument;
  onClose: () => void;
  onPrint?: (draft: ProductionDocument) => void;
  mailroomSend?: MailroomSendContext;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft);
    setComposeOpen(false);
  }, [open, initialDraft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !composeOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, composeOpen]);

  if (!open) return null;

  const toName = draft.billToName.trim();
  const toEmail = draft.billToEmail.trim();

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex flex-col bg-slate-100"
        role="dialog"
        aria-modal
        aria-labelledby="production-doc-title"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-light bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 id="production-doc-title" className="text-lg font-bold text-text-primary">
              {draft.kind === "vendor_po" ? "Vendor purchase order" : "Client estimate"}
            </h2>
            <p className="text-sm text-text-secondary">{draft.documentNumber || "Draft"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mailroomSend ? (
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="whitespace-nowrap rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
              >
                Send via Mailroom
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                onPrint?.(draft);
                exportProductionDocumentPdf(draft);
              }}
              className="whitespace-nowrap rounded-lg border border-accent/40 bg-white px-4 py-2 text-sm font-semibold text-accent hover:bg-violet-50"
            >
              Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="whitespace-nowrap rounded-lg border border-border-light px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <ProductionDocumentEditor
              key={`${draft.kind}-${draft.documentNumber}`}
              initialDraft={draft}
              onDraftChange={setDraft}
              onPrint={onPrint}
              hideToolbar
            />
          </div>
        </div>
      </div>

      {mailroomSend && composeOpen ? (
        <DocumentComposeModal
          open
          document={draft}
          category={mailroomSend.category}
          toName={toName}
          toEmail={toEmail}
          projectId={mailroomSend.projectId}
          jobId={mailroomSend.jobId}
          vendorName={mailroomSend.vendorName}
          onClose={() => setComposeOpen(false)}
          onSent={mailroomSend.onSent}
        />
      ) : null}
    </>
  );
}
