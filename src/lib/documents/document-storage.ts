import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  fetchAllDocumentsFromDb,
  readLiveDocumentsCache,
  seedLiveDocumentsCache,
} from "@/lib/data/persist-documents";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { getDocumentBlob, putDocumentBlob } from "@/lib/documents/document-blob-store";
import { normalizeDocumentRow } from "@/lib/documents/document-preview";
import {
  dataUrlToDocumentBytes,
  fetchAllDocumentsViaApi,
  insertDocumentViaApi,
  syncDocumentsViaApi,
} from "@/lib/supabase/upload-project-document";
import { dispatchDocumentsChanged } from "@/lib/onpro-events";
import type { DocumentRow } from "@/lib/types/documents";

/** Max inline image size we persist per mailroom import (per shared blob). */
export const MAX_MAILROOM_IMAGE_BYTES = 1_200_000;

function blobRefForRow(row: DocumentRow): string {
  return row.blob_ref ?? row.source_ref ?? `doc-blob-${row.id}`;
}

/** Strip heavy payloads before writing to localStorage. */
export function slimDocumentForLocalStorage(row: DocumentRow): DocumentRow {
  if (!row.file_data_url) return row;
  const ref = row.blob_ref ?? blobRefForRow(row);
  return {
    ...row,
    blob_ref: ref,
    file_data_url: null,
  };
}

export async function hydrateDocumentsFromBlobStore(rows: DocumentRow[]): Promise<DocumentRow[]> {
  if (isClientLiveBackend()) return rows;
  return Promise.all(
    rows.map(async (row) => {
      const base = normalizeDocumentRow(row);
      if (base.file_data_url || !base.blob_ref) return base;
      const dataUrl = await getDocumentBlob(base.blob_ref);
      return dataUrl ? { ...base, file_data_url: dataUrl } : base;
    }),
  );
}

/** Move legacy inline data URLs from localStorage rows into IndexedDB. */
export async function migrateInlineBlobsToStore(rows: DocumentRow[]): Promise<{
  rows: DocumentRow[];
  migrated: boolean;
}> {
  if (isClientLiveBackend()) return { rows, migrated: false };

  let migrated = false;
  const out: DocumentRow[] = [];

  for (const row of rows) {
    const normalized = normalizeDocumentRow(row);
    const inline = normalized.file_data_url;
    if (!inline || inline.length === 0) {
      out.push(normalized);
      continue;
    }
    const ref = normalized.blob_ref ?? blobRefForRow(normalized);
    await putDocumentBlob(ref, inline);
    out.push({ ...normalized, blob_ref: ref, file_data_url: null });
    migrated = true;
  }

  return { rows: out, migrated };
}

function documentMetadataChanged(before: DocumentRow, after: DocumentRow): boolean {
  return (
    before.job_id !== after.job_id ||
    before.job_label !== after.job_label ||
    before.name !== after.name ||
    before.kind !== after.kind ||
    before.project_name !== after.project_name ||
    before.file_name !== after.file_name ||
    before.external_url !== after.external_url
  );
}

async function persistLiveDocuments(rows: DocumentRow[]): Promise<boolean> {
  const prev = readLiveDocumentsCache();
  const prevById = new Map(prev.map((d) => [d.id, d]));
  const normalized = rows.map(normalizeDocumentRow);

  const newRows = normalized.filter((r) => r.project_id != null && !prevById.has(r.id));
  const updatedRows = normalized.filter((r) => {
    const p = prevById.get(r.id);
    return p != null && documentMetadataChanged(p, r);
  });

  try {
    for (const row of newRows) {
      const projectId = row.project_id!;
      let file: { bytes: Uint8Array; mimeType: string } | null = null;
      if (row.file_data_url?.startsWith("data:")) {
        file = dataUrlToDocumentBytes(row.file_data_url);
      }
      const toInsert = normalizeDocumentRow({
        ...row,
        id: 0,
        file_data_url: null,
      });
      await insertDocumentViaApi(projectId, toInsert, file);
    }

    if (updatedRows.length > 0) {
      await syncDocumentsViaApi(updatedRows);
    }

    const fresh = await fetchAllDocumentsViaApi();
    seedLiveDocumentsCache(fresh);
    dispatchDocumentsChanged();
    return true;
  } catch (e) {
    console.error("[documents] live persist failed", e);
    return false;
  }
}

export async function loadExtraDocuments(): Promise<DocumentRow[]> {
  if (isClientLiveBackend()) {
    return fetchAllDocumentsFromDb();
  }

  const raw = readMockLs<DocumentRow[]>(MOCK_LS.documents) ?? [];
  const kindNormalized = raw.map(normalizeDocumentRow);
  const kindUpgraded = raw.some((r, i) => r.kind !== kindNormalized[i]?.kind);
  const { rows: migrated, migrated: didMigrate } = await migrateInlineBlobsToStore(kindNormalized);
  if (didMigrate || kindUpgraded) {
    writeMockLs(MOCK_LS.documents, migrated.map(slimDocumentForLocalStorage));
  }
  return hydrateDocumentsFromBlobStore(migrated);
}

export async function persistExtraDocuments(rows: DocumentRow[]): Promise<boolean> {
  if (isClientLiveBackend()) {
    return persistLiveDocuments(rows);
  }

  const lean: DocumentRow[] = [];
  for (const row of rows) {
    const normalized = normalizeDocumentRow(row);
    if (normalized.file_data_url) {
      const ref = normalized.blob_ref ?? blobRefForRow(normalized);
      await putDocumentBlob(ref, normalized.file_data_url);
      lean.push({ ...normalized, blob_ref: ref, file_data_url: null });
    } else {
      lean.push(slimDocumentForLocalStorage(normalized));
    }
  }
  return writeMockLs(MOCK_LS.documents, lean);
}

export function readExtraDocumentsSync(): DocumentRow[] {
  if (isClientLiveBackend()) {
    return readLiveDocumentsCache();
  }
  return readMockLs<DocumentRow[]>(MOCK_LS.documents) ?? [];
}
