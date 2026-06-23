import { createClient } from "@/lib/supabase/client";
import { PROJECT_DOCUMENTS_BUCKET, PROJECT_DOCUMENT_MAX_BYTES } from "@/lib/supabase/project-document-limits";
import type { DocumentRow } from "@/lib/types/documents";

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const comma = dataUrl.indexOf(",");
  const header = comma >= 0 ? dataUrl.slice(0, comma) : "data:application/octet-stream;base64";
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mimeMatch = /^data:([^;]+);/i.exec(header);
  const mimeType = mimeMatch?.[1] ?? "application/octet-stream";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mimeType };
}

export function fileToDocumentBytes(file: File): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (file.size > PROJECT_DOCUMENT_MAX_BYTES) {
    throw new Error(`File must be ${PROJECT_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB or smaller.`);
  }
  return file.arrayBuffer().then((buf) => ({
    bytes: new Uint8Array(buf),
    mimeType: file.type || "application/octet-stream",
  }));
}

export function dataUrlToDocumentBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const { bytes, mimeType } = dataUrlToBytes(dataUrl);
  if (bytes.length > PROJECT_DOCUMENT_MAX_BYTES) {
    throw new Error(`File must be ${PROJECT_DOCUMENT_MAX_BYTES / (1024 * 1024)} MB or smaller.`);
  }
  return { bytes, mimeType };
}

/** Upload bytes to project-documents bucket under the operator workspace path. */
export async function uploadProjectDocumentBytes(
  operatorUserId: string,
  projectId: number,
  documentId: number,
  bytes: Uint8Array,
  filename: string,
  contentType: string,
): Promise<{ path: string; publicUrl: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload documents.");

  const safeName = filename.replace(/[^\w.\-]+/g, "_") || `file-${documentId}`;
  const path = `${operatorUserId}/${projectId}/${documentId}/${safeName}`;

  const { error } = await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).upload(path, bytes, {
    upsert: true,
    contentType,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) throw new Error("Could not get public URL");
  return { path, publicUrl: data.publicUrl };
}

export async function insertDocumentViaApi(
  projectId: number,
  row: DocumentRow,
  file?: { bytes: Uint8Array; mimeType: string } | null,
): Promise<DocumentRow> {
  const res = await fetch(`/api/projects/${projectId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documents: [
        {
          row,
          content_base64: file ? uint8ToBase64(file.bytes) : undefined,
          content_type: file?.mimeType,
        },
      ],
    }),
  });
  const data = (await res.json()) as { error?: string; documents?: DocumentRow[] };
  if (!res.ok) throw new Error(data.error ?? "Could not save document");
  const saved = data.documents?.[0];
  if (!saved) throw new Error("Document was not saved");
  return saved;
}

export async function syncDocumentsViaApi(documents: DocumentRow[]): Promise<DocumentRow[]> {
  const res = await fetch("/api/documents/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
  const data = (await res.json()) as { error?: string; documents?: DocumentRow[] };
  if (!res.ok) throw new Error(data.error ?? "Could not sync documents");
  return data.documents ?? [];
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export async function fetchAllDocumentsViaApi(): Promise<DocumentRow[]> {
  const res = await fetch("/api/documents", { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { documents?: DocumentRow[] };
  return data.documents ?? [];
}

export async function deleteDocumentsViaApi(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const res = await fetch("/api/documents", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Could not delete documents");
  }
}

export async function insertMailroomDocumentsViaApi(
  projectId: number,
  rows: DocumentRow[],
  blobs: Map<string, string>,
): Promise<DocumentRow[]> {
  const documents = rows.map((row) => {
    const dataUrl = row.blob_ref ? blobs.get(row.blob_ref) : row.file_data_url;
    let content_base64: string | undefined;
    let content_type: string | undefined;
    if (dataUrl?.startsWith("data:")) {
      const parsed = dataUrlToDocumentBytes(dataUrl);
      content_base64 = uint8ToBase64(parsed.bytes);
      content_type = parsed.mimeType;
    }
    return { row, content_base64, content_type };
  });

  const res = await fetch(`/api/projects/${projectId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
  });
  const data = (await res.json()) as { error?: string; documents?: DocumentRow[] };
  if (!res.ok) throw new Error(data.error ?? "Could not import documents");
  return data.documents ?? [];
}
