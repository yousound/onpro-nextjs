import {
  addPromotedThread,
  appendOutboundReply,
  loadMailroomState,
} from "@/lib/mailroom-state";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import type { EmailMessage, EmailThread } from "@/lib/types/agent";

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
  fromEmail: string;
  fromName?: string;
  projectId: number;
  jobId: string;
  category: DocumentMailCategory;
  vendorName?: string;
};

export type SendProductionDocumentResult = {
  threadId: string;
  messageId: string;
  createdThread: boolean;
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

function buildThread(input: SendProductionDocumentInput): EmailThread {
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
  return document.kind === "vendor_po" ? "vendor_quote" : "estimate";
}

function defaultSubject(document: ProductionDocument): string {
  if (document.kind === "vendor_po") {
    return `Purchase order ${document.documentNumber} from Connect Dots`;
  }
  return `Estimate ${document.documentNumber} from Connect Dots`;
}

function defaultBody(document: ProductionDocument): string {
  if (document.kind === "vendor_po") {
    return `Hi,\n\nPlease review the attached purchase order ${document.documentNumber} and send your quote at your earliest convenience.\n\nThank you,\nConnect Dots`;
  }
  return `Hi,\n\nPlease find attached estimate ${document.documentNumber} for your review.\n\nThank you,\nConnect Dots`;
}

export function defaultComposeSubject(document: ProductionDocument): string {
  return defaultSubject(document);
}

export function defaultComposeBody(document: ProductionDocument): string {
  return defaultBody(document);
}

/** Route outbound PO / estimate through Mailroom (mock send → outbox). Replies on existing vendor+project thread when found. */
export function sendProductionDocumentViaMailroom(
  input: SendProductionDocumentInput,
): SendProductionDocumentResult {
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

  let threadId: string;
  let createdThread = false;

  if (existing) {
    threadId = existing.id;
  } else {
    const thread = buildThread(input);
    addPromotedThread(thread);
    threadId = thread.id;
    createdThread = true;
  }

  const cc = (input.ccEmails ?? [])
    .map((e) => e.trim())
    .filter(Boolean)
    .map((email) => ({ name: email.split("@")[0] ?? email, email }));

  const msg: EmailMessage = {
    id: makeId("out"),
    from: {
      name: input.fromName?.trim() || "Connect Dots",
      email: input.fromEmail.trim() || "you@onpro.app",
    },
    at: nowIso(),
    body: input.body.trim(),
    to: [{ name: input.toName.trim() || toEmail, email: toEmail }],
    cc: cc.length > 0 ? cc : undefined,
    subject: input.subject.trim() || defaultSubject(input.document),
    attachments: [
      {
        id: makeId("att"),
        kind: attachmentKind(input.document),
        source_id: input.document.documentNumber,
        label:
          input.document.kind === "vendor_po"
            ? `PO ${input.document.documentNumber}`
            : `Estimate ${input.document.documentNumber}`,
        deepLink: `/projects/${input.projectId}`,
      },
    ],
  };

  appendOutboundReply(threadId, msg);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("onpro-mailroom-state-changed"));
  }

  return { threadId, messageId: msg.id, createdThread };
}
