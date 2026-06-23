import type { EmailMessage, EmailThread } from "@/lib/types/agent";
import type { DocumentRow } from "@/lib/types/documents";
import type { ProjectJob } from "@/lib/types/wip";

const STYLE_TOKEN = /\b([A-Z]{2,4}\d{2,5})\b/g;

/** Style refs like GGT148, GGSH13 from filenames or email text. */
export function extractStyleTokens(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(STYLE_TOKEN)) {
    const token = m[1]!.toUpperCase();
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

function jobLabel(job: ProjectJob): string {
  const num = job.job_number?.trim();
  const name = job.name?.trim();
  if (num && name) return `${num} — ${name}`;
  return num || name || job.id;
}

/** Match a mailroom asset to a job using style # in filename, name, or message body. */
export function matchJobForMailroomAsset(input: {
  fileName?: string | null;
  displayName?: string | null;
  messageBody?: string;
  jobs: ProjectJob[];
}): ProjectJob | null {
  if (input.jobs.length === 0) return null;

  const haystack = [input.fileName, input.displayName, input.messageBody]
    .filter(Boolean)
    .join(" ");
  const tokens = extractStyleTokens(haystack);

  for (const token of tokens) {
    const hit = input.jobs.find((j) => {
      const style = j.style_number?.trim().toUpperCase();
      if (style && style === token) return true;
      const name = j.name?.trim().toUpperCase() ?? "";
      if (name.includes(token)) return true;
      const num = j.job_number?.trim().toUpperCase() ?? "";
      if (num.includes(token)) return true;
      return false;
    });
    if (hit) return hit;
  }

  if (input.jobs.length === 1) return input.jobs[0]!;
  return null;
}

function messageBodyByMailroomKey(
  threads: EmailThread[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const thread of threads) {
    for (const message of thread.messages) {
      const body = message.body?.trim() ?? "";
      if (!body) continue;
      for (const img of message.inlineImages ?? []) {
        out.set(`${thread.id}:${message.id}`, body);
      }
      for (const file of message.emailFiles ?? []) {
        out.set(`${thread.id}:${message.id}:${file.id}`, body);
      }
    }
  }
  return out;
}

function messageBodyForDoc(
  doc: DocumentRow,
  threads: EmailThread[],
): string | undefined {
  if (!doc.source_ref?.startsWith("mailroom:")) return undefined;
  const parts = doc.source_ref.split(":");
  if (parts.length < 4) return undefined;
  const threadId = parts[1]!;
  const messageId = parts[2]!;
  const thread = threads.find((t) => t.id === threadId);
  const message = thread?.messages.find((m) => m.id === messageId);
  return message?.body?.trim() || undefined;
}

/** Assign `job_id` on unassigned project documents using style # heuristics. */
export function assignJobsToProjectDocuments(
  docs: DocumentRow[],
  projectId: number,
  jobs: ProjectJob[],
  threads: EmailThread[] = [],
): DocumentRow[] {
  const projectJobs = jobs.filter((j) => j.project_id === projectId);
  if (projectJobs.length === 0) return docs;

  return docs.map((doc) => {
    if (doc.project_id !== projectId || doc.job_id) return doc;

    const job = matchJobForMailroomAsset({
      fileName: doc.file_name,
      displayName: doc.name,
      messageBody: messageBodyForDoc(doc, threads),
      jobs: projectJobs,
    });
    if (!job) return doc;

    return {
      ...doc,
      job_id: job.id,
      job_label: jobLabel(job),
    };
  });
}

export function assignJobsOnNewMailroomRows(
  rows: DocumentRow[],
  jobsByProject: Map<number, ProjectJob[]>,
  threads: EmailThread[],
  message: EmailMessage,
  thread: EmailThread,
): DocumentRow[] {
  return rows.map((row) => {
    if (row.job_id || row.project_id == null) return row;
    const jobs = jobsByProject.get(row.project_id) ?? [];
    const job = matchJobForMailroomAsset({
      fileName: row.file_name,
      displayName: row.name,
      messageBody: message.body,
      jobs,
    });
    if (!job) return row;
    return { ...row, job_id: job.id, job_label: jobLabel(job) };
  });
}

export { messageBodyByMailroomKey };
