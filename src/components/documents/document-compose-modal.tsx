"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  defaultComposeBody,
  defaultComposeSubject,
  sendProductionDocumentViaMailroom,
  type DocumentMailCategory,
} from "@/lib/documents/document-mail-send";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import { useProjectTeam } from "@/components/vendor-select";
import { contactDisplayName } from "@/lib/contacts-store";
import { useCurrentUser } from "@/components/profile-provider";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-text-secondary";

export function DocumentComposeModal({
  open,
  document,
  category,
  toName,
  toEmail,
  projectId,
  jobId,
  vendorName,
  onClose,
  onSent,
}: {
  open: boolean;
  document: ProductionDocument;
  category: DocumentMailCategory;
  toName: string;
  toEmail: string;
  projectId: number;
  jobId: string;
  vendorName?: string;
  onClose: () => void;
  onSent: (result: {
    threadId: string;
    messageId: string;
    toEmail: string;
    ccEmails: string[];
  }) => void;
}) {
  const { user } = useCurrentUser();
  const team = useProjectTeam();
  const [subject, setSubject] = useState(() => defaultComposeSubject(document));
  const [body, setBody] = useState(() => defaultComposeBody(document));
  const [ccSelected, setCcSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSubject(defaultComposeSubject(document));
    setBody(defaultComposeBody(document));
    setCcSelected(new Set());
    setError(null);
  }, [open, document]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ccEmails = useMemo(
    () =>
      team
        .filter((m) => ccSelected.has(m.id) && m.email?.trim())
        .map((m) => m.email.trim()),
    [team, ccSelected],
  );

  if (!open) return null;

  const fromEmail = user?.email?.trim() || "jerry@connectdots.la";
  const docLabel = document.kind === "vendor_po" ? "purchase order" : "estimate";

  function toggleCc(id: string) {
    setCcSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    const email = toEmail.trim();
    if (!email) {
      setError("Recipient email is required. Add an email on the vendor or client contact.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = sendProductionDocumentViaMailroom({
        document,
        toName,
        toEmail: email,
        ccEmails,
        subject,
        body,
        fromEmail,
        fromName: user?.fullName?.trim() || "Connect Dots",
        projectId,
        jobId,
        category,
        vendorName,
      });
      onSent({ ...result, toEmail: email, ccEmails });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="compose-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col rounded-2xl border border-border-light bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border-light px-5 py-4">
          <h2 id="compose-title" className="text-lg font-bold text-text-primary">
            Send {docLabel}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {document.documentNumber} · separate email to this recipient
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className={labelClass}>
            To
            <input className={fieldClass} value={toName ? `${toName} <${toEmail}>` : toEmail} readOnly />
          </label>

          <div>
            <span className={labelClass}>CC team (optional)</span>
            {team.length === 0 ? (
              <p className="mt-1 text-xs text-text-secondary">No team contacts loaded.</p>
            ) : (
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border-light p-2">
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
                        <span className="text-text-secondary">({m.email})</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className={labelClass}>
            Subject
            <input className={fieldClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className={labelClass}>
            Message
            <textarea
              className={`${fieldClass} resize-y`}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          <p className="text-xs text-text-secondary">
            Attaches {docLabel} PDF reference to the Mailroom outbox. Reuses an existing thread with
            this recipient on the same project when one exists.
          </p>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-light px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSend()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send via Mailroom"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MailroomThreadLink({ threadId }: { threadId: string }) {
  return (
    <Link
      href={`/mailroom?thread=${encodeURIComponent(threadId)}`}
      className="text-[10px] font-semibold text-accent hover:underline"
    >
      View in Mailroom
    </Link>
  );
}
