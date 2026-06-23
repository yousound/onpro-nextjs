import type { DocumentKind, DocumentRow } from "@/lib/types/documents";

export type ProjectDocumentRowDb = {
  id: number;
  user_id: string;
  project_id: number;
  job_id: string | null;
  job_label: string | null;
  name: string;
  project_name: string | null;
  kind: string;
  size_bytes: number;
  uploaded_by: string;
  file_name: string | null;
  storage_path: string | null;
  external_url: string | null;
  source_ref: string | null;
  updated_at: string;
  created_at: string;
};

const KINDS: DocumentKind[] = ["invoice", "quote", "tech_pack", "image", "other"];

function normalizeKind(raw: string): DocumentKind {
  return (KINDS as readonly string[]).includes(raw) ? (raw as DocumentKind) : "other";
}

export function projectDocumentFromRow(row: ProjectDocumentRowDb): DocumentRow {
  return {
    id: Number(row.id),
    name: row.name,
    project_id: row.project_id,
    project_name: row.project_name,
    job_id: row.job_id,
    job_label: row.job_label,
    kind: normalizeKind(row.kind),
    size_bytes: Number(row.size_bytes) || 0,
    uploaded_by: row.uploaded_by,
    updated_at: row.updated_at,
    file_name: row.file_name,
    file_data_url: null,
    blob_ref: row.storage_path,
    external_url: row.external_url,
    source_ref: row.source_ref,
  };
}

export function projectDocumentToRow(
  doc: DocumentRow,
  operatorUserId: string,
): Omit<ProjectDocumentRowDb, "id" | "created_at"> & { id?: number } {
  return {
    ...(doc.id > 0 ? { id: doc.id } : {}),
    user_id: operatorUserId,
    project_id: doc.project_id!,
    job_id: doc.job_id ?? null,
    job_label: doc.job_label ?? null,
    name: doc.name,
    project_name: doc.project_name,
    kind: doc.kind,
    size_bytes: doc.size_bytes ?? 0,
    uploaded_by: doc.uploaded_by,
    file_name: doc.file_name ?? null,
    storage_path: doc.blob_ref ?? null,
    external_url: doc.external_url ?? null,
    source_ref: doc.source_ref ?? null,
    updated_at: doc.updated_at ?? new Date().toISOString(),
  };
}
