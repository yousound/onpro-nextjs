import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { gmailReauthPayload, isGmailReauthRequiredError } from "@/lib/gmail/auth-errors";
import { fetchGmailThreadById } from "@/lib/gmail/fetch-threads";
import { findGmailThreadForOutbound } from "@/lib/gmail/threading";
import { sendGmailMessage } from "@/lib/gmail/send-message";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import { packOutboundAttachments } from "@/lib/documents/optimize-outbound-attachments";
import {
  resolveDocumentAttachmentBytes,
  resolveProductionDocumentAttachment,
} from "@/lib/documents/resolve-outbound-attachment-bytes";
import { emailBodyPreview } from "@/lib/email-body";
import { resolveProjectWriteOperator } from "@/lib/server/project-workspace-access";
import {
  getGmailConnectionForUser,
  getValidGmailAccessToken,
} from "@/lib/supabase/gmail-connection";
import { upsertInboxThreads } from "@/lib/supabase/gmail-inbox-cache";
import { insertOutboundMessage } from "@/lib/supabase/outbound-messages";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_ATTACHMENTS = 12;

type SendPayload = {
  toName?: string;
  toEmail?: string;
  ccEmails?: string[];
  subject?: string;
  body?: string;
  htmlBody?: string;
  fromName?: string;
  projectId?: number;
  jobId?: string | null;
  vendorQuoteId?: string | null;
  estimateId?: string | null;
  category?: string;
  mailroomThreadId?: string | null;
  documentIds?: number[];
  productionDocuments?: ProductionDocument[];
  attachQuoteDocument?: boolean;
};

function parseEmails(raw: string[] | undefined): string[] {
  return (raw ?? []).map((e) => e.trim()).filter(Boolean);
}

/** Live: send outbound email via connected Gmail (vendor quotes, estimates, etc.). */
export async function POST(request: Request) {
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.json({ error: "Live backend required" }, { status: 400 });
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json({ error: "Gmail OAuth not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connection = await getGmailConnectionForUser(user.id);
  if (!connection?.email) {
    return NextResponse.json(
      { error: "Connect Gmail in Mailroom before sending." },
      { status: 400 },
    );
  }

  const payload = (await request.json()) as SendPayload;
  const toEmail = payload.toEmail?.trim() ?? "";
  const subject = payload.subject?.trim() ?? "";
  const body = payload.body?.trim() ?? "";

  if (!toEmail) return NextResponse.json({ error: "toEmail is required" }, { status: 400 });
  if (!subject) return NextResponse.json({ error: "subject is required" }, { status: 400 });
  if (!body && !payload.htmlBody?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const ccEmails = parseEmails(payload.ccEmails);
  const documentIds = (payload.documentIds ?? []).filter((id) => Number.isFinite(id));
  const productionDocuments = payload.productionDocuments ?? [];

  try {
    const { accessToken } = await getValidGmailAccessToken(connection);

    const sources = [];

    if (payload.attachQuoteDocument !== false) {
      for (const doc of productionDocuments) {
        sources.push(resolveProductionDocumentAttachment(doc));
      }
    }

    for (const docId of documentIds.slice(0, MAX_ATTACHMENTS)) {
      const att = await resolveDocumentAttachmentBytes(supabase, docId, payload.projectId);
      if (att) sources.push(att);
    }

    const packed = await packOutboundAttachments(sources);
    const htmlWithLinks = [payload.htmlBody?.trim(), packed.htmlAppendix]
      .filter(Boolean)
      .join("");

    const threadMatch = await findGmailThreadForOutbound(accessToken, {
      mailroomThreadId: payload.mailroomThreadId,
      subject,
      toEmail,
    });

    const fromName = payload.fromName?.trim() || "Connect Dots";
    const sent = await sendGmailMessage(accessToken, {
      fromName,
      fromEmail: connection.email,
      to: [{ name: payload.toName?.trim() || toEmail, email: toEmail }],
      cc: ccEmails.map((email) => ({ name: email.split("@")[0] ?? email, email })),
      subject,
      textBody: body || payload.htmlBody?.replace(/<[^>]+>/g, " ") || "",
      htmlBody: htmlWithLinks || undefined,
      inReplyTo: threadMatch?.inReplyTo,
      references: threadMatch?.references,
      attachments: packed.attachments,
      threadId: threadMatch?.threadId,
    });

    const thread = await fetchGmailThreadById(accessToken, sent.threadId, {
      format: "metadata",
      resolveInlineImages: false,
    });

    if (thread) {
      await upsertInboxThreads(user.id, [thread]).catch((e) =>
        console.warn("[gmail/send] inbox cache upsert failed", e),
      );
    }

    let operatorUserId = user.id;
    if (payload.projectId != null) {
      try {
        operatorUserId = await resolveProjectWriteOperator(supabase, user.id, payload.projectId);
      } catch {
        operatorUserId = user.id;
      }
    }

    const attachmentManifest = [
      ...packed.attachments.map((a) => ({
        filename: a.filename,
        mime_type: a.mimeType,
        size_bytes: a.bytes.length,
        document_id: a.documentId,
        attached: true,
      })),
      ...packed.linked.map((l) => ({
        filename: l.filename,
        mime_type: "link",
        size_bytes: 0,
        document_id: l.documentId,
        attached: false,
      })),
    ];

    await insertOutboundMessage(supabase, {
      userId: user.id,
      operatorUserId,
      projectId: payload.projectId ?? null,
      jobId: payload.jobId ?? null,
      vendorQuoteId: payload.vendorQuoteId ?? null,
      estimateId: payload.estimateId ?? null,
      category: payload.category ?? "vendor_quote",
      gmailThreadId: sent.threadId,
      gmailMessageId: sent.id,
      toEmail,
      toName: payload.toName ?? null,
      ccEmails,
      subject,
      bodyPreview: emailBodyPreview(body || htmlWithLinks, 240),
      htmlBody: htmlWithLinks || null,
      attachmentManifest,
      linkedAttachmentUrls: packed.linked.map((l) => ({
        filename: l.filename,
        url: l.url,
        document_id: l.documentId,
        reason: l.reason,
      })),
    });

    return NextResponse.json({
      ok: true,
      gmailMessageId: sent.id,
      gmailThreadId: sent.threadId,
      mailroomThreadId: `gmail-${sent.threadId}`,
      attachmentCount: packed.attachments.length,
      linkedAttachmentCount: packed.linked.length,
      fromEmail: connection.email,
      thread,
    });
  } catch (e) {
    console.error("[api/mailroom/gmail/send]", e);
    if (isGmailReauthRequiredError(e)) {
      return NextResponse.json(gmailReauthPayload(), { status: 403 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send email" },
      { status: 502 },
    );
  }
}
