"use client";

import { useMemo } from "react";
import { formatUsdDetailed } from "@/lib/ledger/format";
import {
  computeProductionDocumentTotals,
  emptyProductionLine,
} from "@/lib/documents/production-document-draft";
import type {
  ProductionDocument,
  ProductionDocumentLine,
} from "@/lib/documents/production-document-types";
import type { ProjectJob } from "@/lib/types/wip";
import { loadContacts, contactDisplayName } from "@/lib/contacts-store";
import type { Contact } from "@/lib/types/contact";

function sectionHeader(title: string, hint?: string) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
      <h3 className="text-sm font-semibold text-slate-700">
        {title}
        {hint ? <span className="ml-1 font-normal text-slate-500">{hint}</span> : null}
      </h3>
    </div>
  );
}

function updateLine(
  lines: ProductionDocumentLine[],
  id: string,
  patch: Partial<ProductionDocumentLine>,
): ProductionDocumentLine[] {
  return lines.map((line) => (line.id === id ? { ...line, ...patch } : line));
}

function applyJobToDraft(draft: ProductionDocument, job: ProjectJob): ProductionDocument {
  return {
    ...draft,
    jobNumber: job.job_number?.trim() || job.id,
    projectName: draft.projectName || job.name?.trim() || "",
    referenceNotes: job.name?.trim() || draft.referenceNotes,
  };
}

function applyContactToDraft(
  draft: ProductionDocument,
  contact: Contact,
  forVendor: boolean,
): ProductionDocument {
  const addr = contact.billing_address ?? contact.shipping_address;
  const line1 = addr?.line1?.trim() ?? "";
  const line2 = [addr?.city, addr?.state, addr?.postal_code].filter(Boolean).join(", ");
  return {
    ...draft,
    billToName: contactDisplayName(contact),
    billToEmail: contact.email?.trim() ?? draft.billToEmail,
    billToAddress1: line1 || draft.billToAddress1,
    billToAddress2: line2 || draft.billToAddress2,
    ...(forVendor && draft.kind === "vendor_po"
      ? {}
      : {}),
  };
}

export function ProductionDocumentEditWorkspace({
  draft,
  onChange,
  jobs,
  activeJobId,
  clientName,
}: {
  draft: ProductionDocument;
  onChange: (draft: ProductionDocument) => void;
  jobs: ProjectJob[];
  activeJobId?: string;
  clientName?: string;
}) {
  const totals = computeProductionDocumentTotals(draft);
  const forVendor = draft.kind === "vendor_po";

  const partyOptions = useMemo(() => {
    const contacts = loadContacts();
    if (forVendor) {
      return contacts.filter((c) => c.segment === "vendor");
    }
    return contacts.filter((c) => c.segment === "client");
  }, [forVendor]);

  const visibleLines = draft.lines.length > 0 ? draft.lines : [emptyProductionLine()];
  const lineCount = draft.lines.filter((l) => l.description.trim() || l.rate.trim()).length;

  function patch(fields: Partial<ProductionDocument>) {
    onChange({ ...draft, ...fields });
  }

  function patchLines(lines: ProductionDocumentLine[]) {
    patch({ lines });
  }

  function patchLine(id: string, linePatch: Partial<ProductionDocumentLine>) {
    const base = draft.lines.length > 0 ? draft.lines : [emptyProductionLine()];
    patchLines(updateLine(base, id, linePatch));
  }

  function onJobChange(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    onChange(applyJobToDraft(draft, job));
  }

  function onPartySelect(contactId: string) {
    if (!contactId) return;
    const contact = partyOptions.find((c) => String(c.id) === contactId);
    if (!contact) return;
    onChange(applyContactToDraft(draft, contact, forVendor));
  }

  const selectedJobId = activeJobId ?? jobs.find((j) => j.job_number === draft.jobNumber)?.id ?? jobs[0]?.id ?? "";

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {sectionHeader(forVendor ? "Vendor" : "Client")}
        <div className="space-y-4 p-4">
          {partyOptions.length > 0 ? (
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-500">
                {forVendor ? "Select vendor" : "Select client"}
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value=""
                onChange={(e) => onPartySelect(e.target.value)}
              >
                <option value="">{forVendor ? "Choose vendor…" : "Choose client…"}</option>
                {partyOptions.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {contactDisplayName(c)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">Name</span>
              <input
                className="mt-1 w-full border-0 border-b border-slate-300 bg-transparent py-1.5 text-sm font-semibold outline-none focus:border-accent"
                value={draft.billToName}
                onChange={(e) => patch({ billToName: e.target.value })}
                placeholder={clientName || (forVendor ? "Vendor name" : "Client name")}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">Email</span>
              <input
                className="mt-1 w-full border-0 border-b border-slate-300 bg-transparent py-1.5 text-sm outline-none focus:border-accent"
                value={draft.billToEmail}
                onChange={(e) => patch({ billToEmail: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">Bill to</span>
              <textarea
                rows={2}
                className="mt-1 w-full resize-y border-0 border-b border-slate-300 bg-transparent py-1.5 text-sm outline-none focus:border-accent"
                value={[draft.billToAddress1, draft.billToAddress2].filter(Boolean).join("\n")}
                onChange={(e) => {
                  const [a1, ...rest] = e.target.value.split("\n");
                  patch({ billToAddress1: a1 ?? "", billToAddress2: rest.join("\n") });
                }}
              />
            </label>
          </div>
          {jobs.length > 0 ? (
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-500">Project job</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={selectedJobId}
                onChange={(e) => onJobChange(e.target.value)}
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.job_number ? `${j.job_number} — ` : ""}
                    {j.name?.trim() || "Untitled job"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {sectionHeader("Items", lineCount > 0 ? `— ${lineCount} added` : undefined)}
        <div className="divide-y divide-slate-100">
          {visibleLines.map((line, index) => {
            const amountCents = totals.lineAmountsCents[index] ?? 0;
            return (
              <div key={line.id} className="flex gap-3 p-4">
                <span className="mt-1 cursor-grab text-slate-300" aria-hidden>
                  ⋮⋮
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className="w-full border-0 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                    value={line.description}
                    onChange={(e) => patchLine(line.id, { description: e.target.value })}
                    placeholder="Description"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                    <label className="flex items-center gap-1">
                      Qty
                      <input
                        className="w-14 border-0 border-b border-slate-200 bg-transparent text-center outline-none focus:border-accent"
                        value={line.quantity}
                        onChange={(e) => patchLine(line.id, { quantity: e.target.value })}
                      />
                    </label>
                    <span>×</span>
                    <label className="flex items-center gap-1">
                      Rate
                      <input
                        className="w-24 border-0 border-b border-slate-200 bg-transparent outline-none focus:border-accent"
                        value={line.rate}
                        onChange={(e) => patchLine(line.id, { rate: e.target.value })}
                        placeholder="0.00"
                      />
                    </label>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-slate-900">
                    {formatUsdDetailed(amountCents)}
                  </p>
                  {visibleLines.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => patchLines(visibleLines.filter((l) => l.id !== line.id))}
                      className="mt-1 text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => patchLines([...visibleLines, emptyProductionLine()])}
            className="text-sm font-semibold text-accent hover:underline"
          >
            + Add line item
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {sectionHeader("Comments and notes")}
        <div className="p-4">
          <textarea
            rows={4}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
            value={draft.memoNotes}
            onChange={(e) => patch({ memoNotes: e.target.value })}
            placeholder="Thank you for your business."
          />
          <label className="mt-4 block text-sm">
            <span className="text-xs font-medium text-slate-500">Terms and conditions</span>
            <textarea
              rows={3}
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20"
              value={draft.termsAndConditions}
              onChange={(e) => patch({ termsAndConditions: e.target.value })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
