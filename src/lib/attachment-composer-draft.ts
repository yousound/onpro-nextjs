import type { DocumentRow } from "@/lib/types/documents";

export type ChatAttachmentKind =
  | "job"
  | "estimate"
  | "quote"
  | "approval"
  | "purchase_order"
  | "payment"
  | "invoice"
  | "receiving"
  | "tracking"
  | "task"
  | "calendar_event";

export type ComposerLineDraft = {
  id: string;
  description: string;
  units: string;
  price: string;
};

/** Full form snapshot for reopen / edit (mock). */
export type AttachmentComposerDraft = {
  v: 1;
  kind: ChatAttachmentKind;
  invoiceNo: string;
  projectName: string;
  issued: string;
  due: string;
  fromName: string;
  fromAddr: string;
  fromEmail: string;
  toName: string;
  toAddr: string;
  lines: ComposerLineDraft[];
  notes: string;
  bank: string;
  quoteNo: string;
  quoteValid: string;
  quoteScope: string;
  quoteTotal: string;
  poNo: string;
  vendor: string;
  poShip: string;
  poLines: string;
  estNo: string;
  estScope: string;
  jobName: string;
  jobSubtitle: string;
  jobType: string;
  jobLeadVendor: string;
  jobCategory: string;
  jobStyleNumber: string;
  jobStatus: string;
  jobDue: string;
  approvalFile: string;
  approvalNote: string;
  payAmount: string;
  payNote: string;
  recvBol: string;
  recvSummary: string;
  trackCarrier: string;
  trackNo: string;
  taskTitle: string;
  taskAssignee: string;
  calTitle: string;
  calWhen: string;
  calWhere: string;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function defaultAttachmentComposerDraft(roomTitle: string, refDate = new Date()): AttachmentComposerDraft {
  const due = new Date(refDate);
  due.setDate(due.getDate() + 5);
  const quoteValid = new Date(refDate);
  quoteValid.setDate(quoteValid.getDate() + 14);
  const poShip = new Date(refDate);
  poShip.setDate(poShip.getDate() + 21);
  const jobDue = new Date(refDate);
  jobDue.setDate(jobDue.getDate() + 45);
  return {
    v: 1,
    kind: "invoice",
    invoiceNo: "INV-2026-0142",
    projectName: "Filllo Product Design",
    issued: isoDate(refDate),
    due: isoDate(due),
    fromName: "Connect Dots",
    fromAddr: "123 Mill St, Los Angeles, CA",
    fromEmail: "ops@connectdots.example",
    toName: roomTitle,
    toAddr: "Client HQ — sample address",
    lines: [
      { id: "1", description: "Web & App Design", units: "1", price: "1500" },
      { id: "2", description: "Logo Design", units: "1", price: "1500" },
    ],
    notes: "Late fees may apply after the due date.",
    bank: "Routing · Account on file",
    quoteNo: "QT-2026-0091",
    quoteValid: isoDate(quoteValid),
    quoteScope: "Sampling, revisions, and delivery milestones.",
    quoteTotal: "3000",
    poNo: "PO-2026-0331",
    vendor: "CA Factory",
    poShip: isoDate(poShip),
    poLines: "Bulk fleece — 2,400 units · 3 colorways",
    estNo: "EST-2026-0044",
    estScope: "Sampling + TOP cycle for capsule.",
    jobName: "Olive capsule",
    jobSubtitle: "Print / Decoration on blanks",
    jobType: "PRINT / DECORATION ON BLANKS",
    jobLeadVendor: "CA",
    jobCategory: "SWEATSHIRT",
    jobStyleNumber: "GGP15-OLV",
    jobStatus: "In progress",
    jobDue: isoDate(jobDue),
    approvalFile: "strike-off-v2.pdf",
    approvalNote: "Please approve for bulk.",
    payAmount: "3350.00",
    payNote: "Net 30 · ACH preferred",
    recvBol: "BOL-99821",
    recvSummary: "2 cartons · Glo Gang bulk",
    trackCarrier: "FedEx",
    trackNo: "7844 1200 3391",
    taskTitle: "Upload TOP photos",
    taskAssignee: roomTitle,
    calTitle: "Lab dip review — Mind Body",
    calWhen: "Wed 2:30 PM",
    calWhere: "Zoom",
  };
}

function isChatKind(k: string): k is ChatAttachmentKind {
  return (
    k === "job" ||
    k === "estimate" ||
    k === "quote" ||
    k === "approval" ||
    k === "purchase_order" ||
    k === "payment" ||
    k === "invoice" ||
    k === "receiving" ||
    k === "tracking" ||
    k === "task" ||
    k === "calendar_event"
  );
}

/** Accept saved JSON / unknown and coerce to a full draft (mock). */
export function coerceAttachmentComposerDraft(raw: unknown, roomTitle: string): AttachmentComposerDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<AttachmentComposerDraft>;
  if (o.v !== 1) return null;
  if (!o.kind || !isChatKind(o.kind)) return null;
  const base = defaultAttachmentComposerDraft(roomTitle);
  const lines = Array.isArray(o.lines)
    ? (o.lines as ComposerLineDraft[]).map((l, i) => ({
        id: String(l?.id ?? i + 1),
        description: String(l?.description ?? ""),
        units: String(l?.units ?? "1"),
        price: String(l?.price ?? "0"),
      }))
    : base.lines;
  return {
    ...base,
    ...o,
    kind: o.kind,
    lines,
  };
}

/** When a thread card has no snapshot (e.g. legacy mock), infer what we can from the card. */
export function fallbackDraftFromSmartAttachment(
  a: { kind: string; title: string; subtitle?: string; badge?: string },
  roomTitle: string,
): AttachmentComposerDraft {
  const base = defaultAttachmentComposerDraft(roomTitle);
  const kind = isChatKind(a.kind) ? a.kind : "invoice";
  const next = { ...base, kind };

  switch (kind) {
    case "invoice": {
      const m = /^Invoice\s+(.+)$/i.exec(a.title.trim());
      return {
        ...next,
        invoiceNo: m?.[1]?.trim() || base.invoiceNo,
        projectName: a.subtitle?.trim() || base.projectName,
      };
    }
    case "quote": {
      const m = /^Quote\s+(.+)$/i.exec(a.title.trim());
      const amt = a.badge?.replace(/^\$/, "").trim();
      return {
        ...next,
        quoteNo: m?.[1]?.trim() || base.quoteNo,
        quoteTotal: amt && !Number.isNaN(Number(amt)) ? amt : base.quoteTotal,
      };
    }
    case "purchase_order": {
      const m = /^PO\s+(.+)$/i.exec(a.title.trim());
      return {
        ...next,
        poNo: m?.[1]?.trim() || base.poNo,
        poShip: a.badge && /^\d{4}-\d{2}-\d{2}$/.test(a.badge) ? a.badge : base.poShip,
        vendor: a.subtitle?.split("·")[0]?.trim() || base.vendor,
        poLines: a.subtitle?.split("·").slice(1).join("·").trim() || a.subtitle || base.poLines,
      };
    }
    case "job":
      return {
        ...next,
        jobName: a.title.trim() || base.jobName,
        jobSubtitle: a.subtitle?.trim() || base.jobSubtitle,
        jobStatus: a.badge?.trim() || base.jobStatus,
      };
    case "estimate": {
      const m = /^Estimate\s+(.+)$/i.exec(a.title.trim());
      return { ...next, estNo: m?.[1]?.trim() || base.estNo };
    }
    case "approval":
      return { ...next, approvalFile: a.title.trim() || base.approvalFile, approvalNote: a.subtitle || base.approvalNote };
    case "payment": {
      const m = /^Payment\s+\$?([\d.,]+)/i.exec(a.title.trim());
      return {
        ...next,
        payAmount: m?.[1]?.replace(/,/g, "") || base.payAmount,
        payNote: a.subtitle || base.payNote,
      };
    }
    case "receiving":
      return { ...next, recvBol: a.title.trim() || base.recvBol, recvSummary: a.subtitle || base.recvSummary };
    case "tracking":
      return {
        ...next,
        trackNo: a.title.trim() || base.trackNo,
        trackCarrier: a.subtitle?.split("·")[0]?.trim() || base.trackCarrier,
      };
    case "task":
      return {
        ...next,
        taskTitle: a.title.trim() || base.taskTitle,
        taskAssignee: a.subtitle?.replace(/^Assignee:\s*/i, "").trim() || roomTitle,
      };
    case "calendar_event": {
      const parts = (a.subtitle ?? "").split("·").map((s) => s.trim());
      return {
        ...next,
        calTitle: a.title.trim() || base.calTitle,
        calWhen: parts[0] || base.calWhen,
        calWhere: parts[1] || base.calWhere,
      };
    }
    default:
      return next;
  }
}

/** Open composer from a library row (invoice / quote / tech pack → estimate shell). */
export function draftFromDocumentRow(doc: DocumentRow, roomTitle: string): AttachmentComposerDraft {
  const base = defaultAttachmentComposerDraft(roomTitle);
  const label = doc.project_name?.trim() || roomTitle;
  if (doc.kind === "invoice") {
    return {
      ...base,
      kind: "invoice",
      projectName: label,
      toName: roomTitle,
      notes: doc.name,
    };
  }
  if (doc.kind === "quote") {
    return {
      ...base,
      kind: "quote",
      quoteScope: doc.name,
      toName: roomTitle,
    };
  }
  if (doc.kind === "tech_pack") {
    return {
      ...base,
      kind: "estimate",
      estScope: `${doc.name}\n\nTech pack — edit details below.`,
      toName: roomTitle,
    };
  }
  return {
    ...base,
    kind: "approval",
    approvalFile: doc.name,
    approvalNote: doc.project_name ? `Linked project: ${doc.project_name}` : base.approvalNote,
    toName: roomTitle,
  };
}
