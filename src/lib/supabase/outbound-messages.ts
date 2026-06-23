import type { SupabaseClient } from "@supabase/supabase-js";

export type OutboundMessageAttachmentManifest = {
  filename: string;
  mime_type: string;
  size_bytes: number;
  document_id?: number;
  attached: boolean;
};

export type OutboundMessageLinkedUrl = {
  filename: string;
  url: string;
  document_id?: number;
  reason: string;
};

export type OutboundMessageRow = {
  id: number;
  user_id: string;
  operator_user_id: string;
  project_id: number | null;
  job_id: string | null;
  vendor_quote_id: string | null;
  estimate_id: string | null;
  category: string;
  gmail_thread_id: string;
  gmail_message_id: string;
  mailroom_thread_id: string;
  to_email: string;
  to_name: string | null;
  cc_emails: string[];
  subject: string;
  body_preview: string | null;
  html_body: string | null;
  attachment_manifest: OutboundMessageAttachmentManifest[];
  linked_attachment_urls: OutboundMessageLinkedUrl[];
  sent_at: string;
};

export type InsertOutboundMessageInput = {
  userId: string;
  operatorUserId: string;
  projectId?: number | null;
  jobId?: string | null;
  vendorQuoteId?: string | null;
  estimateId?: string | null;
  category?: string;
  gmailThreadId: string;
  gmailMessageId: string;
  toEmail: string;
  toName?: string | null;
  ccEmails?: string[];
  subject: string;
  bodyPreview?: string | null;
  htmlBody?: string | null;
  attachmentManifest?: OutboundMessageAttachmentManifest[];
  linkedAttachmentUrls?: OutboundMessageLinkedUrl[];
};

export async function insertOutboundMessage(
  supabase: SupabaseClient,
  input: InsertOutboundMessageInput,
): Promise<OutboundMessageRow | null> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .insert({
      user_id: input.userId,
      operator_user_id: input.operatorUserId,
      project_id: input.projectId ?? null,
      job_id: input.jobId ?? null,
      vendor_quote_id: input.vendorQuoteId ?? null,
      estimate_id: input.estimateId ?? null,
      category: input.category ?? "vendor_quote",
      gmail_thread_id: input.gmailThreadId,
      gmail_message_id: input.gmailMessageId,
      mailroom_thread_id: `gmail-${input.gmailThreadId}`,
      to_email: input.toEmail,
      to_name: input.toName ?? null,
      cc_emails: input.ccEmails ?? [],
      subject: input.subject,
      body_preview: input.bodyPreview ?? null,
      html_body: input.htmlBody ?? null,
      attachment_manifest: input.attachmentManifest ?? [],
      linked_attachment_urls: input.linkedAttachmentUrls ?? [],
      sent_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw error;
  }

  return data as OutboundMessageRow;
}

export async function fetchOutboundMessagesForProject(
  supabase: SupabaseClient,
  projectId: number,
  limit = 50,
): Promise<OutboundMessageRow[]> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data ?? []) as OutboundMessageRow[];
}
