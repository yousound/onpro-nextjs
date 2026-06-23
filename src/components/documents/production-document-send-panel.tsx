"use client";

import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { useEffect, useMemo, useState } from "react";
import {
  defaultComposeSubject,
  sendProductionDocumentViaMailroom,
  type DocumentMailCategory,
} from "@/lib/documents/document-mail-send";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import { useProjectTeam } from "@/components/vendor-select";
import { contactDisplayName } from "@/lib/contacts-store";
import { useCurrentUser } from "@/components/profile-provider";
import { VendorQuoteAttachmentPicker } from "@/components/documents/vendor-quote-attachment-picker";
import { loadAllWorkspaceDocuments } from "@/lib/documents/project-documents";
import {
  buildVendorQuoteEmailBody,
  buildVendorQuoteHtmlBody,
  filterJobDocuments,
} from "@/lib/documents/vendor-quote-compose";
import type { ProjectJob } from "@/lib/types/wip";
import type { DocumentRow } from "@/lib/types/documents";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export function ProductionDocumentSendPanel({
  document,
  category,
  toName,
  toEmail,
  projectId,
  jobId,
  job,
  vendorName,
  vendorQuoteId,
  estimateId,
  onSent,
}: {
  document: ProductionDocument;
  category: DocumentMailCategory;
  toName: string;
  toEmail: string;
  projectId: number;
  jobId: string;
  job?: ProjectJob;
  vendorName?: string;
  vendorQuoteId?: string | null;
  estimateId?: string | null;
  onSent: (result: {
    threadId: string;
    messageId: string;
    toEmail: string;
    ccEmails: string[];
  }) => void;
}) {
  const { user } = useCurrentUser();
  const team = useProjectTeam();
  const isVendorQuote =
    category === "vendor_quote" || document.kind === "vendor_quote" || document.kind === "vendor_po";

  const [subject, setSubject] = useState(() => defaultComposeSubject(document));
  const [body, setBody] = useState(() => {
    if (isVendorQuote && job) {
      return buildVendorQuoteEmailBody([job], { document });
    }
    return defaultComposeBodyFallback(document);
  });
  const [ccSelected, setCcSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allDocs, setAllDocs] = useState<DocumentRow[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [includeQuoteDocument, setIncludeQuoteDocument] = useState(true);

  const jobDocs = useMemo(
    () => (isVendorQuote ? filterJobDocuments(allDocs, projectId, jobId) : []),
    [allDocs, projectId, jobId, isVendorQuote],
  );

  useEffect(() => {
    let cancelled = false;
    void loadAllWorkspaceDocuments().then((docs) => {
      if (!cancelled) setAllDocs(docs);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, jobId]);

  useEffect(() => {
    if (jobDocs.length === 0) return;
    setSelectedDocIds(new Set(jobDocs.map((d) => d.id)));
  }, [jobDocs]);

  useEffect(() => {
    setSubject(defaultComposeSubject(document));
    if (isVendorQuote && job) {
      setBody(buildVendorQuoteEmailBody([job], { document }));
    } else {
      setBody(defaultComposeBodyFallback(document));
    }
    setCcSelected(new Set());
    setError(null);
  }, [document, job, isVendorQuote]);

  const ccEmails = useMemo(
    () =>
      team
        .filter((m) => ccSelected.has(m.id) && m.email?.trim())
        .map((m) => m.email.trim()),
    [team, ccSelected],
  );

  const fromEmail = user?.email?.trim() || "jerry@connectdots.la";

  function toggleCc(id: string) {
    setCcSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const htmlBody = useMemo(() => {
    if (!isVendorQuote || !job) return undefined;
    return buildVendorQuoteHtmlBody([job]);
  }, [isVendorQuote, job]);

  async function handleSend() {
    const email = toEmail.trim();
    if (!email) {
      setError("Recipient email is required.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const libraryDocuments = jobDocs.filter((d) => selectedDocIds.has(d.id));
      const result = await sendProductionDocumentViaMailroom({
        document,
        toName,
        toEmail: email,
        ccEmails,
        subject,
        body,
        htmlBody,
        fromEmail,
        fromName: user?.fullName?.trim() || "Connect Dots",
        projectId,
        jobId,
        category,
        vendorName,
        libraryDocuments: isVendorQuote ? libraryDocuments : undefined,
        attachQuoteDocument: isVendorQuote ? includeQuoteDocument : true,
        vendorQuoteId,
        estimateId,
      });
      onSent({ ...result, toEmail: email, ccEmails });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 p-5">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</span>
            <input
              className={fieldClass}
              readOnly
              value={toName ? `${toName} <${toEmail}>` : toEmail || "Add recipient email in Edit tab"}
            />
          </label>

          {team.length > 0 ? (
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Cc team
              </span>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {team.map((m) => (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={ccSelected.has(m.id)}
                        onChange={() => toggleCc(m.id)}
                      />
                      <span className="min-w-0 truncate">
                        {contactDisplayName(m)}{" "}
                        <span className="text-slate-500">({m.email})</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span>
            <input className={fieldClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</span>
            <textarea
              className={`${fieldClass} resize-y`}
              rows={isVendorQuote ? 14 : 8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          {isVendorQuote ? (
            <VendorQuoteAttachmentPicker
              documents={jobDocs}
              selectedIds={selectedDocIds}
              onChangeSelected={setSelectedDocIds}
              includeQuoteDocument={includeQuoteDocument}
              onIncludeQuoteDocument={setIncludeQuoteDocument}
            />
          ) : null}

          <p className="text-xs text-slate-500">
            {isClientLiveBackend()
              ? "Sends via your connected Gmail with file attachments from project documents. Reuses an existing thread with this recipient when one exists on the project."
              : "Sends to Mailroom outbox with file attachments. Reuses an existing thread with this recipient when one exists on the project."}
          </p>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={sending || !toEmail.trim()}
            onClick={() => void handleSend()}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send via Mailroom"}
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultComposeBodyFallback(document: ProductionDocument): string {
  if (document.kind === "vendor_po") {
    return `Hi,\n\nPlease find the attached purchase order ${document.documentNumber}.\n\nThank you,\nConnect Dots`;
  }
  if (document.kind === "vendor_quote") {
    return `Hi,\n\nPlease review the attached quote request ${document.documentNumber} and send your pricing at your earliest convenience.\n\nThank you,\nConnect Dots`;
  }
  return `Hi,\n\nPlease find attached estimate ${document.documentNumber} for your review.\n\nThank you,\nConnect Dots`;
}
