import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { getDocumentBlob, putDocumentBlob } from "@/lib/documents/document-blob-store";
import { normalizeDocumentRow } from "@/lib/documents/document-preview";
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

export async function loadExtraDocuments(): Promise<DocumentRow[]> {
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
  return readMockLs<DocumentRow[]>(MOCK_LS.documents) ?? [];
}
