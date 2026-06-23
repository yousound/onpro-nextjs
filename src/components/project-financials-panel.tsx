"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "@/lib/types/project";
import type { Estimate, EstimateStatus, ProjectJob, VendorQuote } from "@/lib/types/wip";
import {
  FinancialDocumentFullscreen,
  type FinancialDocMode,
  type FinancialDocUiKind,
  type FinancialWorkspaceConfig,
} from "@/components/financial-document-fullscreen";
import type { FinancialDraftListItem } from "@/components/financial-document-workspace-sidebar";
import {
  buildClientEstimateDocument,
  buildJobPreviewEstimateDocument,
  buildVendorPoDocument,
  buildVendorQuoteDocument,
  computeProductionDocumentTotals,
} from "@/lib/documents/production-document-draft";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import { costingTotals } from "@/lib/costing-sheet";
import { formatUsdDetailed } from "@/lib/ledger/format";
import { loadContacts } from "@/lib/contacts-store";
import { findClientContactForProject } from "@/lib/project-people";
import {
  countPendingFinancialSeeds,
  DEFAULT_FINANCIAL_SEED_OPTIONS,
  seedFinancialDocumentsForJobs,
  type FinancialSeedOptions,
} from "@/lib/project-financials-seed";
import {
  consolidateDuplicateProjectEstimates,
  jobsOnSameOrder,
  refreshProjectEstimateSnapshot,
} from "@/lib/project-estimate-merge";
import { projectPoNumber } from "@/lib/po-number";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";
import { dispatchAppToast } from "@/lib/onpro-events";
import type { FinancialsDeepLink } from "@/lib/project-financials-nav";

type ListFilter = "all" | "estimates" | "invoices" | "pos" | "vendor_quotes";

type FinancialListItem = {
  id: string;
  filterKind: ListFilter;
  uiKind: FinancialDocUiKind;
  jobId: string;
  jobNumber: string;
  jobLabel: string;
  documentNumber: string;
  counterparty: string;
  status: string;
  totalCents: number;
  date: string;
  estimateId?: string;
  quoteId?: string;
};

type WorkspaceDraftEntry = {
  id: string;
  draft: ProductionDocument;
  uiKind: FinancialDocUiKind;
  jobId: string;
  estimateId?: string;
  quoteId?: string;
  status: string;
  isNew: boolean;
};

type WorkspaceState = {
  jobPickerMode: "all" | "selected";
  selectedJobIds: Set<string>;
  seedOptions: FinancialSeedOptions;
  entries: WorkspaceDraftEntry[];
  activeId: string;
  mode: FinancialDocMode | "edit";
};

function filterLabel(f: ListFilter): string {
  if (f === "pos") return "POs";
  if (f === "vendor_quotes") return "Vendor quotes";
  return f.charAt(0).toUpperCase() + f.slice(1);
}

function uiKindFromFilter(f: ListFilter): FinancialDocUiKind {
  if (f === "invoices") return "invoice";
  if (f === "pos") return "po";
  if (f === "vendor_quotes") return "vendor_quote";
  return "estimate";
}

function displayStatus(item: FinancialListItem): string {
  if (item.uiKind === "invoice" && (item.status === "sent" || item.status === "accepted")) return "Sent";
  if (item.uiKind === "po" && item.status === "received") return "Paid";
  if (item.status === "accepted") return "Approved";
  if (item.status === "draft") return "Draft";
  if (item.status === "sent") return "Sent";
  if (item.status === "rejected") return "Declined";
  if (item.status === "received") return "Received";
  return item.status.charAt(0).toUpperCase() + item.status.slice(1);
}

function statusBadgeClass(item: FinancialListItem): string {
  const label = displayStatus(item);
  switch (label) {
    case "Sent":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "Paid":
    case "Approved":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "Declined":
      return "bg-red-50 text-red-700 ring-red-200";
    case "Received":
      return "bg-violet-50 text-violet-800 ring-violet-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function docTypeLabel(kind: FinancialDocUiKind): string {
  if (kind === "po") return "PO";
  if (kind === "vendor_quote") return "Vendor quote";
  if (kind === "invoice") return "Invoice";
  return "Estimate";
}

function docTypeIconClass(kind: FinancialDocUiKind): string {
  switch (kind) {
    case "invoice":
      return "bg-blue-100 text-blue-700";
    case "po":
      return "bg-emerald-100 text-emerald-700";
    case "vendor_quote":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-violet-100 text-violet-700";
  }
}

function DocTypeIcon({ kind }: { kind: FinancialDocUiKind }) {
  const paths: Record<FinancialDocUiKind, string> = {
    estimate:
      "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5M9 12h6M9 16h4",
    invoice:
      "M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm7 0v5h5M9 12h6M9 16h6",
    po: "M4 7h16M4 12h16M4 17h10",
    vendor_quote:
      "M12 3l8 4v10l-8 4-8-4V7l8-4zM12 7v10M4 9l8 4 8-4",
  };
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${docTypeIconClass(kind)}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d={paths[kind]} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function summaryBucket(item: FinancialListItem): "draft" | "sent" | "paid" {
  const label = displayStatus(item);
  if (label === "Draft") return "draft";
  if (label === "Sent" || label === "Received") return "sent";
  if (label === "Paid" || label === "Approved") return "paid";
  return "draft";
}

function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function buildEstimateDocument(
  project: Project,
  job: ProjectJob,
  estimate?: Estimate,
  allJobs?: ProjectJob[],
): ProductionDocument {
  const contacts = loadContacts();
  const clientContact = findClientContactForProject(contacts, project.client);
  const clientName = project.client.name;
  const orderJobs = allJobs ? jobsOnSameOrder(allJobs, job) : undefined;
  if (estimate) {
    return buildClientEstimateDocument({
      project,
      job,
      estimate,
      clientName,
      clientContact,
      orderJobs,
    });
  }
  return buildJobPreviewEstimateDocument({ project, job, clientName, clientContact });
}

function buildQuoteDocument(
  project: Project,
  job: ProjectJob,
  quote?: VendorQuote,
  uiKind?: FinancialDocUiKind,
): ProductionDocument {
  const contacts = loadContacts();
  const vendorContact = quote
    ? contacts.find((c) => c.name.trim().toLowerCase() === quote.vendor?.trim().toLowerCase())
    : null;
  const isPo =
    uiKind === "po" || Boolean(quote?.po_number?.trim());
  const build = isPo ? buildVendorPoDocument : buildVendorQuoteDocument;
  if (quote) {
    return build({ project, job, quote, vendorContact });
  }
  return build({
    project,
    job,
    quote: {
      id: `vq-new-${Date.now().toString(36)}`,
      vendor: job.lead_vendor ?? "",
      item_description: job.name?.trim() || "Line item",
      qty: 1,
      unit_cost: 0,
      received_at: null,
      status: "draft",
      po_number: isPo ? `PO-${job.job_number?.trim() || job.id}` : null,
    },
    vendorContact: null,
  });
}

function itemToDraftEntry(
  project: Project,
  jobs: ProjectJob[],
  item: FinancialListItem,
): WorkspaceDraftEntry | null {
  const job = jobs.find((j) => j.id === item.jobId);
  if (!job) return null;
  let draft: ProductionDocument;
  if (item.estimateId) {
    const est = job.estimates?.find((e) => e.id === item.estimateId);
    draft = buildEstimateDocument(project, job, est, jobs);
    if (item.uiKind === "invoice" && est) {
      draft = { ...draft, documentNumber: est.document_number.replace(/^EST-/, "INV-") };
    }
  } else {
    const quote = job.vendor_quotes?.find((q) => q.id === item.quoteId);
    draft = buildQuoteDocument(project, job, quote, item.uiKind);
  }
  return {
    id: item.id,
    draft,
    uiKind: item.uiKind,
    jobId: item.jobId,
    estimateId: item.estimateId,
    quoteId: item.quoteId,
    status: item.status,
    isNew: false,
  };
}

function collectWorkspaceEntries(
  project: Project,
  jobs: ProjectJob[],
  jobIds: Set<string>,
): WorkspaceDraftEntry[] {
  return collectItems(jobs, project)
    .filter((item) => jobIds.has(item.jobId))
    .map((item) => itemToDraftEntry(project, jobs, item))
    .filter((e): e is WorkspaceDraftEntry => e !== null);
}

function removeDraftFromJobs(
  jobs: ProjectJob[],
  entry: Pick<WorkspaceDraftEntry, "jobId" | "estimateId" | "quoteId">,
): ProjectJob[] {
  return jobs.map((job) => {
    if (job.id !== entry.jobId) return job;
    if (entry.estimateId) {
      return {
        ...job,
        estimates: (job.estimates ?? []).filter((e) => e.id !== entry.estimateId),
      };
    }
    if (entry.quoteId) {
      return {
        ...job,
        vendor_quotes: (job.vendor_quotes ?? []).filter((q) => q.id !== entry.quoteId),
      };
    }
    return job;
  });
}

function workspaceDraftList(entries: WorkspaceDraftEntry[]): FinancialDraftListItem[] {
  return entries.map((e) => ({
    id: e.id,
    label: e.draft.documentNumber || "Draft",
    sublabel: e.draft.billToName?.trim() || undefined,
    uiKind: e.uiKind,
  }));
}

function collectItems(jobs: ProjectJob[], project: Project): FinancialListItem[] {
  const items: FinancialListItem[] = [];
  for (const job of jobs) {
    const jobNumber = job.job_number?.trim() || job.id;
    const jobLabel = [jobNumber, job.name?.trim() || "Untitled job"].filter(Boolean).join(" — ");
    for (const est of job.estimates ?? []) {
      const totals = costingTotals(est.costing_sheet_snapshot);
      const totalCents = Math.round(totals.final_cost_to_quote_client * 100);
      const base = {
        id: `est-${est.id}`,
        jobId: job.id,
        jobNumber,
        jobLabel,
        documentNumber: est.document_number,
        counterparty: project.client.name,
        status: est.status,
        totalCents,
        date: est.sent_at ?? est.created_at ?? "",
        estimateId: est.id,
      };
      if (est.status !== "accepted") {
        items.push({ ...base, filterKind: "estimates", uiKind: "estimate" });
      } else {
        items.push({
          ...base,
          id: `inv-${est.id}`,
          filterKind: "invoices",
          uiKind: "invoice",
          documentNumber: est.document_number.replace(/^EST-/, "INV-"),
        });
      }
    }
    for (const quote of job.vendor_quotes ?? []) {
      const hasPo = Boolean(quote.po_number?.trim());
      const doc = buildQuoteDocument(project, job, quote, hasPo ? "po" : "vendor_quote");
      const totalCents = computeProductionDocumentTotals(doc).totalCents;
      items.push({
        id: `vq-${quote.id}`,
        filterKind: hasPo ? "pos" : "vendor_quotes",
        uiKind: hasPo ? "po" : "vendor_quote",
        jobId: job.id,
        jobNumber,
        jobLabel,
        documentNumber: quote.po_number?.trim() || `VQ-${job.job_number ?? job.id}`,
        counterparty: quote.vendor?.trim() || "—",
        status: quote.status ?? "draft",
        totalCents,
        date: quote.sent_at ?? quote.received_at ?? "",
        quoteId: quote.id,
      });
    }
  }
  return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function ProjectFinancialsPanel({
  project,
  deepLink,
  onDeepLinkConsumed,
}: {
  project: Project;
  deepLink?: FinancialsDeepLink | null;
  onDeepLinkConsumed?: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState<ListFilter>("all");
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const consumedDeepLinkRef = useRef<string | null>(null);

  const jobs = useMemo(() => loadProjectJobs(project.id, project), [project, revision]);

  useEffect(() => {
    function bump() {
      setRevision((n) => n + 1);
    }
    window.addEventListener("onpro-jobs-changed", bump);
    return () => window.removeEventListener("onpro-jobs-changed", bump);
  }, []);

  const items = useMemo(() => collectItems(jobs, project), [jobs, project]);
  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.filterKind === filter)),
    [items, filter],
  );

  const summary = useMemo(() => {
    const buckets = { draft: { count: 0, cents: 0 }, sent: { count: 0, cents: 0 }, paid: { count: 0, cents: 0 } };
    let totalCents = 0;
    for (const item of items) {
      totalCents += item.totalCents;
      const b = summaryBucket(item);
      buckets[b].count += 1;
      buckets[b].cents += item.totalCents;
    }
    return { buckets, totalCents, totalCount: items.length };
  }, [items]);

  const pendingSeedCount = useMemo(
    () => countPendingFinancialSeeds(jobs, workspace?.seedOptions ?? DEFAULT_FINANCIAL_SEED_OPTIONS),
    [jobs, workspace?.seedOptions],
  );

  const persistJobs = useCallback(
    (next: ProjectJob[]) => {
      saveProjectJobs(project.id, next);
      setRevision((n) => n + 1);
    },
    [project.id],
  );

  useEffect(() => {
    const docBase =
      projectPoNumber(project)?.trim() ||
      jobs[0]?.job_number?.trim()?.replace(/-\d{2}$/, "") ||
      String(project.id);
    let next = jobs;
    const jobsWithEstimates = jobs.filter((j) => (j.estimates?.length ?? 0) > 0);
    if (jobsWithEstimates.length > 1) {
      next = consolidateDuplicateProjectEstimates(next, docBase);
    }
    next = refreshProjectEstimateSnapshot(next, docBase);
    const changed =
      next !== jobs &&
      JSON.stringify(next.map((j) => ({ id: j.id, estimates: j.estimates }))) !==
        JSON.stringify(jobs.map((j) => ({ id: j.id, estimates: j.estimates })));
    if (changed) persistJobs(next);
  }, [jobs, project, persistJobs]);

  function openWorkspace() {
    const docBase =
      projectPoNumber(project)?.trim() ||
      jobs[0]?.job_number?.trim()?.replace(/-\d{2}$/, "") ||
      String(project.id);
    const jobsWithEstimates = jobs.filter((j) => (j.estimates?.length ?? 0) > 0);
    if (jobsWithEstimates.length > 1) {
      persistJobs(consolidateDuplicateProjectEstimates(jobs, docBase));
    }
    setWorkspace({
      jobPickerMode: "selected",
      selectedJobIds: new Set(jobs.map((j) => j.id)),
      seedOptions: DEFAULT_FINANCIAL_SEED_OPTIONS,
      entries: [],
      activeId: "",
      mode: "preview",
    });
  }

  function openItemInWorkspace(item: FinancialListItem, mode: FinancialDocMode = "preview") {
    const jobIds = new Set(jobs.map((j) => j.id));
    const entries = collectWorkspaceEntries(project, jobs, jobIds);
    if (!entries.some((e) => e.id === item.id)) return;
    setWorkspace({
      jobPickerMode: "all",
      selectedJobIds: jobIds,
      seedOptions: DEFAULT_FINANCIAL_SEED_OPTIONS,
      entries,
      activeId: item.id,
      mode,
    });
  }

  function workspaceTargetJobIds(ws: WorkspaceState): Set<string> {
    if (ws.jobPickerMode === "all") return new Set(jobs.map((j) => j.id));
    return ws.selectedJobIds;
  }

  function handleWorkspaceGenerate() {
    if (!workspace) return;
    const jobIds = workspaceTargetJobIds(workspace);
    const target = workspace.jobPickerMode === "all" ? ("all" as const) : [...jobIds];
    const { jobs: nextJobs, results } = seedFinancialDocumentsForJobs(
      jobs,
      target,
      workspace.seedOptions,
      project,
    );
    const createdCount = results.reduce((n, r) => n + r.created.length, 0);
    persistJobs(nextJobs);
    const entries = collectWorkspaceEntries(project, nextJobs, jobIds);
    const activeId = entries[0]?.id ?? "";
    setWorkspace((ws) =>
      ws
        ? {
            ...ws,
            entries,
            activeId,
            mode: entries.length > 0 ? "preview" : ws.mode,
          }
        : null,
    );
    if (entries.length === 0) {
      dispatchAppToast("No documents for the selected jobs — adjust selection or document types");
    } else if (createdCount === 0) {
      dispatchAppToast(`Showing ${entries.length} existing document${entries.length === 1 ? "" : "s"}`);
    } else {
      dispatchAppToast(
        `Created ${createdCount} document${createdCount === 1 ? "" : "s"} · ${entries.length} in draft set`,
      );
    }
  }

  function handleWorkspaceSave(draft: ProductionDocument) {
    if (!workspace?.activeId) return;
    const entry = workspace.entries.find((e) => e.id === workspace.activeId);
    if (!entry) return;
    persistJobs(persistDraftToJobs(entry, draft));
    setWorkspace((ws) =>
      ws
        ? {
            ...ws,
            entries: ws.entries.map((e) => (e.id === ws.activeId ? { ...e, draft, isNew: false } : e)),
          }
        : null,
    );
  }

  function handleWorkspaceDeleteDraft(id: string) {
    if (!workspace) return;
    const entry = workspace.entries.find((e) => e.id === id);
    if (!entry || entry.isNew) return;
    if (!window.confirm(`Delete ${entry.draft.documentNumber || "this document"}?`)) return;
    const nextJobs = removeDraftFromJobs(jobs, entry);
    persistJobs(nextJobs);
    const jobIds = workspaceTargetJobIds(workspace);
    const entries = collectWorkspaceEntries(project, nextJobs, jobIds);
    const activeId = workspace.activeId === id ? (entries[0]?.id ?? "") : workspace.activeId;
    setWorkspace((ws) =>
      ws
        ? {
            ...ws,
            entries,
            activeId,
            mode: entries.length === 0 ? "preview" : ws.mode,
          }
        : null,
    );
    dispatchAppToast("Document deleted");
  }

  useEffect(() => {
    if (!deepLink?.docId) {
      consumedDeepLinkRef.current = null;
      return;
    }
    const key = `${deepLink.docId}:${deepLink.mode ?? "preview"}`;
    if (consumedDeepLinkRef.current === key) return;
    const item = items.find((i) => i.id === deepLink.docId);
    if (!item) return;
    consumedDeepLinkRef.current = key;
    openItemInWorkspace(item, deepLink.mode ?? "preview");
    onDeepLinkConsumed?.();
  }, [deepLink, items, onDeepLinkConsumed]);

  function handleWorkspaceQuoteSent(result: {
    threadId: string;
    messageId: string;
    toEmail: string;
    ccEmails: string[];
  }) {
    if (!workspace?.activeId) return;
    const entry = workspace.entries.find((e) => e.id === workspace.activeId);
    if (!entry?.quoteId) return;
    const now = new Date().toISOString();
    const nextJobs = jobs.map((job) => {
      if (job.id !== entry.jobId) return job;
      return {
        ...job,
        vendor_quotes: (job.vendor_quotes ?? []).map((q) =>
          q.id === entry.quoteId
            ? {
                ...q,
                status: "sent" as const,
                sent_at: now,
                sent_to_email: result.toEmail,
                cc_emails: result.ccEmails.length > 0 ? result.ccEmails : undefined,
                mailroom_thread_id: result.threadId,
                outbound_message_id: result.messageId,
              }
            : q,
        ),
      };
    });
    persistJobs(nextJobs);
    setWorkspace((ws) =>
      ws
        ? {
            ...ws,
            entries: ws.entries.map((e) => (e.id === ws.activeId ? { ...e, status: "sent" } : e)),
            mode: "preview",
          }
        : null,
    );
  }

  function handleWorkspaceStatusChange(status: string) {
    if (!workspace?.activeId) return;
    const entry = workspace.entries.find((e) => e.id === workspace.activeId);
    if (!entry) return;
    const nextJobs = jobs.map((job) => {
      if (job.id !== entry.jobId) return job;
      if (entry.estimateId) {
        return {
          ...job,
          estimates: (job.estimates ?? []).map((est) =>
            est.id === entry.estimateId ? { ...est, status: status as EstimateStatus } : est,
          ),
        };
      }
      if (entry.quoteId) {
        return {
          ...job,
          vendor_quotes: (job.vendor_quotes ?? []).map((q) =>
            q.id === entry.quoteId ? { ...q, status: status as VendorQuote["status"] } : q,
          ),
        };
      }
      return job;
    });
    persistJobs(nextJobs);
    setWorkspace((ws) =>
      ws
        ? {
            ...ws,
            entries: ws.entries.map((e) => (e.id === ws.activeId ? { ...e, status } : e)),
          }
        : null,
    );
  }

  const activeWorkspaceEntry = workspace?.entries.find((e) => e.id === workspace.activeId);
  const workspacePlaceholderDraft = useMemo(() => {
    const job = jobs[0];
    if (!job) return null;
    const contacts = loadContacts();
    const clientContact = findClientContactForProject(contacts, project.client);
    return buildJobPreviewEstimateDocument({
      project,
      job,
      clientName: project.client.name,
      clientContact,
    });
  }, [jobs, project]);

  const workspaceConfig: FinancialWorkspaceConfig | undefined = workspace
    ? {
        projectLabel: `${project.name}${project.project_number ? ` · ${project.project_number}` : ""}`,
        jobs,
        jobPickerMode: workspace.jobPickerMode,
        onJobPickerMode: (mode) => setWorkspace((ws) => (ws ? { ...ws, jobPickerMode: mode } : null)),
        selectedJobIds: workspace.selectedJobIds,
        onToggleJob: (jobId) =>
          setWorkspace((ws) => {
            if (!ws) return null;
            const next = new Set(ws.selectedJobIds);
            if (next.has(jobId)) next.delete(jobId);
            else next.add(jobId);
            return { ...ws, selectedJobIds: next };
          }),
        seedOptions: workspace.seedOptions,
        onSeedOptionsChange: (seedOptions) => setWorkspace((ws) => (ws ? { ...ws, seedOptions } : null)),
        onGenerateDrafts: handleWorkspaceGenerate,
        drafts: workspaceDraftList(workspace.entries),
        activeDraftId: workspace.activeId,
        onSelectDraft: (id) =>
          setWorkspace((ws) => (ws ? { ...ws, activeId: id } : null)),
        onDeleteDraft: handleWorkspaceDeleteDraft,
      }
    : undefined;

  function openItem(item: FinancialListItem, mode: FinancialDocMode = "preview") {
    openItemInWorkspace(item, mode);
  }

  function persistDraftToJobs(
    ctx: Pick<WorkspaceDraftEntry, "jobId" | "estimateId" | "quoteId">,
    draft: ProductionDocument,
  ): ProjectJob[] {
    return jobs.map((job) => {
      if (job.id !== ctx.jobId) return job;
      if (ctx.estimateId) {
        const estimates = (job.estimates ?? []).map((est) =>
          est.id === ctx.estimateId
            ? {
                ...est,
                document_number: draft.documentNumber,
                costing_sheet_snapshot: {
                  ...est.costing_sheet_snapshot,
                  notes: draft.memoNotes,
                  lines: draft.lines
                    .filter((l) => l.description.trim() || l.rate.trim())
                    .map((l, i) => {
                      const existing = est.costing_sheet_snapshot.lines[i];
                      const qty = Number.parseFloat(l.quantity) || 1;
                      const rate = Number.parseFloat(l.rate.replace(/[^0-9.\-]/g, "")) || 0;
                      return {
                        id: existing?.id ?? `line-${i}`,
                        description: l.description,
                        vendor: existing?.vendor ?? null,
                        cost: existing?.cost ?? rate,
                        margin_mode: existing?.margin_mode ?? ("percent" as const),
                        margin_value: existing?.margin_value ?? 0,
                        price: rate,
                        qty,
                      };
                    }),
                },
              }
            : est,
        );
        return { ...job, estimates };
      }
      if (ctx.quoteId) {
        const totals = computeProductionDocumentTotals(draft);
        const primary = draft.lines.find((l) => l.description.trim() || l.rate.trim());
        const vendor_quotes = (job.vendor_quotes ?? []).map((q) =>
          q.id === ctx.quoteId
            ? {
                ...q,
                vendor: draft.billToName || q.vendor,
                item_description: primary?.description ?? q.item_description,
                qty: Number.parseFloat(primary?.quantity ?? "1") || q.qty,
                unit_cost: totals.subtotalCents / 100 / (Number.parseFloat(primary?.quantity ?? "1") || 1),
                notes: draft.memoNotes || q.notes,
                po_number: draft.documentNumber || q.po_number,
              }
            : q,
        );
        return { ...job, vendor_quotes };
      }
      return job;
    });
  }

  function handleDeleteListItem(item: FinancialListItem) {
    if (!window.confirm(`Delete ${item.documentNumber}?`)) return;
    const nextJobs = removeDraftFromJobs(jobs, {
      jobId: item.jobId,
      estimateId: item.estimateId,
      quoteId: item.quoteId,
    });
    persistJobs(nextJobs);
    if (workspace) {
      const jobIds = workspaceTargetJobIds(workspace);
      const entries = collectWorkspaceEntries(project, nextJobs, jobIds);
      if (entries.length === 0) {
        setWorkspace(null);
      } else {
        const activeId =
          workspace.activeId === item.id ? (entries[0]?.id ?? "") : workspace.activeId;
        setWorkspace((ws) => (ws ? { ...ws, entries, activeId } : null));
      }
    }
    dispatchAppToast("Document deleted");
  }

  if (jobs.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1600px] rounded-2xl border border-border-light bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-text-primary">No jobs on this project yet</p>
        <p className="mt-2 text-sm text-text-secondary">
          Add jobs first — estimates, invoices, and POs are created per job.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1600px] pb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav className="flex flex-wrap gap-2" aria-label="Financial document filters">
            {(["all", "estimates", "invoices", "pos", "vendor_quotes"] as const).map((f) => {
              const on = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    on
                      ? "bg-accent text-white shadow-sm"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {filterLabel(f)}
                </button>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={openWorkspace}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Import from jobs
              {pendingSeedCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                  {pendingSeedCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={openWorkspace}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent/90"
            >
              + Add document
            </button>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                { key: "draft" as const, label: "Drafts", hint: "documents" },
                { key: "sent" as const, label: "Sent", hint: "documents" },
                { key: "paid" as const, label: "Paid / Approved", hint: "documents" },
              ] as const
            ).map(({ key, label }) => (
              <div
                key={key}
                className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                  {formatUsdDetailed(summary.buckets[key].cents)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.buckets[key].count}{" "}
                  {summary.buckets[key].count === 1 ? "document" : "documents"}
                </p>
              </div>
            ))}
            <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white px-5 py-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-500">Total value</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                {formatUsdDetailed(summary.totalCents)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                across {summary.totalCount} {summary.totalCount === 1 ? "document" : "documents"}
              </p>
            </div>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-base font-semibold text-slate-800">
              {filter === "all" ? "No financial documents yet" : `No ${filterLabel(filter).toLowerCase()} yet`}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Use <strong>Import from jobs</strong> to generate estimates, vendor quotes, and POs for all
              jobs at once, or <strong>+ Add document</strong> to create one manually.
            </p>
            {pendingSeedCount > 0 ? (
              <button
                type="button"
                onClick={openWorkspace}
                className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
              >
                Generate from all {jobs.length} jobs
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            <ul className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <li key={item.id} className="group flex items-stretch">
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="group flex min-w-0 flex-1 items-center gap-4 px-4 py-4 text-left transition hover:bg-slate-50/90 sm:px-5"
                  >
                    <DocTypeIcon kind={item.uiKind} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {docTypeLabel(item.uiKind)}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {item.documentNumber}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.jobNumber}
                        {item.date ? ` · ${formatShortDate(item.date)}` : ""}
                        {item.counterparty ? ` · ${item.counterparty}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ${statusBadgeClass(item)}`}
                    >
                      {displayStatus(item)}
                    </span>
                    <span className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">
                      {formatUsdDetailed(item.totalCents)}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-accent opacity-80 group-hover:opacity-100">
                      Open
                      <span className="ml-0.5" aria-hidden>
                        ›
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteListItem(item)}
                    className="shrink-0 self-center px-3 py-2 text-xs font-semibold text-red-600 opacity-0 transition hover:bg-red-50 group-hover:opacity-100"
                    aria-label={`Delete ${item.documentNumber}`}
                    title="Delete document"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Showing {filtered.length} of {items.length}{" "}
              {items.length === 1 ? "document" : "documents"}
            </p>
          </div>
        )}
      </div>

      {workspace && workspacePlaceholderDraft ? (
        <FinancialDocumentFullscreen
          open
          uiKind={activeWorkspaceEntry?.uiKind ?? "estimate"}
          draft={activeWorkspaceEntry?.draft ?? workspacePlaceholderDraft}
          status={activeWorkspaceEntry?.status ?? "draft"}
          initialMode={workspace.mode}
          onClose={() => setWorkspace(null)}
          onSave={handleWorkspaceSave}
          onStatusChange={activeWorkspaceEntry ? handleWorkspaceStatusChange : undefined}
          onDelete={
            activeWorkspaceEntry && !activeWorkspaceEntry.isNew
              ? () => handleWorkspaceDeleteDraft(activeWorkspaceEntry.id)
              : undefined
          }
          workspace={workspaceConfig}
          jobs={jobs}
          clientName={project.client.name}
          activeJobId={activeWorkspaceEntry?.jobId}
          sendJob={jobs.find((j) => j.id === activeWorkspaceEntry?.jobId)}
          mailroomSend={
            activeWorkspaceEntry?.estimateId
              ? {
                  category: "client",
                  projectId: project.id,
                  jobId: activeWorkspaceEntry.jobId,
                  estimateId: activeWorkspaceEntry.estimateId,
                  onSent: () => handleWorkspaceStatusChange("sent"),
                }
              : activeWorkspaceEntry?.quoteId
                ? {
                    category: "vendor_quote",
                    projectId: project.id,
                    jobId: activeWorkspaceEntry.jobId,
                    vendorName: activeWorkspaceEntry.draft.billToName,
                    vendorQuoteId: activeWorkspaceEntry.quoteId,
                    onSent: (result) => handleWorkspaceQuoteSent(result),
                  }
                : undefined
          }
        />
      ) : null}
    </>
  );
}
