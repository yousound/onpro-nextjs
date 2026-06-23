"use client";

import { useEffect, useMemo, useState } from "react";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { ProjectJob, VendorQuote } from "@/lib/types/wip";
import { projectPoNumber } from "@/lib/po-number";
import { buildVendorQuoteRequests } from "@/lib/vendor-po-number";
import { VendorFieldSelect } from "@/components/vendor-select";

type Step = "jobs" | "vendors" | "confirm";

const panelClass =
  "w-full max-w-lg rounded-2xl border border-border-light bg-white shadow-xl";

export function RequestVendorQuotesModal({
  project,
  jobs,
  vendors,
  onClose,
  onSend,
}: {
  project: Project;
  jobs: ProjectJob[];
  vendors: Contact[];
  onClose: () => void;
  onSend: (updates: Map<string, VendorQuote[]>, options?: { combinedSend?: boolean }) => void;
}) {
  const [step, setStep] = useState<Step>("jobs");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [vendorDraft, setVendorDraft] = useState("");
  const [combinedSend, setCombinedSend] = useState(true);

  const projectNumber = projectPoNumber(project);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const preview = useMemo(() => {
    if (!projectNumber || selectedJobIds.size === 0 || selectedVendors.length === 0) {
      return [];
    }
    const updates = buildVendorQuoteRequests(
      project,
      jobs,
      [...selectedJobIds],
      selectedVendors,
    );
    const rows: { job: ProjectJob; vendor: string; po: string }[] = [];
    for (const [jobId, quotes] of updates) {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) continue;
      for (const q of quotes) {
        rows.push({ job, vendor: q.vendor, po: q.po_number ?? "" });
      }
    }
    return rows;
  }, [project, jobs, projectNumber, selectedJobIds, selectedVendors]);

  function toggleJob(id: string) {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addVendor(name: string | null) {
    const v = name?.trim();
    if (!v || selectedVendors.includes(v)) return;
    setSelectedVendors((prev) => [...prev, v]);
    setVendorDraft("");
  }

  function removeVendor(name: string) {
    setSelectedVendors((prev) => prev.filter((v) => v !== name));
  }

  function handleSend() {
    if (!projectNumber) return;
    const updates = buildVendorQuoteRequests(
      project,
      jobs,
      [...selectedJobIds],
      selectedVendors,
    );
    onSend(updates, {
      combinedSend: selectedVendors.length === 1 && combinedSend && selectedJobIds.size > 1,
    });
  }

  const canNextJobs = selectedJobIds.size > 0;
  const canNextVendors = selectedVendors.length > 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="request-quotes-title"
      onClick={onClose}
    >
      <div className={panelClass} onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-border-light px-5 py-4">
          <h2 id="request-quotes-title" className="text-lg font-bold text-text-primary">
            Request vendor quotes
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Project {projectNumber ?? "—"} · each vendor gets a unique PO
          </p>
        </div>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-5 py-4">
          {!projectNumber ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Add a project number before sending vendor quotes.
            </p>
          ) : null}

          {step === "jobs" ? (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">Select jobs to quote:</p>
              {jobs.length === 0 ? (
                <p className="text-sm text-text-secondary">No jobs on this project yet.</p>
              ) : (
                jobs.map((j) => {
                  const checked = selectedJobIds.has(j.id);
                  return (
                    <label
                      key={j.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 ${
                        checked ? "border-accent/50 bg-violet-50/50" : "border-border-light"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={() => toggleJob(j.id)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-text-primary">
                          {j.name?.trim() || "Untitled job"}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {j.job_number ?? "No job number"}
                          {j.style_number ? ` · ${j.style_number}` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          ) : null}

          {step === "vendors" ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">Select vendors to send to:</p>
              <VendorFieldSelect
                label="Add vendor"
                vendors={vendors}
                value={vendorDraft || null}
                onChange={addVendor}
              />
              {selectedVendors.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {selectedVendors.map((v) => (
                    <li
                      key={v}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-text-primary"
                    >
                      {v}
                      <button
                        type="button"
                        className="text-red-600 hover:bg-red-50 rounded px-1"
                        onClick={() => removeVendor(v)}
                        aria-label={`Remove ${v}`}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-text-secondary">Pick one or more vendors above.</p>
              )}
            </div>
          ) : null}

          {step === "confirm" ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                {preview.length} quote request{preview.length === 1 ? "" : "s"} will be created.
                {selectedVendors.length === 1 && selectedJobIds.size > 1 ? (
                  <> You can send one combined email to {selectedVendors[0]} with all styles.</>
                ) : (
                  <> Open each job to preview and send — one separate email per vendor.</>
                )}
              </p>
              {selectedVendors.length === 1 && selectedJobIds.size > 1 ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={combinedSend}
                    onChange={(e) => setCombinedSend(e.target.checked)}
                  />
                  <span className="text-sm text-text-primary">
                    <span className="font-semibold">Send as one combined email</span>
                    <span className="mt-0.5 block text-text-secondary">
                      One message to {selectedVendors[0]} with all job specs and art attachments.
                    </span>
                  </span>
                </label>
              ) : null}
              <ul className="space-y-2 text-sm">
                {preview.map((row, i) => (
                  <li
                    key={`${row.job.id}-${row.vendor}-${i}`}
                    className="rounded-lg border border-border-light px-3 py-2"
                  >
                    <span className="font-mono font-semibold text-accent">{row.po}</span>
                    <span className="text-text-secondary">
                      {" "}
                      · {row.job.job_number ?? row.job.name} → {row.vendor}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
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
          <div className="flex flex-wrap gap-2">
            {step !== "jobs" ? (
              <button
                type="button"
                onClick={() => setStep(step === "confirm" ? "vendors" : "jobs")}
                className="rounded-lg border border-border-light px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-slate-50"
              >
                Back
              </button>
            ) : null}
            {step === "jobs" ? (
              <button
                type="button"
                disabled={!canNextJobs || !projectNumber}
                onClick={() => setStep("vendors")}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Next: Vendors
              </button>
            ) : null}
            {step === "vendors" ? (
              <button
                type="button"
                disabled={!canNextVendors}
                onClick={() => setStep("confirm")}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Review
              </button>
            ) : null}
            {step === "confirm" ? (
              <button
                type="button"
                disabled={preview.length === 0}
                onClick={handleSend}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create quote requests
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
