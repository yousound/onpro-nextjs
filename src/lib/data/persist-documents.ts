import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { fetchAllDocumentsViaApi } from "@/lib/supabase/upload-project-document";

let liveCache: import("@/lib/types/documents").DocumentRow[] = [];

export async function fetchAllDocumentsFromDb(): Promise<import("@/lib/types/documents").DocumentRow[]> {
  if (!isClientLiveBackend()) return [];
  const docs = await fetchAllDocumentsViaApi();
  liveCache = docs;
  return docs;
}

export function readLiveDocumentsCache(): import("@/lib/types/documents").DocumentRow[] {
  return liveCache;
}

export function seedLiveDocumentsCache(docs: import("@/lib/types/documents").DocumentRow[]): void {
  liveCache = docs;
}
