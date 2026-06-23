import { buildMimeMessage, mimeToGmailRaw, type BuildMimeMessageInput } from "@/lib/gmail/build-mime-message";

export type SendGmailMessageInput = BuildMimeMessageInput & {
  /** Gmail thread id (not `gmail-` prefixed). */
  threadId?: string;
};

export type SendGmailMessageResult = {
  id: string;
  threadId: string;
  labelIds?: string[];
};

export async function sendGmailMessage(
  accessToken: string,
  input: SendGmailMessageInput,
): Promise<SendGmailMessageResult> {
  const mime = buildMimeMessage(input);
  const raw = mimeToGmailRaw(mime);

  const body: { raw: string; threadId?: string } = { raw };
  if (input.threadId) body.threadId = input.threadId;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const json = (await res.json()) as { id?: string; threadId?: string; labelIds?: string[] };
  if (!json.id || !json.threadId) {
    throw new Error("Gmail send returned an unexpected response.");
  }

  return { id: json.id, threadId: json.threadId, labelIds: json.labelIds };
}
