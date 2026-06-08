import { deleteDocumentBlob } from "@/lib/documents/document-blob-store";
import {
  readExtraDocumentsSync,
  slimDocumentForLocalStorage,
} from "@/lib/documents/document-storage";
import { normalizeDocumentRow } from "@/lib/documents/document-preview";
import { readDeletedProjectIds } from "@/lib/deleted-projects";
import { MOCK_LS, writeMockLs } from "@/lib/mock-local";
import { dispatchDocumentsChanged } from "@/lib/onpro-events";
import type { DocumentRow } from "@/lib/types/documents";

export type DeleteDocumentsResult = {
  removed: number;
  quotaExceeded: boolean;
};

export function listExtraDocumentsForProject(projectId: number): DocumentRow[] {
  return readExtraDocumentsSync()
    .map(normalizeDocumentRow)
    .filter((row) => row.project_id === projectId);
}

export function countExtraDocumentsForProject(projectId: number): number {
  return listExtraDocumentsForProject(projectId).length;
}

export function listOrphanedWorkspaceDocuments(): DocumentRow[] {
  const deleted = readDeletedProjectIds();
  if (deleted.size === 0) return [];
  return readExtraDocumentsSync()
    .map(normalizeDocumentRow)
    .filter((row) => row.project_id != null && deleted.has(row.project_id));
}

export async function deleteExtraDocumentsWhere(
  predicate: (row: DocumentRow) => boolean,
): Promise<DeleteDocumentsResult> {
  if (typeof window === "undefined") return { removed: 0, quotaExceeded: false };

  const raw = readExtraDocumentsSync().map(normalizeDocumentRow);
  const toRemove = raw.filter(predicate);
  if (toRemove.length === 0) return { removed: 0, quotaExceeded: false };

  const keep = raw.filter((row) => !predicate(row));
  const keptBlobRefs = new Set(
    keep.map((row) => row.blob_ref).filter((ref): ref is string => Boolean(ref)),
  );

  for (const row of toRemove) {
    const ref = row.blob_ref;
    if (ref && !keptBlobRefs.has(ref)) {
      await deleteDocumentBlob(ref);
    }
  }

  const ok = writeMockLs(MOCK_LS.documents, keep.map(slimDocumentForLocalStorage));
  if (ok) dispatchDocumentsChanged();
  return { removed: toRemove.length, quotaExceeded: !ok };
}

export async function deleteExtraDocumentsByIds(ids: number[]): Promise<DeleteDocumentsResult> {
  const idSet = new Set(ids);
  return deleteExtraDocumentsWhere((row) => idSet.has(row.id));
}

export async function deleteExtraDocumentsForProject(projectId: number): Promise<DeleteDocumentsResult> {
  return deleteExtraDocumentsWhere((row) => row.project_id === projectId);
}
