import { getDocumentBlob } from "@/lib/documents/document-blob-store";
import type { DocumentRow } from "@/lib/types/documents";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|img)$/i;

export function isImageDataUrl(src: string): boolean {
  return /^data:image\//i.test(src);
}

export function isImageFileName(name: string | null | undefined): boolean {
  if (!name) return false;
  return IMAGE_EXT.test(name);
}

export function isImageHttpUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (IMAGE_EXT.test(url)) return true;
  return false;
}

/** Mailroom imports and explicit image uploads should preview as images. */
export function isImageDocument(doc: DocumentRow): boolean {
  if (doc.kind === "image") return true;
  if (doc.file_data_url && isImageDataUrl(doc.file_data_url)) return true;
  if (doc.external_url && isImageHttpUrl(doc.external_url)) return true;
  if (isImageFileName(doc.file_name)) return true;
  if (doc.source_ref?.startsWith("mailroom:")) return true;
  if (doc.blob_ref?.startsWith("mailroom-blob:")) return true;
  return false;
}

/** Structured docs open in the estimate/invoice composer; images open in file preview. */
export function opensInAttachmentComposer(doc: DocumentRow): boolean {
  if (isImageDocument(doc)) return false;
  return doc.kind === "invoice" || doc.kind === "quote" || doc.kind === "tech_pack";
}

export function projectHrefForDocument(
  doc: DocumentRow,
  opts?: { module?: "documents" | "details" },
): string | null {
  if (doc.project_id == null || !Number.isFinite(doc.project_id)) return null;
  const tab = opts?.module ?? "documents";
  return `/projects/${doc.project_id}?module=${tab}`;
}

/** Row link — opens the project (details tab). */
export function projectRowHref(doc: DocumentRow): string | null {
  return projectHrefForDocument(doc, { module: "details" });
}

/** Ensure legacy rows (e.g. mailroom `other` + image signals) use kind `image`. */
export function normalizeDocumentRow(row: DocumentRow): DocumentRow {
  if (row.kind === "image") return row;
  if (isImageDocument(row)) return { ...row, kind: "image" };
  return row;
}

export async function resolveDocumentPreviewSrc(doc: DocumentRow): Promise<string | null> {
  if (doc.file_data_url) return doc.file_data_url;
  if (doc.external_url && /^https?:\/\//i.test(doc.external_url)) return doc.external_url;
  if (doc.blob_ref) {
    const blob = await getDocumentBlob(doc.blob_ref);
    if (blob) return blob;
  }
  return null;
}
