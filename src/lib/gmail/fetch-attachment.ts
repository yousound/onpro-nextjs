/** Fetch Gmail attachment bytes (base64url) for inline images. */
export async function fetchGmailAttachmentData(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<string | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: string };
  return json.data?.trim() || null;
}

export function attachmentDataToDataUrl(mimeType: string, base64url: string): string {
  const normalized = base64url.replace(/-/g, "+").replace(/_/g, "/");
  return `data:${mimeType};base64,${normalized}`;
}
