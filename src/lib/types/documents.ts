export type DocumentKind = "invoice" | "quote" | "tech_pack" | "image" | "other";

export interface DocumentRow {
  id: number;
  name: string;
  project_id: number | null;
  project_name: string | null;
  kind: DocumentKind;
  /** Approximate size for library UI (bytes). */
  size_bytes: number;
  /** Team member who uploaded or owns the file (aligns with project leads where applicable). */
  uploaded_by: string;
  updated_at: string;
  /** Original filename when uploaded from this device. */
  file_name?: string | null;
  /** Inline file payload for browser-stored uploads (hydrated from blob_ref in UI). */
  file_data_url?: string | null;
  /** IndexedDB key when file_data_url is stored outside localStorage. */
  blob_ref?: string | null;
  /** Dropbox, Google Drive, or other external share URL. */
  external_url?: string | null;
  /** Stable id for deduped imports (e.g. mailroom inline images). */
  source_ref?: string | null;
}

export type DocumentUploadFile = {
  name: string;
  size_bytes: number;
  data_url?: string;
};
