export function isGmailOAuthConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(id && secret && !id.includes("your-") && !secret.includes("your-"));
}

export function gmailRedirectUri(origin: string): string {
  const configured = process.env.GOOGLE_GMAIL_REDIRECT_URI?.trim();
  if (configured) return configured;
  return `${origin.replace(/\/$/, "")}/api/mailroom/gmail/callback`;
}

/** Gmail + Google Calendar (same OAuth connection as Mailroom). */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
  "profile",
].join(" ");

/** Full Pub/Sub topic name, e.g. projects/my-project/topics/gmail-mailroom */
export function gmailPubSubTopic(): string | null {
  const topic = process.env.GMAIL_PUBSUB_TOPIC?.trim();
  return topic || null;
}

export function isGmailPushConfigured(): boolean {
  return Boolean(gmailPubSubTopic());
}
