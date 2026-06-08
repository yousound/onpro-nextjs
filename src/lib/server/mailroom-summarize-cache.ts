import { mailroomThreadFingerprint } from "@/lib/mailroom/thread-fingerprint";
import type { AgentSuggestion, EmailThread, MailroomWorkflow } from "@/lib/types/agent";
import {
  getMailroomThreadScan,
  upsertMailroomThreadScan,
} from "@/lib/supabase/mailroom-thread-scans";

/** Scans are valid for one year (Supabase `expires_at` + in-memory fallback). */
export const MAILROOM_SCAN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const MAX_MEMORY_ENTRIES = 256;

export type CachedMailroomSummarize = {
  summary: string;
  suggestions: AgentSuggestion[];
  workflow: MailroomWorkflow | null;
  project_id: number | null;
  scanContext: string;
  expiresAt: number;
};

const memoryCache = new Map<string, CachedMailroomSummarize>();

function memoryKey(userId: string, threadId: string, fingerprint: string): string {
  return `sum:${userId}:${threadId}:${fingerprint}`;
}

export async function getCachedMailroomSummarize(
  userId: string,
  thread: EmailThread,
  opts?: { live?: boolean },
): Promise<CachedMailroomSummarize | null> {
  if (opts?.live && userId !== "local") {
    const row = await getMailroomThreadScan(userId, thread);
    if (row) {
      return {
        summary: row.summary,
        suggestions: row.suggestions,
        workflow: row.workflow,
        project_id: row.project_id,
        scanContext: row.scan_context,
        expiresAt: new Date(row.expires_at).getTime(),
      };
    }
  }

  const hit = memoryCache.get(
    memoryKey(userId, thread.id, mailroomThreadFingerprint(thread)),
  );
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit;
}

export async function setCachedMailroomSummarize(
  userId: string,
  thread: EmailThread,
  result: Omit<CachedMailroomSummarize, "expiresAt">,
  opts?: { live?: boolean },
): Promise<void> {
  const expiresAt = Date.now() + MAILROOM_SCAN_TTL_MS;
  const entry: CachedMailroomSummarize = { ...result, expiresAt };

  memoryCache.set(memoryKey(userId, thread.id, mailroomThreadFingerprint(thread)), entry);
  if (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const oldest = [...memoryCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
    if (oldest) memoryCache.delete(oldest[0]);
  }

  if (opts?.live && userId !== "local") {
    await upsertMailroomThreadScan({
      userId,
      thread,
      summary: result.summary,
      scanContext: result.scanContext,
      suggestions: result.suggestions,
      workflow: result.workflow,
      projectId: result.project_id,
    });
  }
}

export async function deleteCachedMailroomSummarize(
  userId: string,
  thread: EmailThread,
  opts?: { live?: boolean },
): Promise<void> {
  const prefix = `sum:${userId}:${thread.id}:`;
  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }

  if (opts?.live && userId !== "local") {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase
      .from("mailroom_thread_scans")
      .delete()
      .eq("user_id", userId)
      .eq("thread_id", thread.id);
    if (error && !String(error.message).includes("mailroom_thread_scans")) {
      console.warn("[mailroom] delete thread scans failed", error.message);
    }
  }
}
