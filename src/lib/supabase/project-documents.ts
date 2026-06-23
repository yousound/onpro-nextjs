import { PROJECT_DOCUMENTS_BUCKET } from "@/lib/supabase/project-document-limits";
import {
  projectDocumentFromRow,
  projectDocumentToRow,
  type ProjectDocumentRowDb,
} from "@/lib/supabase/mappers/project-document";
import type { DocumentRow } from "@/lib/types/documents";
import type { SupabaseClient } from "@supabase/supabase-js";

function publicUrl(supabase: SupabaseClient, path: string): string {
  const { data } = supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchDocumentsForProjectFromSupabase(
  projectId: number,
): Promise<DocumentRow[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const { fetchAccessibleProjectOperator } = await import("@/lib/server/project-workspace-access");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const access = await fetchAccessibleProjectOperator(supabase, projectId);
  if (!access) return [];

  const { data, error } = await supabase
    .from("project_documents")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data as ProjectDocumentRowDb[]).map(projectDocumentFromRow);
}

export async function fetchAllDocumentsFromSupabase(): Promise<DocumentRow[]> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("project_documents")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }

  return (data as ProjectDocumentRowDb[]).map(projectDocumentFromRow);
}

export type InsertProjectDocumentInput = {
  row: DocumentRow;
  fileBytes?: Uint8Array | null;
  contentType?: string;
};

export async function insertProjectDocumentsForUser(
  supabase: SupabaseClient,
  operatorUserId: string,
  inputs: InsertProjectDocumentInput[],
): Promise<DocumentRow[]> {
  const out: DocumentRow[] = [];

  for (const input of inputs) {
    const base = projectDocumentToRow(input.row, operatorUserId);
    const { data: inserted, error } = await supabase
      .from("project_documents")
      .insert({
        user_id: base.user_id,
        project_id: base.project_id,
        job_id: base.job_id,
        job_label: base.job_label,
        name: base.name,
        project_name: base.project_name,
        kind: base.kind,
        size_bytes: base.size_bytes,
        uploaded_by: base.uploaded_by,
        file_name: base.file_name,
        source_ref: base.source_ref,
        updated_at: base.updated_at,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505" && base.source_ref) continue;
      throw error;
    }

    let row = projectDocumentFromRow(inserted as ProjectDocumentRowDb);

    if (input.fileBytes && input.fileBytes.length > 0 && row.project_id != null) {
      const safeName = (row.file_name ?? `file-${row.id}`).replace(/[^\w.\-]+/g, "_");
      const path = `${operatorUserId}/${row.project_id}/${row.id}/${safeName}`;
      const contentType = input.contentType ?? "application/octet-stream";

      const { error: uploadError } = await supabase.storage
        .from(PROJECT_DOCUMENTS_BUCKET)
        .upload(path, input.fileBytes, {
          upsert: true,
          contentType,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;

      const url = publicUrl(supabase, path);
      const { data: updated, error: patchError } = await supabase
        .from("project_documents")
        .update({
          storage_path: path,
          external_url: url,
          size_bytes: input.fileBytes.length,
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (patchError) throw patchError;
      row = projectDocumentFromRow(updated as ProjectDocumentRowDb);
    }

    out.push(row);
  }

  return out;
}

export async function syncProjectDocumentsForUser(
  supabase: SupabaseClient,
  operatorUserId: string,
  documents: DocumentRow[],
): Promise<DocumentRow[]> {
  const out: DocumentRow[] = [];
  for (const doc of documents) {
    if (doc.project_id == null) continue;
    const base = projectDocumentToRow(doc, operatorUserId);
    if (doc.id > 0) {
      const { data, error } = await supabase
        .from("project_documents")
        .update({
          job_id: base.job_id,
          job_label: base.job_label,
          name: base.name,
          project_name: base.project_name,
          kind: base.kind,
          size_bytes: base.size_bytes,
          uploaded_by: base.uploaded_by,
          file_name: base.file_name,
          storage_path: base.storage_path,
          external_url: base.external_url,
          source_ref: base.source_ref,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id)
        .select("*")
        .single();
      if (error) throw error;
      out.push(projectDocumentFromRow(data as ProjectDocumentRowDb));
    }
  }
  return out;
}

export async function deleteProjectDocumentsByIds(
  supabase: SupabaseClient,
  ids: number[],
): Promise<number> {
  if (ids.length === 0) return 0;

  const { data: rows, error: readError } = await supabase
    .from("project_documents")
    .select("id, storage_path")
    .in("id", ids);
  if (readError) throw readError;

  for (const row of rows ?? []) {
    const path = (row as { storage_path?: string }).storage_path;
    if (path) {
      await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).remove([path]);
    }
  }

  const { error } = await supabase.from("project_documents").delete().in("id", ids);
  if (error) throw error;
  return ids.length;
}

export async function deleteProjectDocumentsForProject(
  supabase: SupabaseClient,
  projectId: number,
): Promise<void> {
  const { data: rows, error: readError } = await supabase
    .from("project_documents")
    .select("id, storage_path")
    .eq("project_id", projectId);
  if (readError) throw readError;

  const paths = (rows ?? [])
    .map((r) => (r as { storage_path?: string }).storage_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await supabase.storage.from(PROJECT_DOCUMENTS_BUCKET).remove(paths);
  }

  const { error } = await supabase.from("project_documents").delete().eq("project_id", projectId);
  if (error) throw error;
}
