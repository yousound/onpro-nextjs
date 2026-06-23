"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultCombinedVendorQuoteSubject,
  sendCombinedVendorQuoteViaMailroom,
} from "@/lib/documents/document-mail-send";
import {
  buildVendorQuoteEmailBody,
  buildVendorQuoteHtmlBody,
  filterJobsDocuments,
} from "@/lib/documents/vendor-quote-compose";
import { buildVendorQuoteDocument } from "@/lib/documents/production-document-draft";
import { VendorQuoteAttachmentPicker } from "@/components/documents/vendor-quote-attachment-picker";
import { loadAllWorkspaceDocuments } from "@/lib/documents/project-documents";
import { loadContacts } from "@/lib/contacts-store";
import { useCurrentUser } from "@/components/profile-provider";
import type { Project } from "@/lib/types/project";
import type { ProjectJob, VendorQuote } from "@/lib/types/wip";
import type { DocumentRow } from "@/lib/types/documents";

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent focus:ring-1 focus:ring-accent/20";

export function CombinedVendorQuoteSendPanel({
  project,
  jobs,
  vendorName,
  quotesByJobId,
  onClose,
  onSent,
}: {
  project: Project;
  jobs: ProjectJob[];
  vendorName: string;
  quotesByJobId: Map<string, VendorQuote>;
  onClose: () => void;
  onSent: (result: {
    threadId: string;
    messageId: string;
    toEmail: string;
    ccEmails: string[];
  }) => void;
}) {
  const { user } = useCurrentUser();
  const contacts = loadContacts();
  const vendorContact = contacts.find(
    (c) => c.name.trim().toLowerCase() === vendorName.trim().toLowerCase(),
  );
  const toEmail = vendorContact?.email?.trim() ?? "";
  const toName = vendorContact?.name?.trim() || vendorName;

  const quoteNotesByJobId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [jobId, quote] of quotesByJobId) {
      if (quote.notes?.trim()) map.set(jobId, quote.notes.trim());
    }
    return map;
  }, [quotesByJobId]);

  const [subject, setSubject] = useState(() => defaultCombinedVendorQuoteSubject(jobs));
  const [body, setBody] = useState(() =>
    buildVendorQuoteEmailBody(jobs, { quoteNotesByJobId }),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allDocs, setAllDocs] = useState<DocumentRow[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());
  const [includeQuoteDocuments, setIncludeQuoteDocuments] = useState(false);

  const jobIds = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const jobDocs = useMemo(
    () => filterJobsDocuments(allDocs, project.id, jobIds),
    [allDocs, project.id, jobIds],
  );

  useEffect(() => {
    let cancelled = false;
    void loadAllWorkspaceDocuments().then((docs) => {
      if (!cancelled) setAllDocs(docs);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id, jobIds.join(",")]);

  useEffect(() => {
    if (jobDocs.length === 0) return;
    setSelectedDocIds(new Set(jobDocs.map((d) => d.id)));
  }, [jobDocs]);

  const htmlBody = useMemo(
    () => buildVendorQuoteHtmlBody(jobs, { quoteNotesByJobId }),
    [jobs, quoteNotesByJobId],
  );

  async function handleSend() {
    const email = toEmail.trim();
    if (!email) {
      setError(`Add an email for ${vendorName} in Contacts.`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const libraryDocuments = jobDocs.filter((d) => selectedDocIds.has(d.id));
      const quoteDocuments = includeQuoteDocuments
        ? jobs
            .map((job) => {
              const quote = quotesByJobId.get(job.id);
              if (!quote) return null;
              return buildVendorQuoteDocument({ project, job, quote, vendorContact });
            })
            .filter((d): d is NonNullable<typeof d> => d != null)
        : [];

      const result = await sendCombinedVendorQuoteViaMailroom({
        jobs,
        toName,
        toEmail: email,
        subject,
        body,
        htmlBody,
        fromEmail: user?.email?.trim() || "jerry@connectdots.la",
        fromName: user?.fullName?.trim() || "Connect Dots",
        projectId: project.id,
        vendorName,
        libraryDocuments,
        quoteDocuments,
      });
      onSent({ ...result, toEmail: email, ccEmails: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border-light px-5 py-4">
          <h2 className="text-lg font-bold text-text-primary">Send combined vendor quote</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {jobs.length} job{jobs.length === 1 ? "" : "s"} → {vendorName}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</span>
            <input
              className={fieldClass}
              readOnly
              value={toEmail ? `${toName} <${toEmail}>` : `${vendorName} — add email in Contacts`}
            />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</span>
            <input className={fieldClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Message</span>
            <textarea
              className={`${fieldClass} resize-y font-mono text-[13px]`}
              rows={16}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          <VendorQuoteAttachmentPicker
            documents={jobDocs}
            selectedIds={selectedDocIds}
            onChangeSelected={setSelectedDocIds}
            includeQuoteDocument={includeQuoteDocuments}
            onIncludeQuoteDocument={setIncludeQuoteDocuments}
            quoteDocumentLabel="Attach per-job quote references (HTML)"
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border-light px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sending || !toEmail.trim()}
            onClick={() => void handleSend()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send via Mailroom"}
          </button>
        </div>

        {error ? (
          <p className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>
        ) : null}
      </div>
    </div>
  );
}
