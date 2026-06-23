import { gmailApiThreadIdFromEmailThreadId } from "@/lib/gmail/fetch-threads";

type GmailThreadListResponse = {
  threads?: Array<{ id: string }>;
};

function header(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string,
): string {
  const h = headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value?.trim() ?? "";
}

/** Map OnPro mailroom thread id → Gmail API thread id. */
export function resolveGmailThreadId(mailroomThreadId?: string | null): string | null {
  if (!mailroomThreadId) return null;
  return gmailApiThreadIdFromEmailThreadId(mailroomThreadId);
}

/** Find an existing Gmail thread to reply in (by hint id, then subject + recipient). */
export async function findGmailThreadForOutbound(
  accessToken: string,
  input: {
    mailroomThreadId?: string | null;
    subject: string;
    toEmail: string;
  },
): Promise<{ threadId: string; inReplyTo?: string; references?: string } | null> {
  const hinted = resolveGmailThreadId(input.mailroomThreadId);
  if (hinted) {
    const headers = await fetchLastMessageHeaders(accessToken, hinted);
    return {
      threadId: hinted,
      inReplyTo: headers.messageId,
      references: headers.references ?? headers.messageId,
    };
  }

  const to = input.toEmail.trim().toLowerCase();
  const subject = input.subject.trim();
  if (!to || !subject) return null;

  const q = `to:${to} subject:"${subject.replace(/"/g, "")}"`;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=5&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!listRes.ok) return null;

  const list = (await listRes.json()) as GmailThreadListResponse;
  const threadId = list.threads?.[0]?.id;
  if (!threadId) return null;

  const headers = await fetchLastMessageHeaders(accessToken, threadId);
  return {
    threadId,
    inReplyTo: headers.messageId,
    references: headers.references ?? headers.messageId,
  };
}

async function fetchLastMessageHeaders(
  accessToken: string,
  threadId: string,
): Promise<{ messageId?: string; references?: string }> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!res.ok) return {};

  const raw = (await res.json()) as {
    messages?: Array<{ payload?: { headers?: Array<{ name: string; value: string }> } }>;
  };
  const last = raw.messages?.[raw.messages.length - 1];
  const headers = last?.payload?.headers;
  const messageId = header(headers, "Message-ID");
  const references = header(headers, "References");
  return {
    messageId: messageId || undefined,
    references: references || messageId || undefined,
  };
}
