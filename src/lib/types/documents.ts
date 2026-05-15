export type DocumentKind = "invoice" | "quote" | "tech_pack" | "other";

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
}
