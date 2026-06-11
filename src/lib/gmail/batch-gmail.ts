import type { EmailThread } from "@/lib/types/agent";
import {
  fetchGmailThreadById,
  type GmailThreadFormat,
  mapGmailThreadFromRaw,
} from "@/lib/gmail/fetch-threads";

const GMAIL_BATCH_MAX = 50;

type BatchFetchOpts = {
  format?: GmailThreadFormat;
  resolveInlineImages?: boolean;
};

function metadataPath(threadId: string): string {
  const params = new URLSearchParams({ format: "metadata" });
  params.append("metadataHeaders", "Subject");
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "To");
  return `/gmail/v1/users/me/threads/${threadId}?${params}`;
}

function threadPath(threadId: string, format: GmailThreadFormat): string {
  if (format === "metadata") return metadataPath(threadId);
  return `/gmail/v1/users/me/threads/${threadId}?format=full`;
}

function parseBatchResponse(
  text: string,
  contentType: string,
): Array<{ status: number; body: string }> {
  const boundaryMatch = contentType.match(/boundary=([^;\s]+)/i);
  if (!boundaryMatch) return [];
  const boundary = boundaryMatch[1].replace(/^"|"$/g, "");
  const parts = text.split(`--${boundary}`);
  const out: Array<{ status: number; body: string }> = [];

  for (const part of parts) {
    if (!part.trim() || part.trim() === "--") continue;
    const httpSplit = part.split("\r\n\r\n");
    if (httpSplit.length < 2) continue;
    const headers = httpSplit[0];
    const rest = httpSplit.slice(1).join("\r\n\r\n");
    const statusMatch = headers.match(/HTTP\/[\d.]+ (\d+)/);
    const status = statusMatch ? Number(statusMatch[1]) : 0;
    const bodyStart = rest.indexOf("{");
    const body = bodyStart >= 0 ? rest.slice(bodyStart).trim() : "";
    out.push({ status, body });
  }
  return out;
}

/** Gmail multipart batch — one HTTP round trip for up to 50 thread GETs. */
export async function batchFetchGmailThreads(
  accessToken: string,
  ids: string[],
  opts?: BatchFetchOpts,
): Promise<(EmailThread | null)[]> {
  if (ids.length === 0) return [];
  if (ids.length === 1) {
    const t = await fetchGmailThreadById(accessToken, ids[0]!, opts);
    return [t];
  }

  const format: GmailThreadFormat = opts?.format ?? "metadata";
  const boundary = `onpro_batch_${Date.now()}`;
  const chunks: string[] = [];

  for (const id of ids) {
    chunks.push(
      `--${boundary}\r\nContent-Type: application/http\r\n\r\nGET ${threadPath(id, format)}\r\n`,
    );
  }
  chunks.push(`--${boundary}--`);
  const body = chunks.join("");

  const res = await fetch("https://gmail.googleapis.com/batch/gmail/v1", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const fallback = await Promise.all(
      ids.map((id) => fetchGmailThreadById(accessToken, id, opts)),
    );
    return fallback;
  }

  const text = await res.text();
  const parts = parseBatchResponse(text, res.headers.get("content-type") ?? "");
  const results: (EmailThread | null)[] = [];

  for (let i = 0; i < ids.length; i++) {
    const part = parts[i];
    if (!part || part.status !== 200 || !part.body) {
      results.push(null);
      continue;
    }
    try {
      const raw = JSON.parse(part.body) as Parameters<typeof mapGmailThreadFromRaw>[1];
      results.push(
        await mapGmailThreadFromRaw(accessToken, raw, {
          format,
          resolveInlineImages: opts?.resolveInlineImages,
        }),
      );
    } catch {
      results.push(null);
    }
  }

  return results;
}

export { GMAIL_BATCH_MAX };
