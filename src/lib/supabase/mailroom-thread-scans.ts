import { createClient } from "@/lib/supabase/server";
import type { AgentSuggestion, EmailThread, MailroomWorkflow } from "@/lib/types/agent";
import { mailroomThreadFingerprint } from "@/lib/mailroom/thread-fingerprint";

export type MailroomThreadScanRow = {
  id: string;
  user_id: string;
  thread_id: string;
  content_fingerprint: string;
  subject: string;
  summary: string;
  scan_context: string;
  suggestions: AgentSuggestion[];
  workflow: MailroomWorkflow | null;
  project_id: number | null;
  scanned_at: string;
  expires_at: string;
};

export function isMissingMailroomScansTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message?.includes("mailroom_thread_scans"));
}

export async function getMailroomThreadScan(
  userId: string,
  thread: EmailThread,
): Promise<MailroomThreadScanRow | null> {
  const supabase = await createClient();
  const fingerprint = mailroomThreadFingerprint(thread);
  const { data, error } = await supabase
    .from("mailroom_thread_scans")
    .select("*")
    .eq("user_id", userId)
    .eq("thread_id", thread.id)
    .eq("content_fingerprint", fingerprint)
    .gt("expires_at", new Date().toISOString())
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingMailroomScansTableError(error)) {
      console.warn(
        "[mailroom] mailroom_thread_scans missing — run supabase/migrations/012_mailroom_thread_scans.sql",
      );
      return null;
    }
    throw error;
  }
  if (!data) return null;
  return normalizeScanRow(data as Record<string, unknown>);
}

export async function getLatestMailroomThreadScan(
  userId: string,
  threadId: string,
): Promise<MailroomThreadScanRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailroom_thread_scans")
    .select("*")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .gt("expires_at", new Date().toISOString())
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingMailroomScansTableError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return normalizeScanRow(data as Record<string, unknown>);
}

export async function listMailroomScansForAssistant(
  userId: string,
  limit = 30,
): Promise<MailroomThreadScanRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mailroom_thread_scans")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("scanned_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingMailroomScansTableError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => normalizeScanRow(row as Record<string, unknown>));
}

export async function upsertMailroomThreadScan(opts: {
  userId: string;
  thread: EmailThread;
  summary: string;
  scanContext: string;
  suggestions: AgentSuggestion[];
  workflow: MailroomWorkflow | null;
  projectId: number | null;
}): Promise<void> {
  const supabase = await createClient();
  const fingerprint = mailroomThreadFingerprint(opts.thread);
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("mailroom_thread_scans").upsert(
    {
      user_id: opts.userId,
      thread_id: opts.thread.id,
      content_fingerprint: fingerprint,
      subject: opts.thread.subject,
      summary: opts.summary,
      scan_context: opts.scanContext,
      suggestions: opts.suggestions,
      workflow: opts.workflow,
      project_id: opts.projectId,
      scanned_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: "user_id,thread_id,content_fingerprint" },
  );

  if (error) {
    if (isMissingMailroomScansTableError(error)) {
      console.warn("[mailroom] could not persist scan — table missing");
      return;
    }
    throw error;
  }
}

function normalizeScanRow(raw: Record<string, unknown>): MailroomThreadScanRow {
  return {
    id: String(raw.id),
    user_id: String(raw.user_id),
    thread_id: String(raw.thread_id),
    content_fingerprint: String(raw.content_fingerprint),
    subject: String(raw.subject ?? ""),
    summary: String(raw.summary ?? ""),
    scan_context: String(raw.scan_context ?? ""),
    suggestions: Array.isArray(raw.suggestions) ? (raw.suggestions as AgentSuggestion[]) : [],
    workflow: (raw.workflow as MailroomWorkflow | null) ?? null,
    project_id:
      typeof raw.project_id === "number"
        ? raw.project_id
        : raw.project_id != null
          ? Number(raw.project_id)
          : null,
    scanned_at: String(raw.scanned_at),
    expires_at: String(raw.expires_at),
  };
}
