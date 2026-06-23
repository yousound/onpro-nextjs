"use client";

import { useState } from "react";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { Estimate, EstimateStatus, ProjectJob } from "@/lib/types/wip";
import { costingTotals } from "@/lib/costing-sheet";
import { buildClientEstimateDocument } from "@/lib/documents/production-document-draft";
import { jobsOnSameOrder } from "@/lib/project-estimate-merge";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import { MailroomThreadLink } from "@/components/documents/document-compose-modal";
import { ProductionDocumentModal } from "@/components/documents/production-document-modal";

const STATUS_OPTIONS: EstimateStatus[] = ["draft", "sent", "accepted", "rejected"];

function currency(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusClass: Record<EstimateStatus, string> = {
  draft: "bg-slate-100 text-text-secondary ring-border-light",
  sent: "bg-blue-100 text-blue-800 ring-blue-300/50",
  accepted: "bg-emerald-100 text-emerald-800 ring-emerald-300/50",
  rejected: "bg-red-100 text-red-700 ring-red-300/50",
};

export function EstimatesList({
  project,
  estimates,
  onChange,
  job,
  allJobs,
  clientName,
  clientContact,
  onSent,
}: {
  project: Project;
  estimates: Estimate[];
  onChange: (next: Estimate[]) => void;
  job: ProjectJob;
  allJobs?: ProjectJob[];
  clientName?: string;
  clientContact?: Contact | null;
  onSent?: () => void;
}) {
  const [docDraft, setDocDraft] = useState<ProductionDocument | null>(null);
  const [activeEstimateId, setActiveEstimateId] = useState<string | null>(null);

  if (estimates.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-light bg-slate-50/80 px-4 py-6 text-center text-sm text-text-secondary">
        No estimates generated yet. Build the cost sheet and click <strong>Generate Estimate</strong>.
      </p>
    );
  }

  function patch(id: string, partial: Partial<Estimate>) {
    onChange(estimates.map((e) => (e.id === id ? { ...e, ...partial } : e)));
  }

  function remove(id: string) {
    onChange(estimates.filter((e) => e.id !== id));
  }

  function handleEstimateSent(
    id: string,
    result: { threadId: string; messageId: string; toEmail: string; ccEmails: string[] },
  ) {
    const now = new Date().toISOString();
    patch(id, {
      status: "sent",
      sent_at: now,
      sent_to_email: result.toEmail,
      cc_emails: result.ccEmails.length > 0 ? result.ccEmails : undefined,
      mailroom_thread_id: result.threadId,
      outbound_message_id: result.messageId,
    });
    onSent?.();
  }

  function openEstimateEditor(est: Estimate) {
    setActiveEstimateId(est.id);
    setDocDraft(
      buildClientEstimateDocument({
        project,
        job,
        estimate: est,
        clientName: clientName ?? project.client.name,
        clientContact,
        orderJobs: allJobs ? jobsOnSameOrder(allJobs, job) : undefined,
      }),
    );
  }

  return (
    <>
      <div className="space-y-2">
        {estimates.map((est) => {
          const totals = costingTotals(est.costing_sheet_snapshot);
          return (
            <div
              key={est.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold text-text-primary">
                  {est.document_number}
                </p>
                <p className="text-[11px] text-text-secondary">
                  Created {est.created_at ? new Date(est.created_at).toLocaleDateString() : "—"}
                  {est.sent_at ? ` · Sent ${new Date(est.sent_at).toLocaleDateString()}` : null}
                  {" · "}
                  {est.costing_sheet_snapshot.lines.length} line
                  {est.costing_sheet_snapshot.lines.length === 1 ? "" : "s"}
                </p>
                {est.mailroom_thread_id ? (
                  <MailroomThreadLink threadId={est.mailroom_thread_id} />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-emerald-700">
                  {currency(totals.final_cost_to_quote_client)}
                </span>
                <select
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ring-1 ${statusClass[est.status]}`}
                  value={est.status}
                  onChange={(e) => patch(est.id, { status: e.target.value as EstimateStatus })}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openEstimateEditor(est)}
                  className="whitespace-nowrap rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent/90"
                >
                  {est.status === "draft" ? "Send estimate" : "Resend estimate"}
                </button>
                {est.status === "draft" ? (
                  <button
                    type="button"
                    onClick={() =>
                      patch(est.id, { status: "sent", sent_at: new Date().toISOString() })
                    }
                    className="whitespace-nowrap rounded-lg border border-border-light px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-slate-50"
                  >
                    Mark sent
                  </button>
                ) : null}
                {est.status === "accepted" ? (
                  <button
                    type="button"
                    onClick={() => openEstimateEditor(est)}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Client invoice
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(est.id)}
                  className="rounded-md px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"
                  aria-label="Remove estimate"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {docDraft && activeEstimateId ? (
        <ProductionDocumentModal
          open
          draft={docDraft}
          onClose={() => {
            setDocDraft(null);
            setActiveEstimateId(null);
          }}
          mailroomSend={{
            category: "client",
            projectId: project.id,
            jobId: job.id,
            estimateId: activeEstimateId,
            onSent: (result) => handleEstimateSent(activeEstimateId, result),
          }}
        />
      ) : null}
    </>
  );
}
