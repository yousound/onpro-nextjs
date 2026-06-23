import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getDocuments } from "@/lib/mock/documents";
import { loadExtraDocuments, readExtraDocumentsSync } from "@/lib/documents/document-storage";
import type { DocumentRow } from "@/lib/types/documents";

/** All documents visible in the workspace (seed + extras), hydrated when possible. */
export async function loadAllWorkspaceDocuments(): Promise<DocumentRow[]> {
  const seed = isClientLiveBackend() ? [] : getDocuments();
  const extras = await loadExtraDocuments();
  return [...seed, ...extras];
}

export function syncReadWorkspaceDocuments(): DocumentRow[] {
  const seed = isClientLiveBackend() ? [] : getDocuments();
  return [...seed, ...readExtraDocumentsSync()];
}
