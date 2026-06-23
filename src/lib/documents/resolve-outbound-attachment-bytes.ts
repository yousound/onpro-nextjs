import { buildProductionDocumentHtml } from "@/lib/documents/production-document-print";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import { PROJECT_DOCUMENTS_BUCKET } from "@/lib/supabase/project-document-limits";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedOutboundAttachment = {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
  documentId?: number;
  publicUrl?: string | null;
};

async function fetchUrlBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function resolveDocumentAttachmentBytes(
  supabase: SupabaseClient,
  documentId: number,
  projectId?: number,
): Promise<ResolvedOutboundAttachment | null> {
  let query = supabase
    .from("project_documents")
    .select("id, project_id, name, file_name, external_url, storage_path, kind")
    .eq("id", documentId);

  if (projectId != null) query = query.eq("project_id", projectId);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  const row = data as {
    name: string;
    file_name: string | null;
    external_url: string | null;
    storage_path: string | null;
    kind: string;
  };

  const filename = row.file_name?.trim() || row.name?.trim() || `document-${documentId}`;
  const publicUrl = row.external_url?.trim() || null;

  if (row.external_url) {
    const bytes = await fetchUrlBytes(row.external_url);
    if (bytes) {
      const mimeType = guessMimeFromFilename(filename, row.kind);
      return { filename, mimeType, bytes, documentId, publicUrl };
    }
  }

  if (row.storage_path) {
    const { data: blob, error: dlError } = await supabase.storage
      .from(PROJECT_DOCUMENTS_BUCKET)
      .download(row.storage_path);
    if (!dlError && blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const mimeType = blob.type || guessMimeFromFilename(filename, row.kind);
      const url =
        publicUrl ??
        supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).getPublicUrl(row.storage_path).data
          .publicUrl;
      return { filename, mimeType, bytes, documentId, publicUrl: url || null };
    }
  }

  return null;
}

export function resolveProductionDocumentAttachment(
  document: ProductionDocument,
): ResolvedOutboundAttachment {
  const html = buildProductionDocumentHtml(document);
  const bytes = Buffer.from(html, "utf8");
  const prefix =
    document.kind === "vendor_po" ? "PO" : document.kind === "vendor_quote" ? "Quote" : "Estimate";
  const filename = `${prefix}-${document.documentNumber.trim() || "draft"}.html`;
  return {
    filename,
    mimeType: "text/html",
    bytes: new Uint8Array(bytes),
  };
}

function guessMimeFromFilename(filename: string, kind: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (kind === "image") return "image/png";
  if (kind === "tech_pack") return "application/pdf";
  return "application/octet-stream";
}
