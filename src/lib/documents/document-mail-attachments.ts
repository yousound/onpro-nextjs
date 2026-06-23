import { getDocumentBlob, putDocumentBlob } from "@/lib/documents/document-blob-store";
import { buildProductionDocumentHtml } from "@/lib/documents/production-document-print";
import type { ProductionDocument } from "@/lib/documents/production-document-types";
import type { DocumentRow } from "@/lib/types/documents";
import type { EmailFileAttachment } from "@/lib/types/agent";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : dataUrl;
  return Math.floor((base64.length * 3) / 4);
}

function textToDataUrl(text: string, mimeType: string): string {
  const encoded =
    typeof btoa !== "undefined"
      ? btoa(unescape(encodeURIComponent(text)))
      : Buffer.from(text, "utf8").toString("base64");
  return `data:${mimeType};base64,${encoded}`;
}

async function bytesToDataUrl(bytes: Uint8Array, mimeType: string): Promise<string> {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const encoded =
    typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return `data:${mimeType};base64,${encoded}`;
}

async function resolveDocumentDataUrl(doc: DocumentRow): Promise<string | null> {
  if (doc.file_data_url) return doc.file_data_url;
  if (doc.blob_ref) {
    const fromStore = await getDocumentBlob(doc.blob_ref);
    if (fromStore) return fromStore;
  }
  const url = doc.external_url?.trim();
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytesToDataUrl(bytes, mimeType);
  } catch {
    return null;
  }
}

/** Build outbound attachment metadata for a production document (HTML print layout). */
export async function buildQuoteDocumentFileAttachment(
  document: ProductionDocument,
): Promise<EmailFileAttachment> {
  const html = buildProductionDocumentHtml(document);
  const filename = `${document.kind === "vendor_quote" ? "Quote" : "PO"}-${document.documentNumber.trim() || "draft"}.html`;
  const blobRef = `outbound-doc:${document.documentNumber}:${Date.now()}`;
  const dataUrl = textToDataUrl(html, "text/html");
  await putDocumentBlob(blobRef, dataUrl);

  return {
    id: makeId("qdoc"),
    filename,
    mimeType: "text/html",
    size_bytes: dataUrlByteSize(dataUrl),
    blob_ref: blobRef,
    label: filename,
  };
}

export async function documentRowsToFileAttachments(
  docs: DocumentRow[],
): Promise<EmailFileAttachment[]> {
  const out: EmailFileAttachment[] = [];
  for (const doc of docs) {
    const dataUrl = await resolveDocumentDataUrl(doc);
    if (!dataUrl) continue;

    const filename = doc.file_name?.trim() || doc.name?.trim() || `document-${doc.id}`;
    let blobRef = doc.blob_ref ?? undefined;

    if (!blobRef) {
      blobRef = `outbound-docrow:${doc.id}`;
      await putDocumentBlob(blobRef, dataUrl);
    }

    const mimeType = dataUrl.match(/^data:([^;]+);/)?.[1] ?? "application/octet-stream";

    out.push({
      id: makeId("doc"),
      filename,
      mimeType,
      size_bytes: doc.size_bytes || dataUrlByteSize(dataUrl),
      blob_ref: blobRef,
      document_id: doc.id,
      label: doc.name?.trim() || filename,
    });
  }
  return out;
}

export async function hydrateFileAttachmentDataUrl(
  att: EmailFileAttachment,
): Promise<string | null> {
  if (!att.blob_ref) return null;
  return getDocumentBlob(att.blob_ref);
}
