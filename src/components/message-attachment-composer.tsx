"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreadSmartAttachment } from "@/lib/mock/message-threads";
import type { AttachmentComposerDraft, ChatAttachmentKind, ComposerLineDraft } from "@/lib/attachment-composer-draft";
import {
  coerceAttachmentComposerDraft,
  defaultAttachmentComposerDraft,
} from "@/lib/attachment-composer-draft";
import {
  blankJobComposerFields,
  draftFieldsFromProjectJob,
  findProjectJobForDraft,
  jobAttachmentSubtitle,
  jobAttachmentTitle,
} from "@/lib/attachment-composer-job";
import { JobDetailsModal } from "@/components/job-details-modal";
import { normalizeJob } from "@/lib/job-defaults";
import { MOCK_LS, readMockLs } from "@/lib/mock-local";
import { getProjectById } from "@/lib/mock/projects";
import { AttachmentPreviewModal } from "@/components/attachment-preview-modal";
import { AttachmentSourcePicker } from "@/components/attachment-source-picker";
import {
  applyAttachmentSource,
  draftFromPackingSlip,
  listAttachmentSources,
  newAttachmentDraftForKind,
  sourcePickerLabel,
  type AttachmentSourceContext,
} from "@/lib/attachment-composer-sources";
import { createNewJobSeed } from "@/lib/project-job-create";
import { createPackingSlipDraft } from "@/lib/packing-slip";
import {
  blankCalendarComposerFields,
  buildCalendarEventFromComposer,
  calendarWhenFromDraft,
  loadAllCalendarEvents,
  parseCalendarSourceId,
  upsertCalendarEvent,
} from "@/lib/calendar-events-store";
import { getCalendarEvents } from "@/lib/mock/calendar-events";
import type { CalendarEventType } from "@/lib/types/calendar";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";
import { loadContacts, vendorContacts } from "@/lib/contacts-store";
import { ContactFieldSelect, contactFieldsFromPick } from "@/components/contact-field-select";
import { SearchableSelect } from "@/components/searchable-select";
import { VendorFieldSelect } from "@/components/vendor-select";
import { mockDocuments } from "@/lib/mock/documents";
import { clientCodeByName } from "@/lib/reference/client-codes";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

export type { AttachmentComposerDraft, ChatAttachmentKind } from "@/lib/attachment-composer-draft";

type Line = ComposerLineDraft;

function KindIcon({ kind, className }: { kind: ChatAttachmentKind; className?: string }) {
  const cls = className ?? "size-6";
  switch (kind) {
    case "job":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M9 7h6M9 12h6M9 17h4" />
          <rect x="4" y="3" width="16" height="18" rx="2" />
        </svg>
      );
    case "estimate":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M9 7h6M9 11h6M9 15h4" />
          <path d="M7 3h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        </svg>
      );
    case "quote":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
    case "approval":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "purchase_order":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "payment":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case "invoice":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M9 15h6M9 11h2" />
        </svg>
      );
    case "receiving":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case "packing_list":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M9 3h6l2 4H7l2-4z" />
          <path d="M5 7h14v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7z" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case "tracking":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="1" y="3" width="15" height="13" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      );
    case "task":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "calendar_event":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
      );
  }
}

const KIND_META: {
  id: ChatAttachmentKind;
  title: string;
  description: string;
}[] = [
  { id: "job", title: "Jobs", description: "Select or create a project job to share in chat" },
  { id: "estimate", title: "Estimates", description: "Create an estimate & send to chat" },
  { id: "quote", title: "Quotes", description: "Create a quote & send it to chat" },
  { id: "approval", title: "Approvals", description: "Select a file for approval" },
  { id: "purchase_order", title: "Purchase Orders", description: "Create a PO & send to chat" },
  { id: "payment", title: "Payments", description: "Request payment & send options" },
  { id: "invoice", title: "Invoices", description: "Create an invoice & send to chat" },
  { id: "receiving", title: "Receiving", description: "Receiving doc & share with chat" },
  { id: "packing_list", title: "Packing list", description: "Outbound packing list & send to chat" },
  { id: "tracking", title: "Tracking", description: "Carrier + tracking to chat" },
  { id: "task", title: "Task", description: "Assign a task in this thread" },
  { id: "calendar_event", title: "Calendar Event", description: "Pick an event or create a new one for Calendar" },
];

function Accordion({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className="border-b border-slate-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 py-3 text-left text-sm font-semibold text-slate-900"
      >
        {title}
        <span className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open ? <div className="space-y-3 pb-4">{children}</div> : null}
    </div>
  );
}

function Field({
  label,
  ...inputProps
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium text-slate-600">
      {label}
      <input
        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/25"
        {...inputProps}
      />
    </label>
  );
}

function TextAreaField({
  label,
  ...taProps
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block text-sm font-medium text-slate-600">
      {label}
      <textarea
        className="mt-1.5 min-h-[6.5rem] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base leading-relaxed text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/25"
        rows={5}
        {...taProps}
      />
    </label>
  );
}

function PreviewShell({
  docLabel,
  docNumber,
  children,
}: {
  docLabel: string;
  docNumber: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <p className="text-2xl font-bold text-slate-900">{docLabel}</p>
          <p className="mt-1 text-sm text-slate-500">{docNumber}</p>
        </div>
        <div className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">OnPro</div>
      </div>
      {children}
    </div>
  );
}

export function MessageAttachmentComposer(props: {
  open: boolean;
  sessionKey: number;
  initialDraft: AttachmentComposerDraft | null;
  mode: "new" | "edit";
  onClose: () => void;
  roomTitle: string;
  /** When set, job attachments pick from live project jobs (same as Projects → Jobs). */
  projectId?: number | null;
  linkedProjectName?: string | null;
  onSend: (attachment: ThreadSmartAttachment, timeLabel: string) => void;
  /** `document` = paper-style inline edit (from thread tap). `workspace` = full builder (+ menu). */
  layout?: "workspace" | "document";
}) {
  const {
    open,
    sessionKey,
    initialDraft,
    mode,
    onClose,
    roomTitle,
    projectId = null,
    linkedProjectName = null,
    onSend,
    layout = "workspace",
  } = props;
  const [kind, setKind] = useState<ChatAttachmentKind>("invoice");

  const [invoiceNo, setInvoiceNo] = useState("INV-2026-0142");
  const [projectName, setProjectName] = useState("Filllo Product Design");
  const [issued, setIssued] = useState(() => new Date().toISOString().slice(0, 10));
  const [due, setDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [fromName, setFromName] = useState("Connect Dots");
  const [fromAddr, setFromAddr] = useState("123 Mill St, Los Angeles, CA");
  const [fromEmail, setFromEmail] = useState("ops@connectdots.example");
  const [toName, setToName] = useState(roomTitle);
  const [toAddr, setToAddr] = useState("Client HQ — sample address");
  const [lines, setLines] = useState<Line[]>([
    { id: "1", description: "Web & App Design", units: "1", price: "1500" },
    { id: "2", description: "Logo Design", units: "1", price: "1500" },
  ]);
  const [notes, setNotes] = useState("Late fees may apply after the due date.");
  const [bank, setBank] = useState("Routing · Account on file");

  const [quoteNo, setQuoteNo] = useState("QT-2026-0091");
  const [quoteValid, setQuoteValid] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [quoteScope, setQuoteScope] = useState("Sampling, revisions, and delivery milestones.");
  const [quoteTotal, setQuoteTotal] = useState("3000");

  const [poNo, setPoNo] = useState("PO-2026-0331");
  const [vendor, setVendor] = useState("CA Factory");
  const [poShip, setPoShip] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().slice(0, 10);
  });
  const [poLines, setPoLines] = useState("Bulk fleece — 2,400 units · 3 colorways");

  const [jobId, setJobId] = useState("");
  const [jobName, setJobName] = useState("NO HUMANS ALLOWED TEE");
  const [jobSubtitle, setJobSubtitle] = useState("TEES");
  const [jobType, setJobType] = useState("PRINT PRODUCTION");
  const [jobLeadVendor, setJobLeadVendor] = useState("Millworks Collective");
  const [jobCategory, setJobCategory] = useState("Tee");
  const [jobStyleNumber, setJobStyleNumber] = useState("GGT148");
  const [jobColorway, setJobColorway] = useState("Black");
  const [jobPoNumber, setJobPoNumber] = useState("GG-2026-05-001");
  const [jobStatus, setJobStatus] = useState("In progress");
  const [jobDue, setJobDue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return d.toISOString().slice(0, 10);
  });

  const [estNo, setEstNo] = useState("EST-2026-0044");
  const [estScope, setEstScope] = useState("Sampling + TOP cycle for capsule.");

  const [approvalFile, setApprovalFile] = useState("strike-off-v2.pdf");
  const [approvalNote, setApprovalNote] = useState("Please approve for bulk.");

  const [payAmount, setPayAmount] = useState("3350.00");
  const [payNote, setPayNote] = useState("Net 30 · ACH preferred");

  const [recvBol, setRecvBol] = useState("BOL-99821");
  const [recvSummary, setRecvSummary] = useState("2 cartons · Glo Gang bulk");

  const [packingListNo, setPackingListNo] = useState("GG240816");
  const [packingCompanyName, setPackingCompanyName] = useState("Connect Dots");
  const [packingShipDate, setPackingShipDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [trackCarrier, setTrackCarrier] = useState("FedEx");
  const [trackNo, setTrackNo] = useState("7844 1200 3391");

  const [taskTitle, setTaskTitle] = useState("Upload TOP photos");
  const [taskAssignee, setTaskAssignee] = useState(roomTitle);

  const [calTitle, setCalTitle] = useState("");
  const [calWhen, setCalWhen] = useState("");
  const [calWhere, setCalWhere] = useState("");
  const [calDate, setCalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calStart, setCalStart] = useState("10:00");
  const [calEnd, setCalEnd] = useState("11:00");
  const [calType, setCalType] = useState<CalendarEventType>("meeting");
  const [calDesc, setCalDesc] = useState("");
  const [calRevision, setCalRevision] = useState(0);

  const meta = useMemo(() => KIND_META.find((k) => k.id === kind)!, [kind]);

  const [jobsRevision, setJobsRevision] = useState(0);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [jobModal, setJobModal] = useState<
    { kind: "new"; seed: ProjectJob } | { kind: "edit"; jobId: string } | null
  >(null);

  const linkedProject = useMemo((): Project | null => {
    if (projectId == null) return null;
    const base = getProjectById(projectId);
    if (!base) return null;
    const patch = readMockLs<Partial<Project>>(MOCK_LS.project(projectId));
    return { ...base, ...(patch && typeof patch === "object" ? patch : {}) };
  }, [projectId, open, sessionKey, jobsRevision]);

  const projectJobs = useMemo(() => {
    if (!linkedProject) return [];
    return loadProjectJobs(linkedProject.id, linkedProject);
  }, [linkedProject, jobsRevision]);

  const clientCode = useMemo(
    () => (linkedProject ? clientCodeByName(linkedProject.client.name) ?? "GG" : "GG"),
    [linkedProject],
  );

  const contacts = useMemo(() => loadContacts(), []);
  const vendors = useMemo(() => vendorContacts(contacts), [contacts]);

  function applyFromContact(contact: Contact | null) {
    if (!contact) {
      setFromName("");
      setFromAddr("");
      setFromEmail("");
      return;
    }
    const { name, address, email } = contactFieldsFromPick(contact, contacts);
    setFromName(name);
    setFromAddr(address);
    setFromEmail(email);
  }

  function applyToContact(contact: Contact | null) {
    if (!contact) {
      setToName("");
      setToAddr("");
      return;
    }
    const { name, address } = contactFieldsFromPick(contact, contacts);
    setToName(name);
    setToAddr(address);
  }

  function applyVendorContact(contact: Contact | null) {
    if (!contact) {
      setVendor("");
      return;
    }
    const { name } = contactFieldsFromPick(contact, contacts);
    setVendor(name);
  }

  const projectDocuments = useMemo(() => {
    if (!linkedProject) return [];
    return mockDocuments.filter((d) => d.project_id === linkedProject.id);
  }, [linkedProject]);

  const seedCalendarEvents = useMemo(() => getCalendarEvents(), []);
  const seedCalendarIds = useMemo(
    () => new Set(seedCalendarEvents.map((e) => e.id)),
    [seedCalendarEvents],
  );
  const calendarEvents = useMemo(
    () => loadAllCalendarEvents(seedCalendarEvents),
    [seedCalendarEvents, calRevision],
  );

  const sourceContext: AttachmentSourceContext = useMemo(
    () => ({
      project: linkedProject,
      jobs: projectJobs,
      documents: projectDocuments,
      calendarEvents,
      roomTitle,
    }),
    [linkedProject, projectJobs, projectDocuments, calendarEvents, roomTitle],
  );

  const sourceOptions = useMemo(
    () => listAttachmentSources(kind, sourceContext),
    [kind, sourceContext],
  );

  const jobModalJob = useMemo(() => {
    if (!jobModal || !linkedProject) return null;
    if (jobModal.kind === "new") return normalizeJob(jobModal.seed, undefined);
    const found = projectJobs.find((j) => j.id === jobModal.jobId);
    return found ? normalizeJob(found, linkedProject) : null;
  }, [jobModal, linkedProject, projectJobs]);

  function applyDraftFrom(d: AttachmentComposerDraft) {
    setKind(d.kind);
    setSelectedSourceId(d.selectedSourceId ?? "");
    setInvoiceNo(d.invoiceNo);
    setProjectName(d.projectName);
    setIssued(d.issued);
    setDue(d.due);
    setFromName(d.fromName);
    setFromAddr(d.fromAddr);
    setFromEmail(d.fromEmail);
    setToName(d.toName);
    setToAddr(d.toAddr);
    setLines(d.lines.length ? d.lines : defaultAttachmentComposerDraft(roomTitle).lines);
    setNotes(d.notes);
    setBank(d.bank);
    setQuoteNo(d.quoteNo);
    setQuoteValid(d.quoteValid);
    setQuoteScope(d.quoteScope);
    setQuoteTotal(d.quoteTotal);
    setPoNo(d.poNo);
    setVendor(d.vendor);
    setPoShip(d.poShip);
    setPoLines(d.poLines);
    setEstNo(d.estNo);
    setEstScope(d.estScope);
    setJobId(d.jobId ?? "");
    setJobName(d.jobName);
    setJobSubtitle(d.jobSubtitle);
    setJobType(d.jobType);
    setJobLeadVendor(d.jobLeadVendor);
    setJobCategory(d.jobCategory);
    setJobStyleNumber(d.jobStyleNumber);
    setJobColorway(d.jobColorway ?? "");
    setJobPoNumber(d.jobPoNumber ?? "");
    setJobStatus(d.jobStatus);
    setJobDue(d.jobDue);
    setApprovalFile(d.approvalFile);
    setApprovalNote(d.approvalNote);
    setPayAmount(d.payAmount);
    setPayNote(d.payNote);
    setRecvBol(d.recvBol);
    setRecvSummary(d.recvSummary);
    setPackingListNo(d.packingListNo);
    setPackingCompanyName(d.packingCompanyName);
    setPackingShipDate(d.packingShipDate);
    setTrackCarrier(d.trackCarrier);
    setTrackNo(d.trackNo);
    setTaskTitle(d.taskTitle);
    setTaskAssignee(d.taskAssignee);
    setCalTitle(d.calTitle);
    setCalWhen(d.calWhen);
    setCalWhere(d.calWhere);
    setCalDate(d.calDate);
    setCalStart(d.calStart);
    setCalEnd(d.calEnd);
    setCalType(d.calType);
    setCalDesc(d.calDesc);
  }

  function applyProjectJob(job: ProjectJob | null) {
    if (!job) {
      const blank = blankJobComposerFields();
      setJobId(blank.jobId);
      setJobName(blank.jobName);
      setJobSubtitle(blank.jobSubtitle);
      setJobType(blank.jobType);
      setJobLeadVendor(blank.jobLeadVendor);
      setJobCategory(blank.jobCategory);
      setJobStyleNumber(blank.jobStyleNumber);
      setJobColorway(blank.jobColorway);
      setJobPoNumber(blank.jobPoNumber);
      setJobStatus(blank.jobStatus);
      setJobDue(blank.jobDue);
      return;
    }
    const f = draftFieldsFromProjectJob(job);
    setJobId(f.jobId);
    setJobName(f.jobName);
    setJobSubtitle(f.jobSubtitle);
    setJobType(f.jobType);
    setJobLeadVendor(f.jobLeadVendor);
    setJobCategory(f.jobCategory);
    setJobStyleNumber(f.jobStyleNumber);
    setJobColorway(f.jobColorway);
    setJobPoNumber(f.jobPoNumber);
    setJobStatus(f.jobStatus);
    setJobDue(f.jobDue);
  }

  useEffect(() => {
    if (!open) return;
    const d = initialDraft
      ? (coerceAttachmentComposerDraft(initialDraft, roomTitle) ?? defaultAttachmentComposerDraft(roomTitle))
      : defaultAttachmentComposerDraft(roomTitle);
    applyDraftFrom(d);
    if (projectId != null && projectJobs.length > 0) {
      const matched = findProjectJobForDraft(projectJobs, d);
      if (matched && !d.selectedSourceId) {
        applyDraftFrom({
          ...d,
          selectedSourceId: `job:${matched.id}`,
          ...draftFieldsFromProjectJob(matched),
        });
      }
    }
    if (linkedProjectName?.trim()) {
      setProjectName(linkedProjectName.trim());
    }
  }, [open, sessionKey, roomTitle, initialDraft, projectId, projectJobs, linkedProjectName]);

  useEffect(() => {
    if (!open) {
      setJobModal(null);
      setPreviewOpen(false);
    }
  }, [open, sessionKey]);

  function handleComposerJobSave(saved: ProjectJob) {
    if (!linkedProject) return;
    const next =
      jobModal?.kind === "new"
        ? [...projectJobs, saved]
        : projectJobs.map((j) => (j.id === saved.id ? saved : j));
    saveProjectJobs(linkedProject.id, next);
    setJobsRevision((r) => r + 1);
    applyProjectJob(saved);
    setSelectedSourceId(`job:${saved.id}`);
    setJobModal(null);
  }

  const invoiceTotal = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.units) || 0), 0);
  }, [lines]);

  const packingTotalPieces = useMemo(() => {
    return lines.reduce((s, l) => s + (Number(l.units) || 0), 0);
  }, [lines]);

  function buildSnapshot(): AttachmentComposerDraft {
    return {
      v: 1,
      selectedSourceId,
      kind,
      invoiceNo,
      projectName,
      issued,
      due,
      fromName,
      fromAddr,
      fromEmail,
      toName,
      toAddr,
      lines: lines.map((l) => ({ ...l })),
      notes,
      bank,
      quoteNo,
      quoteValid,
      quoteScope,
      quoteTotal,
      poNo,
      vendor,
      poShip,
      poLines,
      estNo,
      estScope,
      jobId,
      jobName,
      jobSubtitle,
      jobType,
      jobLeadVendor,
      jobCategory,
      jobStyleNumber,
      jobColorway,
      jobPoNumber,
      jobStatus,
      jobDue,
      approvalFile,
      approvalNote,
      payAmount,
      payNote,
      recvBol,
      recvSummary,
      packingListNo,
      packingCompanyName,
      packingShipDate,
      trackCarrier,
      trackNo,
      taskTitle,
      taskAssignee,
      calTitle,
      calWhen,
      calWhere,
      calDate,
      calStart,
      calEnd,
      calType,
      calDesc,
    };
  }

  function saveCalendarEventFromForm(): AttachmentComposerDraft | null {
    if (!calTitle.trim()) return null;
    const existingId = parseCalendarSourceId(selectedSourceId);
    const ev = buildCalendarEventFromComposer({
      calTitle,
      calDate,
      calStart,
      calEnd,
      calType,
      calDesc,
      calWhere,
      linkToClient: linkedProject?.client.name ?? roomTitle,
      existingId,
    });
    const saved = upsertCalendarEvent(ev, seedCalendarIds);
    const when = calendarWhenFromDraft(calDate, calStart, calEnd);
    setSelectedSourceId(`calendar:${saved.id}`);
    setCalWhen(when);
    setCalRevision((r) => r + 1);
    return {
      ...buildSnapshot(),
      selectedSourceId: `calendar:${saved.id}`,
      calWhen: when,
    };
  }

  function handleKindChange(next: ChatAttachmentKind) {
    if (next !== kind) setSelectedSourceId("");
    setKind(next);
  }

  function handleSelectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    if (!sourceId) return;
    const next = applyAttachmentSource(kind, sourceId, buildSnapshot(), sourceContext);
    if (next) applyDraftFrom(next);
  }

  function handleCreateNewKind() {
    if (kind === "job" && linkedProject) {
      setSelectedSourceId("");
      applyProjectJob(null);
      setJobModal({ kind: "new", seed: createNewJobSeed(linkedProject, projectJobs) });
      return;
    }
    if (kind === "calendar_event") {
      setSelectedSourceId("");
      const blank = defaultAttachmentComposerDraft(roomTitle);
      applyDraftFrom({
        ...blank,
        kind: "calendar_event",
        ...blankCalendarComposerFields(roomTitle, linkedProject?.client.name),
      });
      return;
    }
    const fresh = newAttachmentDraftForKind(kind, sourceContext);
    if (kind === "packing_list" && linkedProject) {
      const slip = createPackingSlipDraft(linkedProject, projectJobs, loadContacts());
      applyDraftFrom(draftFromPackingSlip(slip, roomTitle, fresh));
      return;
    }
    applyDraftFrom(fresh);
  }

  function buildAttachment(draftOverride?: AttachmentComposerDraft): ThreadSmartAttachment {
    const composer_draft = draftOverride ?? buildSnapshot();
    switch (kind) {
      case "invoice":
        return {
          kind,
          title: `Invoice ${invoiceNo}`,
          subtitle: projectName,
          badge: `$${invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          composer_draft,
        };
      case "quote":
        return {
          kind,
          title: `Quote ${quoteNo}`,
          subtitle: roomTitle,
          badge: `$${Number(quoteTotal).toFixed(2)}`,
          composer_draft,
        };
      case "purchase_order":
        return {
          kind,
          title: `PO ${poNo}`,
          subtitle: `${vendor} · ${poLines.slice(0, 60)}`,
          badge: poShip,
          composer_draft,
        };
      case "job": {
        const linked = projectJobs.find((j) => j.id === jobId);
        const title = linked ? jobAttachmentTitle(linked) : jobName.trim() || "Untitled job";
        const subtitle = linked
          ? jobAttachmentSubtitle(linked)
          : [jobSubtitle, jobStyleNumber, jobColorway, jobType, jobLeadVendor].filter(Boolean).join(" · ");
        return {
          kind,
          title,
          subtitle,
          badge: jobStatus,
          composer_draft,
        };
      }
      case "estimate":
        return { kind, title: `Estimate ${estNo}`, subtitle: roomTitle, badge: "Draft", composer_draft };
      case "approval":
        return {
          kind,
          title: approvalFile,
          subtitle: approvalNote.slice(0, 80),
          badge: "Approval",
          composer_draft,
        };
      case "payment":
        return {
          kind,
          title: `Payment $${payAmount}`,
          subtitle: payNote,
          badge: "Request",
          composer_draft,
        };
      case "receiving":
        return { kind, title: recvBol, subtitle: recvSummary, badge: "Receiving", composer_draft };
      case "packing_list":
        return {
          kind,
          title: `Packing list ${packingListNo}`,
          subtitle: `${toName} · ${packingTotalPieces} pcs`,
          badge: "Packing list",
          composer_draft,
        };
      case "tracking":
        return {
          kind,
          title: trackNo,
          subtitle: `${trackCarrier} · ${roomTitle}`,
          badge: "Ship",
          composer_draft,
        };
      case "task":
        return {
          kind,
          title: taskTitle,
          subtitle: `Assignee: ${taskAssignee}`,
          badge: "Task",
          composer_draft,
        };
      case "calendar_event": {
        const when =
          composer_draft.calWhen ||
          calendarWhenFromDraft(composer_draft.calDate, composer_draft.calStart, composer_draft.calEnd);
        const where = composer_draft.calWhere.trim();
        return {
          kind,
          title: composer_draft.calTitle.trim() || "Calendar event",
          subtitle: where ? `${when} · ${where}` : when,
          badge: "Event",
          composer_draft,
        };
      }
      default:
        return { kind: "invoice", title: "Document", subtitle: roomTitle, composer_draft };
    }
  }

  function send() {
    const draft =
      kind === "calendar_event" ? saveCalendarEventFromForm() : buildSnapshot();
    if (kind === "calendar_event" && !draft) return;
    const now = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    onSend(buildAttachment(draft ?? undefined), now);
    onClose();
  }

  if (!open) return null;

  /** Fillable “PDF” fields — minimal chrome, dotted underlines */
  const docIn =
    "w-full rounded-none border-0 border-b border-dotted border-slate-300 bg-transparent text-slate-900 placeholder:text-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0";
  const docInSm = `${docIn} text-sm`;

  if (layout === "document" && kind === "invoice") {
    const displayTitle = mode === "edit" ? "Edit invoice" : "New invoice";
    return (
      <div className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/50 p-0 sm:p-4">
        <button type="button" className="absolute inset-0 z-0 cursor-default" aria-label="Close" onClick={onClose} />
        <div className="relative z-10 flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-none bg-slate-200/95 shadow-2xl sm:max-h-[92vh] sm:rounded-2xl">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Invoice</p>
              <h2 className="text-lg font-bold text-slate-900">{displayTitle}</h2>
              <p className="text-xs text-slate-500">Room: {roomTitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700"
                onClick={send}
              >
                Save to chat
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
            <div className="mx-auto max-w-2xl rounded-sm bg-white p-6 shadow-[0_2px_24px_-4px_rgba(0,0,0,0.12)] ring-1 ring-slate-900/10 sm:p-10">
              <div className="mb-6 rounded-lg border border-emerald-100 bg-emerald-50/90 px-4 py-3 text-left">
                <p className="text-sm font-semibold text-emerald-900">Recipient view</p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800/90">
                  You&apos;re seeing this as your client would in the thread. Tap any line to edit — like markup on
                  a PDF. Use <span className="font-medium">Save to chat</span> when done.
                </p>
              </div>

              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-2xl font-bold text-slate-900">Invoice</p>
                  <label className="mt-1 block text-sm text-slate-500">
                    <span className="sr-only">Invoice number</span>
                    <span className="text-slate-400">#</span>
                    <input
                      value={invoiceNo}
                      onChange={(e) => setInvoiceNo(e.target.value)}
                      className={`${docIn} inline-block min-w-[10rem] font-medium`}
                      aria-label="Invoice number"
                    />
                  </label>
                </div>
                <div className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                  OnPro
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Project</p>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={`${docIn} font-medium`}
                  aria-label="Project name"
                />
                <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                  <label className="flex items-center gap-2">
                    Issued
                    <input
                      type="date"
                      value={issued}
                      onChange={(e) => setIssued(e.target.value)}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    Due
                    <input
                      type="date"
                      value={due}
                      onChange={(e) => setDue(e.target.value)}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800"
                    />
                  </label>
                </div>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <ContactFieldSelect
                    label="From"
                    scope="from"
                    contacts={contacts}
                    value={fromName}
                    onPick={applyFromContact}
                    emptyLabel="Select sender…"
                    variant="document"
                    labelClassName="text-[11px] font-semibold uppercase text-slate-400"
                  />
                  <input
                    value={fromAddr}
                    onChange={(e) => setFromAddr(e.target.value)}
                    className={`${docInSm} mt-2 text-slate-700`}
                    aria-label="From address"
                  />
                  <input
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className={`${docInSm} mt-2 text-slate-700`}
                    aria-label="From email"
                  />
                </div>
                <div>
                  <ContactFieldSelect
                    label="Bill to"
                    scope="client"
                    contacts={contacts}
                    value={toName}
                    onPick={applyToContact}
                    emptyLabel="Select client…"
                    variant="document"
                    labelClassName="text-[11px] font-semibold uppercase text-slate-400"
                  />
                  <textarea
                    value={toAddr}
                    onChange={(e) => setToAddr(e.target.value)}
                    rows={3}
                    className={`${docInSm} mt-2 min-h-[3.5rem] resize-y text-slate-700`}
                    aria-label="Bill to address"
                  />
                </div>
              </div>

              <table className="mt-6 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-2 font-semibold">Description</th>
                    <th className="py-2 pr-2 font-semibold">Units</th>
                    <th className="py-2 pr-2 font-semibold">Price</th>
                    <th className="py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2 align-top">
                        <input
                          value={l.description}
                          onChange={(e) => {
                            const next = [...lines];
                            next[i] = { ...l, description: e.target.value };
                            setLines(next);
                          }}
                          className={`${docInSm} text-slate-800`}
                          aria-label={`Line ${i + 1} description`}
                        />
                      </td>
                      <td className="py-2 pr-2 align-top">
                        <input
                          value={l.units}
                          onChange={(e) => {
                            const next = [...lines];
                            next[i] = { ...l, units: e.target.value };
                            setLines(next);
                          }}
                          className={`${docInSm} w-16 text-slate-800`}
                          aria-label={`Line ${i + 1} units`}
                        />
                      </td>
                      <td className="py-2 pr-2 align-top">
                        <input
                          value={l.price}
                          onChange={(e) => {
                            const next = [...lines];
                            next[i] = { ...l, price: e.target.value };
                            setLines(next);
                          }}
                          className={`${docInSm} w-24 text-slate-800`}
                          aria-label={`Line ${i + 1} price`}
                        />
                      </td>
                      <td className="py-2 text-right align-top font-medium text-slate-900">
                        ${((Number(l.price) || 0) * (Number(l.units) || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, { id: String(Date.now()), description: "", units: "1", price: "0" }])}
                className="mt-2 text-xs font-semibold text-violet-600 hover:underline"
              >
                + Add line
              </button>

              <p className="mt-4 text-right text-lg font-bold text-slate-900">
                Total ${invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>

              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={`${docInSm} mt-2 min-h-[4rem] resize-y`}
                  aria-label="Invoice notes"
                />
              </div>
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase text-slate-400">Payment</p>
                <textarea
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  rows={2}
                  className={`${docInSm} mt-2 resize-y text-slate-700`}
                  aria-label="Payment details"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const previewInvoice = (
    <PreviewShell docLabel="Invoice" docNumber={`#${invoiceNo.replace(/^INV-?/i, "")}`}>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-400">Project</p>
          <p className="mt-1 font-medium text-slate-900">{projectName}</p>
          <p className="mt-2 text-xs text-slate-500">
            Issued {issued} · Due {due}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-400">From</p>
          <p className="mt-1 font-medium text-slate-900">{fromName}</p>
          <p className="mt-1 text-xs text-slate-600">{fromAddr}</p>
          <p className="mt-1 text-xs text-slate-600">{fromEmail}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-400">To</p>
          <p className="mt-1 font-medium text-slate-900">{toName}</p>
          <p className="mt-1 text-xs text-slate-600">{toAddr}</p>
        </div>
      </div>
      <table className="mt-6 w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2">Units</th>
            <th className="py-2 pr-2">Price</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="py-2 pr-2 text-slate-800">{l.description}</td>
              <td className="py-2 pr-2 text-slate-600">{l.units}</td>
              <td className="py-2 pr-2 text-slate-600">${l.price}</td>
              <td className="py-2 text-right font-medium text-slate-900">
                ${((Number(l.price) || 0) * (Number(l.units) || 0)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-right text-lg font-bold text-slate-900">
        Total ${invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{notes}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase text-slate-400">Payment</p>
      <p className="text-xs text-slate-700">{bank}</p>
    </PreviewShell>
  );

  const previewGeneric = (
    <PreviewShell docLabel={meta.title.replace(/s$/, "")} docNumber={quoteNo}>
      <p className="mt-4 text-sm text-slate-600">Preview updates live from the form. This mock matches the iOS “+ → add to chat” flow.</p>
      <p className="mt-4 text-sm font-medium text-slate-900">{roomTitle}</p>
    </PreviewShell>
  );

  const formInvoice = (
    <>
      <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <span className="font-semibold">Tip:</span> save as draft in a future build; for now this sends a rich card to the thread (mock).
      </p>
      <Accordion title="My details" defaultOpen>
        <ContactFieldSelect
          label="From (vendor / team)"
          scope="from"
          contacts={contacts}
          value={fromName}
          onPick={applyFromContact}
          emptyLabel="Select sender…"
        />
        <Field label="Address" value={fromAddr} onChange={(e) => setFromAddr(e.target.value)} />
        <Field label="Email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} />
      </Accordion>
      <Accordion title="Client details" defaultOpen>
        <ContactFieldSelect
          label="Bill to (client)"
          scope="client"
          contacts={contacts}
          value={toName}
          onPick={applyToContact}
          emptyLabel="Select client…"
        />
        <Field label="Address" value={toAddr} onChange={(e) => setToAddr(e.target.value)} />
      </Accordion>
      <Accordion title="Invoice details" defaultOpen>
        <Field label="Invoice #" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        <Field label="Project / subject" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Issued" type="date" value={issued} onChange={(e) => setIssued(e.target.value)} />
          <Field label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </Accordion>
      <Accordion title="Line items" defaultOpen>
        {lines.map((l, i) => (
          <div key={l.id} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-3">
            <Field
              label="Description"
              value={l.description}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...l, description: e.target.value };
                setLines(next);
              }}
            />
            <Field
              label="Units"
              value={l.units}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...l, units: e.target.value };
                setLines(next);
              }}
            />
            <Field
              label="Price"
              value={l.price}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...l, price: e.target.value };
                setLines(next);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-xs font-semibold text-violet-600 hover:underline"
          onClick={() => setLines((prev) => [...prev, { id: String(Date.now()), description: "", units: "1", price: "0" }])}
        >
          + Add line
        </button>
      </Accordion>
      <Accordion title="Payment details">
        <TextAreaField label="Bank / terms" value={bank} onChange={(e) => setBank(e.target.value)} />
      </Accordion>
      <Accordion title="Add notes">
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Accordion>
    </>
  );

  const formQuote = (
    <>
      <Accordion title="Quote details" defaultOpen>
        <Field label="Quote #" value={quoteNo} onChange={(e) => setQuoteNo(e.target.value)} />
        <Field label="Client / room" value={roomTitle} readOnly className="bg-slate-50" />
        <Field label="Valid until" type="date" value={quoteValid} onChange={(e) => setQuoteValid(e.target.value)} />
        <Field label="Total (USD)" value={quoteTotal} onChange={(e) => setQuoteTotal(e.target.value)} />
      </Accordion>
      <Accordion title="Scope notes" defaultOpen>
        <TextAreaField label="What’s included" value={quoteScope} onChange={(e) => setQuoteScope(e.target.value)} />
      </Accordion>
    </>
  );

  const formPO = (
    <Accordion title="Purchase order" defaultOpen>
      <Field label="PO #" value={poNo} onChange={(e) => setPoNo(e.target.value)} />
      <VendorFieldSelect
        label="Vendor"
        vendors={vendors}
        value={vendor}
        onChange={(name) => setVendor(name ?? "")}
        labelClassName="block text-sm font-medium text-slate-600"
      />
      <Field label="Ship / ex-factory target" type="date" value={poShip} onChange={(e) => setPoShip(e.target.value)} />
      <TextAreaField label="Line items / SKUs" value={poLines} onChange={(e) => setPoLines(e.target.value)} />
    </Accordion>
  );

  const formJob =
    projectId == null ? (
      <Accordion title="Job details" defaultOpen>
        <Field label="Job name" value={jobName} onChange={(e) => setJobName(e.target.value)} />
        <Field label="Subtitle" value={jobSubtitle} onChange={(e) => setJobSubtitle(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type" value={jobType} onChange={(e) => setJobType(e.target.value)} />
          <Field label="Status" value={jobStatus} onChange={(e) => setJobStatus(e.target.value)} />
        </div>
        <VendorFieldSelect
          label="Lead vendor"
          vendors={vendors}
          value={jobLeadVendor}
          onChange={(name) => setJobLeadVendor(name ?? "")}
          labelClassName="block text-sm font-medium text-slate-600"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category" value={jobCategory} onChange={(e) => setJobCategory(e.target.value)} />
          <Field label="Style #" value={jobStyleNumber} onChange={(e) => setJobStyleNumber(e.target.value)} />
        </div>
        <Field label="Colorway" value={jobColorway} onChange={(e) => setJobColorway(e.target.value)} />
        <Field label="PO #" value={jobPoNumber} onChange={(e) => setJobPoNumber(e.target.value)} />
        <Field label="Due date" type="date" value={jobDue} onChange={(e) => setJobDue(e.target.value)} />
      </Accordion>
    ) : (
      <Accordion title="Job details" defaultOpen>
        {!jobId && !jobName.trim() ? (
          <p className="text-sm text-slate-500">Select an existing job or create a new one above.</p>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Name</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{jobName || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Subtitle</dt>
              <dd className="mt-0.5 text-slate-800">{jobSubtitle || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Type</dt>
              <dd className="mt-0.5 text-slate-800">{jobType || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Status</dt>
              <dd className="mt-0.5 font-medium text-violet-700">{jobStatus || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Lead vendor</dt>
              <dd className="mt-0.5 text-slate-800">{jobLeadVendor || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Category</dt>
              <dd className="mt-0.5 text-slate-800">{jobCategory || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Style #</dt>
              <dd className="mt-0.5 text-slate-800">{jobStyleNumber || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Colorway</dt>
              <dd className="mt-0.5 text-slate-800">{jobColorway || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">PO #</dt>
              <dd className="mt-0.5 text-slate-800">{jobPoNumber || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">Due date</dt>
              <dd className="mt-0.5 text-slate-800">{jobDue || "—"}</dd>
            </div>
          </dl>
        )}
        <p className="text-xs text-slate-500">Use Preview to print or check layout before sending to chat.</p>
      </Accordion>
    );

  const formEstimate = (
    <Accordion title="Estimate" defaultOpen>
      <Field label="Estimate #" value={estNo} onChange={(e) => setEstNo(e.target.value)} />
      <TextAreaField label="Scope" value={estScope} onChange={(e) => setEstScope(e.target.value)} />
      <Field label="Ballpark total (USD)" value={quoteTotal} onChange={(e) => setQuoteTotal(e.target.value)} />
    </Accordion>
  );

  const formApproval = (
    <Accordion title="Approval" defaultOpen>
      <Field label="File name" value={approvalFile} onChange={(e) => setApprovalFile(e.target.value)} />
      <TextAreaField label="Note to reviewers" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} />
    </Accordion>
  );

  const formPayment = (
    <Accordion title="Payment request" defaultOpen>
      <Field label="Amount (USD)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
      <TextAreaField label="Terms / methods" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
    </Accordion>
  );

  const formReceiving = (
    <Accordion title="Receiving" defaultOpen>
      <Field label="BOL / receipt ref" value={recvBol} onChange={(e) => setRecvBol(e.target.value)} />
      <TextAreaField label="Summary" value={recvSummary} onChange={(e) => setRecvSummary(e.target.value)} />
    </Accordion>
  );

  const formPackingList = (
    <>
      <Accordion title="Packing list" defaultOpen>
        <Field label="Document #" value={packingListNo} onChange={(e) => setPackingListNo(e.target.value)} />
        <VendorFieldSelect
          label="Company (header)"
          vendors={vendors}
          value={packingCompanyName}
          onChange={(name) => setPackingCompanyName(name ?? "")}
          labelClassName="block text-sm font-medium text-slate-600"
        />
        <Field label="Project" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
        <Field
          label="Ship date"
          type="date"
          value={packingShipDate}
          onChange={(e) => setPackingShipDate(e.target.value)}
        />
      </Accordion>
      <Accordion title="Ship from" defaultOpen>
        <ContactFieldSelect
          label="Ship from"
          scope="party"
          contacts={contacts}
          value={fromName}
          onPick={applyFromContact}
          emptyLabel="Select ship from…"
        />
        <Field label="Address" value={fromAddr} onChange={(e) => setFromAddr(e.target.value)} />
      </Accordion>
      <Accordion title="Ship to" defaultOpen>
        <ContactFieldSelect
          label="Ship to"
          scope="client"
          contacts={contacts}
          value={toName}
          onPick={applyToContact}
          emptyLabel="Select client…"
        />
        <Field label="Address" value={toAddr} onChange={(e) => setToAddr(e.target.value)} />
      </Accordion>
      <Accordion title="Line items" defaultOpen>
        {lines.map((l, i) => (
          <div key={l.id} className="grid gap-2 rounded-lg border border-slate-100 p-3 sm:grid-cols-3">
            <Field
              label="Description"
              value={l.description}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...l, description: e.target.value };
                setLines(next);
              }}
            />
            <Field
              label="Qty"
              value={l.units}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...l, units: e.target.value };
                setLines(next);
              }}
            />
            <Field
              label="Cartons"
              value={l.price}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...l, price: e.target.value };
                setLines(next);
              }}
            />
          </div>
        ))}
        <button
          type="button"
          className="text-xs font-semibold text-violet-600 hover:underline"
          onClick={() => setLines((prev) => [...prev, { id: String(Date.now()), description: "", units: "1", price: "0" }])}
        >
          + Add line
        </button>
      </Accordion>
      <Accordion title="Notes">
        <TextAreaField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Accordion>
    </>
  );

  const formTracking = (
    <Accordion title="Tracking" defaultOpen>
      <Field label="Carrier" value={trackCarrier} onChange={(e) => setTrackCarrier(e.target.value)} />
      <Field label="Tracking #" value={trackNo} onChange={(e) => setTrackNo(e.target.value)} />
    </Accordion>
  );

  const formTask = (
    <Accordion title="Task" defaultOpen>
      <Field label="Title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
      <ContactFieldSelect
        label="Assignee"
        scope="all"
        contacts={contacts}
        value={taskAssignee}
        onPick={(c) => setTaskAssignee(c ? contactFieldsFromPick(c, contacts).name : "")}
        emptyLabel="Select person…"
      />
    </Accordion>
  );

  const CALENDAR_TYPES: { value: CalendarEventType; label: string }[] = [
    { value: "meeting", label: "Meeting" },
    { value: "sample_review", label: "Sample review" },
    { value: "deadline", label: "Deadline" },
    { value: "shipping", label: "Shipping" },
    { value: "production", label: "Production" },
    { value: "other", label: "Other" },
  ];

  const formCal = (
    <>
      <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-950">
        New events are saved to your <strong>Calendar</strong> when you send to chat (this browser).
      </p>
      <Accordion title="Event details" defaultOpen>
        <Field label="Title" value={calTitle} onChange={(e) => setCalTitle(e.target.value)} />
        <SearchableSelect
          label="Type"
          options={CALENDAR_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          value={calType}
          onChange={(v) => setCalType(v as CalendarEventType)}
          placeholder="Search event type…"
          emptyMessage="No matching type"
        />
        <Field label="Date" type="date" value={calDate} onChange={(e) => setCalDate(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start" type="time" value={calStart} onChange={(e) => setCalStart(e.target.value)} />
          <Field label="End" type="time" value={calEnd} onChange={(e) => setCalEnd(e.target.value)} />
        </div>
        <Field label="Where / link" value={calWhere} onChange={(e) => setCalWhere(e.target.value)} />
        <TextAreaField label="Notes" value={calDesc} onChange={(e) => setCalDesc(e.target.value)} />
      </Accordion>
    </>
  );

  const formBody =
    kind === "invoice"
      ? formInvoice
      : kind === "quote"
        ? formQuote
        : kind === "purchase_order"
          ? formPO
          : kind === "job"
            ? formJob
            : kind === "estimate"
            ? formEstimate
            : kind === "approval"
              ? formApproval
              : kind === "payment"
                ? formPayment
                : kind === "receiving"
                  ? formReceiving
                  : kind === "packing_list"
                    ? formPackingList
                    : kind === "tracking"
                    ? formTracking
                    : kind === "task"
                      ? formTask
                      : formCal;

  const previewBody =
    kind === "invoice" ? (
      previewInvoice
    ) : kind === "quote" ? (
      <PreviewShell docLabel="Quote" docNumber={quoteNo}>
        <p className="mt-4 text-sm text-slate-600">Valid until {quoteValid}</p>
        <p className="mt-6 text-2xl font-bold text-slate-900">${Number(quoteTotal).toLocaleString()}</p>
        <p className="mt-4 text-sm text-slate-700">{roomTitle}</p>
      </PreviewShell>
    ) : kind === "purchase_order" ? (
      <PreviewShell docLabel="Purchase Order" docNumber={poNo}>
        <p className="mt-4 text-sm text-slate-700">Vendor: {vendor}</p>
        <p className="mt-2 text-sm text-slate-600">Ship target: {poShip}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{poLines}</p>
      </PreviewShell>
    ) : kind === "job" ? (
      <PreviewShell docLabel="Job" docNumber={jobStyleNumber || "—"}>
        <p className="mt-4 text-lg font-bold text-slate-900">{jobName}</p>
        <p className="mt-1 text-sm text-slate-600">{jobSubtitle}</p>
        {jobColorway ? <p className="mt-1 text-sm text-slate-600">{jobColorway}</p> : null}
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase text-slate-400">Type</dt>
            <dd className="mt-0.5 text-slate-800">{jobType}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-slate-400">Status</dt>
            <dd className="mt-0.5 font-medium text-violet-700">{jobStatus}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-slate-400">Lead vendor</dt>
            <dd className="mt-0.5 text-slate-800">{jobLeadVendor}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase text-slate-400">Category</dt>
            <dd className="mt-0.5 text-slate-800">{jobCategory}</dd>
          </div>
          {jobPoNumber ? (
            <div>
              <dt className="text-[11px] font-semibold uppercase text-slate-400">PO #</dt>
              <dd className="mt-0.5 text-slate-800">{jobPoNumber}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-4 text-xs text-slate-500">Due {jobDue || "—"}</p>
      </PreviewShell>
    ) : kind === "estimate" ? (
      <PreviewShell docLabel="Estimate" docNumber={estNo}>
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{estScope}</p>
        <p className="mt-6 text-xl font-bold text-slate-900">${Number(quoteTotal).toLocaleString()} est.</p>
      </PreviewShell>
    ) : kind === "approval" ? (
      <PreviewShell docLabel="Approval" docNumber={approvalFile}>
        <p className="mt-4 text-sm text-slate-700">{approvalNote}</p>
      </PreviewShell>
    ) : kind === "payment" ? (
      <PreviewShell docLabel="Payment request" docNumber={`$${payAmount}`}>
        <p className="mt-4 text-sm text-slate-700">{payNote}</p>
      </PreviewShell>
    ) : kind === "receiving" ? (
      <PreviewShell docLabel="Receiving" docNumber={recvBol}>
        <p className="mt-4 text-sm text-slate-700">{recvSummary}</p>
      </PreviewShell>
    ) : kind === "packing_list" ? (
      <PreviewShell docLabel="Packing list" docNumber={packingListNo}>
        <p className="mt-2 text-center text-lg font-bold uppercase tracking-wide text-slate-900">
          {packingCompanyName}
        </p>
        <p className="text-center text-xs text-slate-500">Ship date {packingShipDate}</p>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">From</p>
            <p className="font-semibold text-slate-900">{fromName}</p>
            <p className="text-slate-600">{fromAddr}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Ship to</p>
            <p className="font-semibold text-slate-900">{toName}</p>
            <p className="text-slate-600">{toAddr}</p>
          </div>
        </div>
        <table className="mt-6 w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-2">Description</th>
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 text-right">Ctns</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-2 pr-2 text-slate-800">{l.description}</td>
                <td className="py-2 pr-2 text-right text-slate-600">{l.units}</td>
                <td className="py-2 text-right text-slate-600">{l.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right text-sm font-bold text-slate-900">Total {packingTotalPieces} pcs</p>
      </PreviewShell>
    ) : kind === "tracking" ? (
      <PreviewShell docLabel="Tracking" docNumber={trackNo}>
        <p className="mt-4 text-sm text-slate-700">{trackCarrier}</p>
      </PreviewShell>
    ) : kind === "task" ? (
      <PreviewShell docLabel="Task" docNumber={taskTitle}>
        <p className="mt-4 text-sm text-slate-700">Assignee: {taskAssignee}</p>
      </PreviewShell>
    ) : (
      <PreviewShell docLabel="Calendar" docNumber={calWhen}>
        <p className="mt-4 text-sm text-slate-800">{calTitle}</p>
        <p className="mt-2 text-sm text-slate-600">{calWhere}</p>
      </PreviewShell>
    );

  const formTitle =
    kind === "invoice"
      ? "Create New Invoice"
      : kind === "quote"
        ? "Create New Quote"
        : kind === "purchase_order"
          ? "Create Purchase Order"
          : kind === "job"
            ? "Share Job"
            : kind === "estimate"
            ? "Create Estimate"
            : kind === "approval"
              ? "Request Approval"
              : kind === "payment"
                ? "Request Payment"
                : kind === "receiving"
                  ? "Receiving document"
                  : kind === "packing_list"
                    ? "Share Packing List"
                    : kind === "tracking"
                    ? "Add Tracking"
                    : kind === "task"
                      ? "Add Task"
                      : "Share Calendar Event";

  const displayTitle = mode === "edit" ? formTitle.replace(/^Create /, "Edit ") : formTitle;
  const showPreview = kind !== "calendar_event";
  const showSourcePicker = Boolean(linkedProject) || kind === "calendar_event";

  return (
    <>
    <div className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/50 p-0 sm:p-4">
      <button type="button" className="absolute inset-0 z-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add to chat</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{displayTitle}</h2>
              <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                {meta.title}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Room: {roomTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {showPreview ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setPreviewOpen(true)}
              >
                Preview
              </button>
            ) : null}
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700" onClick={send}>
              Save to chat
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav
            aria-label="Attachment types"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2 lg:w-60 lg:flex-col lg:gap-0.5 lg:overflow-x-hidden lg:overflow-y-auto lg:border-b-0 lg:border-r"
          >
            <p className="hidden shrink-0 px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 lg:block">
              Attachment type
            </p>
            {KIND_META.map((k) => {
              const selected = kind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => handleKindChange(k.id)}
                  className={`flex w-full min-w-[10rem] shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors lg:min-w-0 ${
                    selected
                      ? "bg-violet-600 text-white shadow-sm ring-2 ring-violet-400/40"
                      : "text-slate-700 hover:bg-white"
                  }`}
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                      selected ? "bg-white/15 text-white" : "bg-white text-slate-500 shadow-sm"
                    }`}
                  >
                    <KindIcon kind={k.id} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold ${selected ? "text-white" : ""}`}>
                      {k.title}
                      {selected ? (
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-200">
                          Selected
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`line-clamp-2 text-[11px] ${selected ? "text-violet-100" : "text-slate-500"}`}
                    >
                      {k.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white p-4 sm:p-6" role="tabpanel">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-600 lg:hidden">
              {meta.title} — selected
            </p>
            <p className="mb-4 text-sm text-slate-600">{meta.description}</p>
            {showSourcePicker ? (
              <AttachmentSourcePicker
                label={sourcePickerLabel(kind)}
                options={sourceOptions}
                value={selectedSourceId}
                emptyHint={
                  kind === "calendar_event"
                    ? "No calendar events yet — create one below"
                    : `No saved ${sourcePickerLabel(kind).toLowerCase()} on this project yet`
                }
                onSelect={handleSelectSource}
                onCreateNew={handleCreateNewKind}
                createLabel={
                  kind === "job"
                    ? "+ Create new job"
                    : kind === "packing_list"
                      ? "+ Create new packing list"
                      : kind === "calendar_event"
                        ? "+ Create new event"
                        : "+ Create new"
                }
                extraActions={
                  kind === "job" && jobId ? (
                    <button
                      type="button"
                      onClick={() => setJobModal({ kind: "edit", jobId })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit job details
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                <p className="text-xs text-amber-950">
                  This conversation is not linked to a project — fill in details manually, or use{" "}
                  <strong>Create new</strong> to start a blank form.
                </p>
                <button
                  type="button"
                  onClick={handleCreateNewKind}
                  className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                >
                  + Create new
                </button>
              </div>
            )}
            {formBody}
          </div>
        </div>
      </div>
    </div>
    {showPreview ? (
      <AttachmentPreviewModal
        open={previewOpen}
        title={displayTitle}
        subtitle={linkedProjectName ? `Project: ${linkedProjectName}` : roomTitle}
        onClose={() => setPreviewOpen(false)}
      >
        {previewBody}
      </AttachmentPreviewModal>
    ) : null}
    {jobModalJob && linkedProject ? (
      <JobDetailsModal
        project={linkedProject}
        job={jobModalJob}
        allJobs={projectJobs}
        clientCode={clientCode}
        vendors={vendors}
        isNew={jobModal?.kind === "new"}
        overlayClassName="z-[210]"
        onClose={() => setJobModal(null)}
        onSave={handleComposerJobSave}
      />
    ) : null}
    </>
  );
}
