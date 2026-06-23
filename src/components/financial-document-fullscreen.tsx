"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductionDocumentEditWorkspace } from "@/components/documents/production-document-edit-workspace";
import { ProductionDocumentPreviewFrame } from "@/components/documents/production-document-preview-frame";
import { ProductionDocumentSendPanel } from "@/components/documents/production-document-send-panel";
import { ProductionDocumentSummarySidebar } from "@/components/documents/production-document-summary-sidebar";
import {
  FinancialDocumentWorkspaceSidebar,
  type FinancialDraftListItem,
} from "@/components/financial-document-workspace-sidebar";
import type { DocumentMailCategory } from "@/lib/documents/document-mail-send";
import { exportProductionDocumentPdf } from "@/lib/documents/production-document-print";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import type { FinancialSeedOptions } from "@/lib/project-financials-seed";
import type { ProjectJob } from "@/lib/types/wip";

export type FinancialDocMode = "edit" | "preview" | "send";

export type FinancialDocUiKind = "estimate" | "invoice" | "po" | "vendor_quote";

function uiKindLabel(kind: FinancialDocUiKind): string {
  switch (kind) {
    case "invoice":
      return "Invoice";
    case "po":
      return "Purchase order";
    case "vendor_quote":
      return "Vendor quote";
    default:
      return "Estimate";
  }
}

function screenTitle(uiKind: FinancialDocUiKind): string {
  return `Edit ${uiKindLabel(uiKind).toLowerCase()}`;
}

function normalizeMode(initial: FinancialDocMode | "edit" | "build"): FinancialDocMode {
  if (initial === "build") return "edit";
  return initial === "edit" ? "edit" : initial;
}

export type FinancialWorkspaceConfig = {
  projectLabel: string;
  jobs: ProjectJob[];
  jobPickerMode: "all" | "selected";
  onJobPickerMode: (mode: "all" | "selected") => void;
  selectedJobIds: Set<string>;
  onToggleJob: (jobId: string) => void;
  seedOptions: FinancialSeedOptions;
  onSeedOptionsChange: (options: FinancialSeedOptions) => void;
  onGenerateDrafts: () => void;
  drafts: FinancialDraftListItem[];
  activeDraftId: string;
  onSelectDraft: (id: string) => void;
  onDeleteDraft?: (id: string) => void;
};

export function FinancialDocumentFullscreen({
  open,
  uiKind,
  draft: initialDraft,
  status = "draft",
  initialMode = "preview",
  onClose,
  onSave,
  onStatusChange,
  onDelete,
  mailroomSend,
  workspace,
  jobs = [],
  clientName,
  activeJobId,
  sendJob,
}: {
  open: boolean;
  uiKind: FinancialDocUiKind;
  draft: ProductionDocument;
  status?: string;
  initialMode?: FinancialDocMode | "edit" | "build";
  onClose: () => void;
  onSave: (draft: ProductionDocument) => void;
  onStatusChange?: (status: string) => void;
  onDelete?: () => void;
  mailroomSend?: {
    category: DocumentMailCategory;
    projectId: number;
    jobId: string;
    vendorName?: string;
    vendorQuoteId?: string | null;
    estimateId?: string | null;
    onSent: (result: {
      threadId: string;
      messageId: string;
      toEmail: string;
      ccEmails: string[];
    }) => void;
  };
  workspace?: FinancialWorkspaceConfig;
  jobs?: ProjectJob[];
  clientName?: string;
  activeJobId?: string;
  sendJob?: ProjectJob;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [mode, setMode] = useState<FinancialDocMode>(() => normalizeMode(initialMode));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const resolvedJobs = workspace?.jobs ?? jobs;
  const resolvedJobId = activeJobId ?? mailroomSend?.jobId;
  const resolvedSendJob =
    sendJob ?? resolvedJobs.find((j) => j.id === resolvedJobId) ?? resolvedJobs[0];

  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft);
    setMenuOpen(false);
  }, [open, initialDraft]);

  useEffect(() => {
    if (!open) return;
    setMode(normalizeMode(initialMode));
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const displayStatus = useMemo(() => {
    if (status === "draft") return "Unsent";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }, [status]);

  if (!open) return null;

  const toName = draft.billToName.trim();
  const toEmail = draft.billToEmail.trim();
  const showEmptyWorkspace =
    workspace && workspace.drafts.length === 0 && (mode === "preview" || mode === "edit");
  const showWorkspaceSidebar =
    workspace && (mode === "edit" || showEmptyWorkspace);

  const summarySidebar = (
    <ProductionDocumentSummarySidebar
      draft={draft}
      uiKind={uiKind}
      status={displayStatus}
      onChange={mode === "edit" ? setDraft : undefined}
      readOnly={mode !== "edit"}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-surface-body"
      role="dialog"
      aria-modal
      aria-labelledby="financial-doc-title"
    >
      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
            >
              <span aria-hidden className="text-lg leading-none">
                ←
              </span>
              <span id="financial-doc-title">{screenTitle(uiKind)}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
                aria-label="More actions"
              >
                ···
              </button>
              {menuOpen ? (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {onStatusChange ? (
                    <>
                      <button
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          onStatusChange("accepted");
                          setMenuOpen(false);
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          onStatusChange("rejected");
                          setMenuOpen(false);
                        }}
                      >
                        Decline
                      </button>
                    </>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      onClick={() => {
                        onDelete();
                        setMenuOpen(false);
                      }}
                    >
                      Delete document
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      exportProductionDocumentPdf(draft);
                      setMenuOpen(false);
                    }}
                  >
                    Print / PDF
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
            >
              Save
            </button>
          </div>
        </div>
        <nav className="flex gap-0 border-t border-slate-100 px-4 sm:px-5" aria-label="Document workflow">
          {(["edit", "preview", "send"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold capitalize ${
                mode === m
                  ? "border-accent text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {m}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {showWorkspaceSidebar ? (
          <FinancialDocumentWorkspaceSidebar
            projectLabel={workspace.projectLabel}
            jobs={workspace.jobs}
            jobPickerMode={workspace.jobPickerMode}
            onJobPickerMode={workspace.onJobPickerMode}
            selectedJobIds={workspace.selectedJobIds}
            onToggleJob={workspace.onToggleJob}
            seedOptions={workspace.seedOptions}
            onSeedOptionsChange={workspace.onSeedOptionsChange}
            onGenerateDrafts={workspace.onGenerateDrafts}
            drafts={workspace.drafts}
            activeDraftId={workspace.activeDraftId}
            onSelectDraft={workspace.onSelectDraft}
            onDeleteDraft={workspace.onDeleteDraft}
          />
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:flex-row">
          {showEmptyWorkspace ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-10">
              <p className="text-base font-semibold text-slate-800">Generate drafts to continue</p>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Select jobs and document types in the sidebar, then click <strong>Generate drafts</strong>.
              </p>
            </div>
          ) : mode === "edit" ? (
            <>
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface-body p-4 sm:p-6">
                <ProductionDocumentEditWorkspace
                  draft={draft}
                  onChange={setDraft}
                  jobs={resolvedJobs}
                  activeJobId={resolvedJobId}
                  clientName={clientName}
                />
              </div>
              {summarySidebar}
            </>
          ) : mode === "preview" ? (
            <>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-body p-4 sm:p-6">
                <ProductionDocumentPreviewFrame draft={draft} />
              </div>
              {summarySidebar}
            </>
          ) : (
            <>
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface-body">
                {mailroomSend ? (
                  <ProductionDocumentSendPanel
                    document={draft}
                    category={mailroomSend.category}
                    toName={toName}
                    toEmail={toEmail}
                    projectId={mailroomSend.projectId}
                    jobId={mailroomSend.jobId}
                    job={resolvedSendJob}
                    vendorName={mailroomSend.vendorName}
                    vendorQuoteId={mailroomSend.vendorQuoteId}
                    estimateId={mailroomSend.estimateId}
                    onSent={(result) => {
                      onSave(draft);
                      mailroomSend.onSent(result);
                    }}
                  />
                ) : (
                  <div className="p-10 text-center text-sm text-slate-500">
                    Mailroom send is not available for this document.
                  </div>
                )}
              </div>
              {summarySidebar}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
