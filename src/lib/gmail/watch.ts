import { gmailPubSubTopic } from "@/lib/gmail/env";
import { updateGmailSyncState } from "@/lib/supabase/gmail-inbox-cache";

export type GmailWatchResult = {
  historyId: string;
  expiration: string;
};

/** Start Gmail push notifications via Cloud Pub/Sub (no-op when topic not configured). */
export async function startGmailWatch(
  accessToken: string,
  userId: string,
): Promise<GmailWatchResult | null> {
  const topicName = gmailPubSubTopic();
  if (!topicName) return null;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "include",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn("[gmail/watch] watch failed", res.status, text.slice(0, 200));
    return null;
  }

  const json = (await res.json()) as { historyId?: string | number; expiration?: string | number };
  if (!json.historyId || !json.expiration) return null;

  const historyId = String(json.historyId);
  const expirationMs = Number(json.expiration);
  const watchExpiration = Number.isFinite(expirationMs)
    ? new Date(expirationMs).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await updateGmailSyncState(
    userId,
    { history_id: historyId, watch_expiration: watchExpiration },
    { service: true },
  );

  return { historyId, expiration: watchExpiration };
}

export async function stopGmailWatch(accessToken: string): Promise<void> {
  await fetch("https://gmail.googleapis.com/gmail/v1/users/me/stop", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => undefined);
}

export function watchNeedsRenewal(watchExpiration: string | null | undefined): boolean {
  if (!watchExpiration) return true;
  return new Date(watchExpiration).getTime() - Date.now() < 24 * 60 * 60 * 1000;
}
