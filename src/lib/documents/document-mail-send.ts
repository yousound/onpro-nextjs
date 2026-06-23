import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { sendGmailOutboundViaApi } from "@/lib/data/mailroom-api";
import {
  buildQuoteDocumentFileAttachment,
  documentRowsToFileAttachments,
} from "@/lib/documents/document-mail-attachments";
import {
  addPromotedThread,
  appendOutboundReply,
  loadMailroomState,
} from "@/lib/mailroom-state";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import type { DocumentRow } from "@/lib/types/documents";
import type { EmailFileAttachment, EmailMessage, EmailThread } from "@/lib/types/agent";
import type { ProjectJob } from "@/lib/types/wip";
import {
  buildVendorQuoteHtmlBody,
  defaultVendorQuoteSubject,
} from "@/lib/documents/vendor-quote-compose";

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type DocumentMailCategory = "vendor_quote" | "client";

export type SendProductionDocumentInput = {
  document: ProductionDocument;
  toName: string;
  toEmail: string;
  ccEmails?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  fromEmail: string;
  fromName?: string;
  projectId: number;
  jobId: string;
  category: DocumentMailCategory;
  vendorName?: string;
  /** Project library files to attach (mockups, tech packs). */
  libraryDocuments?: DocumentRow[];
  /** Include formatted quote document as attachment. */
  attachQuoteDocument?: boolean;
  vendorQuoteId?: string | null;
  estimateId?: string | null;
};

export type SendCombinedVendorQuoteInput = {
  jobs: ProjectJob[];
  toName: string;
  toEmail: string;
  ccEmails?: string[];
  subject: string;
  body: string;
  htmlBody: string;
  fromEmail: string;
  fromName?: string;
  projectId: number;
  vendorName?: string;
  libraryDocuments?: DocumentRow[];
  quoteDocuments?: ProductionDocument[];
};

export type SendProductionDocumentResult = {
  threadId: string;
  messageId: string;
  createdThread: boolean;
  /** True when delivered via Gmail API (live mode). */
  sentViaGmail?: boolean;
};

function findExistingThread(
  threads: EmailThread[],
  toEmail: string,
  projectId: number,
  category: DocumentMailCategory,
): EmailThread | undefined {
  const key = normEmail(toEmail);
  if (!key) return undefined;
  return threads.find((t) => {
    if (t.category !== category) return false;
    if (t.related?.project_id !== projectId) return false;
    return t.participants.some((p) => normEmail(p.email) === key);
  });
}

function buildThread(input: {
  subject: string;
  toName: string;
  toEmail: string;
  ccEmails?: string[];
  fromEmail: string;
  fromName?: string;
  projectId: number;
  jobId?: string;
  category: DocumentMailCategory;
  vendorName?: string;
}): EmailThread {
  const toEmail = input.toEmail.trim();
  const cc = (input.ccEmails ?? [])
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ name: email.split("@")[0] ?? email, email }));

  return {
    id: makeId("thread"),
    subject: input.subject.trim(),
    participants: [
      { name: input.toName.trim() || toEmail, email: toEmail },
      { name: input.fromName?.trim() || "Connect Dots", email: input.fromEmail.trim() },
      ...cc,
    ],
    messages: [],
    status: "read",
    category: input.category,
    channel: "email",
    related: {
      project_id: input.projectId,
      job_id: input.jobId,
      vendor: input.vendorName,
    },
  };
}

function attachmentKind(document: ProductionDocument): "vendor_quote" | "estimate" {
  return document.kind === "vendor_po" || document.kind === "vendor_quote"
    ? "vendor_quote"
    : "estimate";
}

function defaultSubject(document: ProductionDocument): string {
  if (document.kind === "vendor_po") {
    return `Purchase order ${document.documentNumber} from Connect Dots`;
  }
  if (document.kind === "vendor_quote") {
    return `Quote request ${document.documentNumber} from Connect Dots`;
  }
  return `Estimate ${document.documentNumber} from Connect Dots`;
}

function defaultBody(document: ProductionDocument): string {
  if (document.kind === "vendor_po") {
    return `Hi,\n\nPlease find the attached purchase order ${document.documentNumber}.\n\nThank you,\nConnect Dots`;
  }
  if (document.kind === "vendor_quote") {
    return `Hi,\n\nPlease review the attached quote request ${document.documentNumber} and send your pricing at your earliest convenience.\n\nThank you,\nConnect Dots`;
  }
  return `Hi,\n\nPlease find attached estimate ${document.documentNumber} for your review.\n\nThank you,\nConnect Dots`;
}

export function defaultComposeSubject(document: ProductionDocument): string {
  return defaultSubject(document);
}

export function defaultComposeBody(document: ProductionDocument): string {
  return defaultBody(document);
}

async function buildOutboundFileAttachments(input: {
  document?: ProductionDocument;
  attachQuoteDocument?: boolean;
  libraryDocuments?: DocumentRow[];
  quoteDocuments?: ProductionDocument[];
}): Promise<EmailFileAttachment[]> {
  const out: EmailFileAttachment[] = [];

  if (input.attachQuoteDocument !== false && input.document) {
    out.push(await buildQuoteDocumentFileAttachment(input.document));
  }

  for (const doc of input.quoteDocuments ?? []) {
    out.push(await buildQuoteDocumentFileAttachment(doc));
  }

  if (input.libraryDocuments?.length) {
    out.push(...(await documentRowsToFileAttachments(input.libraryDocuments)));
  }

  return out;
}

function appendOutboundMailMessage(
  threadId: string,
  msg: EmailMessage,
): SendProductionDocumentResult {
  appendOutboundReply(threadId, msg);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("onpro-mailroom-state-changed"));
  }

  return { threadId, messageId: msg.id, createdThread: false };
}

function fileAttachmentLabels(docs: DocumentRow[]): EmailFileAttachment[] {
  return docs.map((doc) => ({
    id: makeId("doc"),
    filename: doc.file_name?.trim() || doc.name?.trim() || `document-${doc.id}`,
    mimeType: "application/octet-stream",
    document_id: doc.id,
    label: doc.name?.trim() || doc.file_name?.trim() || `document-${doc.id}`,
  }));
}

async function sendLiveOutbound(input: {
  toName: string;
  toEmail: string;
  ccEmails?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  fromName?: string;
  projectId: number;
  jobId?: string;
  vendorQuoteId?: string | null;
  estimateId?: string | null;
  category?: DocumentMailCategory;
  mailroomThreadId?: string | null;
  documentIds: number[];
  productionDocuments: ProductionDocument[];
  attachQuoteDocument?: boolean;
  outboxMsg: EmailMessage;
}): Promise<SendProductionDocumentResult> {
  const apiResult = await sendGmailOutboundViaApi({
    toName: input.toName,
    toEmail: input.toEmail,
    ccEmails: input.ccEmails,
    subject: input.subject,
    body: input.body,
    htmlBody: input.htmlBody,
    fromName: input.fromName,
    projectId: input.projectId,
    jobId: input.jobId ?? null,
    vendorQuoteId: input.vendorQuoteId ?? null,
    estimateId: input.estimateId ?? null,
    category: input.category ?? "vendor_quote",
    mailroomThreadId: input.mailroomThreadId,
    documentIds: input.documentIds,
    productionDocuments: input.productionDocuments,
    attachQuoteDocument: input.attachQuoteDocument,
  });

  const threadId = apiResult.mailroomThreadId;
  const msg: EmailMessage = {
    ...input.outboxMsg,
    id: apiResult.gmailMessageId,
  };
  appendOutboundMailMessage(threadId, msg);

  if (typeof window !== "undefined" && apiResult.thread) {
    window.dispatchEvent(
      new CustomEvent("onpro-gmail-thread-synced", { detail: { thread: apiResult.thread } }),
    );
  }

  return {
    threadId,
    messageId: apiResult.gmailMessageId,
    createdThread: !input.mailroomThreadId,
    sentViaGmail: true,
  };
}

/** Route outbound PO / quote through Mailroom (live → Gmail API; mock → outbox). */
export async function sendProductionDocumentViaMailroom(
  input: SendProductionDocumentInput,
): Promise<SendProductionDocumentResult> {
  const state = loadMailroomState();
  const toEmail = input.toEmail.trim();
  if (!toEmail) {
    throw new Error("Recipient email is required.");
  }

  const existing = findExistingThread(
    state.promoted_threads,
    toEmail,
    input.projectId,
    input.category,
  );

  const cc = (input.ccEmails ?? [])
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ name: email.split("@")[0] ?? email, email }));

  const subject = input.subject.trim() || defaultSubject(input.document);

  if (isClientLiveBackend()) {
    const libraryDocuments = input.libraryDocuments ?? [];
    const outboxMsg: EmailMessage = {
      id: makeId("out"),
      from: {
        name: input.fromName?.trim() || "Connect Dots",
        email: input.fromEmail.trim() || "you@onpro.app",
      },
      at: nowIso(),
      body: input.body.trim(),
      htmlBody: input.htmlBody?.trim() || undefined,
      to: [{ name: input.toName.trim() || toEmail, email: toEmail }],
      cc: cc.length > 0 ? cc : undefined,
      subject,
      attachments: [
        {
          id: makeId("att"),
          kind: attachmentKind(input.document),
          source_id: input.document.documentNumber,
          label:
            input.document.kind === "vendor_po"
              ? `PO ${input.document.documentNumber}`
              : input.document.kind === "vendor_quote"
                ? `Quote ${input.document.documentNumber}`
                : `Estimate ${input.document.documentNumber}`,
          deepLink: `/projects/${input.projectId}`,
        },
      ],
      fileAttachments: fileAttachmentLabels(libraryDocuments),
    };

    return sendLiveOutbound({
      toName: input.toName,
      toEmail,
      ccEmails: input.ccEmails,
      subject,
      body: input.body.trim(),
      htmlBody: input.htmlBody,
      fromName: input.fromName,
      projectId: input.projectId,
      jobId: input.jobId,
      vendorQuoteId: input.vendorQuoteId,
      estimateId: input.estimateId,
      category: input.category,
      mailroomThreadId: existing?.id ?? null,
      documentIds: libraryDocuments.map((d) => d.id),
      productionDocuments:
        input.attachQuoteDocument !== false ? [input.document] : [],
      attachQuoteDocument: input.attachQuoteDocument,
      outboxMsg,
    });
  }

  let threadId: string;
  let createdThread = false;

  if (existing) {
    threadId = existing.id;
  } else {
    const thread = buildThread({ ...input, category: input.category });
    addPromotedThread(thread);
    threadId = thread.id;
    createdThread = true;
  }

  const fileAttachments = await buildOutboundFileAttachments({
    document: input.document,
    attachQuoteDocument: input.attachQuoteDocument,
    libraryDocuments: input.libraryDocuments,
  });

  const msg: EmailMessage = {
    id: makeId("out"),
    from: {
      name: input.fromName?.trim() || "Connect Dots",
      email: input.fromEmail.trim() || "you@onpro.app",
    },
    at: nowIso(),
    body: input.body.trim(),
    htmlBody: input.htmlBody?.trim() || undefined,
    to: [{ name: input.toName.trim() || toEmail, email: toEmail }],
    cc: cc.length > 0 ? cc : undefined,
    subject,
    attachments: [
      {
        id: makeId("att"),
        kind: attachmentKind(input.document),
        source_id: input.document.documentNumber,
        label:
          input.document.kind === "vendor_po"
            ? `PO ${input.document.documentNumber}`
            : input.document.kind === "vendor_quote"
              ? `Quote ${input.document.documentNumber}`
              : `Estimate ${input.document.documentNumber}`,
        deepLink: `/projects/${input.projectId}`,
      },
    ],
    fileAttachments: fileAttachments.length > 0 ? fileAttachments : undefined,
  };

  const result = appendOutboundMailMessage(threadId, msg);
  return { ...result, createdThread };
}

/** One email to a vendor covering multiple jobs (combined RFQ). */
export async function sendCombinedVendorQuoteViaMailroom(
  input: SendCombinedVendorQuoteInput,
): Promise<SendProductionDocumentResult> {
  const state = loadMailroomState();
  const toEmail = input.toEmail.trim();
  if (!toEmail) throw new Error("Recipient email is required.");
  if (input.jobs.length === 0) throw new Error("Select at least one job.");

  const existing = findExistingThread(
    state.promoted_threads,
    toEmail,
    input.projectId,
    "vendor_quote",
  );

  const cc = (input.ccEmails ?? [])
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ name: email.split("@")[0] ?? email, email }));

  const subject =
    input.subject.trim() ||
    defaultVendorQuoteSubject(input.jobs, input.quoteDocuments?.[0]);

  const libraryDocuments = input.libraryDocuments ?? [];

  if (isClientLiveBackend()) {
    const outboxMsg: EmailMessage = {
      id: makeId("out"),
      from: {
        name: input.fromName?.trim() || "Connect Dots",
        email: input.fromEmail.trim() || "you@onpro.app",
      },
      at: nowIso(),
      body: input.body.trim(),
      htmlBody: input.htmlBody.trim(),
      to: [{ name: input.toName.trim() || toEmail, email: toEmail }],
      cc: cc.length > 0 ? cc : undefined,
      subject,
      fileAttachments: fileAttachmentLabels(libraryDocuments),
    };

    return sendLiveOutbound({
      toName: input.toName,
      toEmail,
      ccEmails: input.ccEmails,
      subject,
      body: input.body.trim(),
      htmlBody: input.htmlBody,
      fromName: input.fromName,
      projectId: input.projectId,
      jobId: input.jobs[0]?.id,
      category: "vendor_quote",
      mailroomThreadId: existing?.id ?? null,
      documentIds: libraryDocuments.map((d) => d.id),
      productionDocuments: input.quoteDocuments ?? [],
      attachQuoteDocument: false,
      outboxMsg,
    });
  }

  let threadId: string;
  let createdThread = false;

  if (existing) {
    threadId = existing.id;
  } else {
    const thread = buildThread({
      subject: input.subject,
      toName: input.toName,
      toEmail,
      ccEmails: input.ccEmails,
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      projectId: input.projectId,
      jobId: input.jobs[0]?.id,
      category: "vendor_quote",
      vendorName: input.vendorName,
    });
    addPromotedThread(thread);
    threadId = thread.id;
    createdThread = true;
  }

  const fileAttachments = await buildOutboundFileAttachments({
    libraryDocuments: input.libraryDocuments,
    quoteDocuments: input.quoteDocuments,
    attachQuoteDocument: false,
  });

  const msg: EmailMessage = {
    id: makeId("out"),
    from: {
      name: input.fromName?.trim() || "Connect Dots",
      email: input.fromEmail.trim() || "you@onpro.app",
    },
    at: nowIso(),
    body: input.body.trim(),
    htmlBody: input.htmlBody.trim(),
    to: [{ name: input.toName.trim() || toEmail, email: toEmail }],
    cc: cc.length > 0 ? cc : undefined,
    subject,
    fileAttachments: fileAttachments.length > 0 ? fileAttachments : undefined,
  };

  const result = appendOutboundMailMessage(threadId, msg);
  return { ...result, createdThread };
}

export function defaultCombinedVendorQuoteSubject(jobs: ProjectJob[]): string {
  return defaultVendorQuoteSubject(jobs);
}

export function defaultCombinedVendorQuoteHtml(jobs: ProjectJob[]): string {
  return buildVendorQuoteHtmlBody(jobs);
}
