/** Shown when Google rejects a stored refresh token (expired, revoked, or OAuth app reset). */
export const GMAIL_REAUTH_USER_MESSAGE =
  "Your Google connection expired. Reconnect Gmail in Mailroom to continue syncing email and calendar.";

export class GmailReauthRequiredError extends Error {
  readonly code = "gmail_reauth_required" as const;

  constructor(message = GMAIL_REAUTH_USER_MESSAGE) {
    super(message);
    this.name = "GmailReauthRequiredError";
  }
}

export function isGmailReauthRequiredError(error: unknown): error is GmailReauthRequiredError {
  return error instanceof GmailReauthRequiredError;
}

export function googleTokenErrorNeedsReauth(responseText: string): boolean {
  try {
    const parsed = JSON.parse(responseText) as { error?: string };
    return parsed.error === "invalid_grant";
  } catch {
    return responseText.includes("invalid_grant");
  }
}

export function gmailReauthPayload(extra?: Record<string, unknown>) {
  return {
    needsReauth: true,
    connected: false,
    message: GMAIL_REAUTH_USER_MESSAGE,
    ...extra,
  };
}
