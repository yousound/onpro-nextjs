import { isGmailReauthRequiredError } from "@/lib/gmail/auth-errors";
import { refreshGmailAccessToken } from "@/lib/gmail/oauth";
import { clearGmailInboxCache } from "@/lib/supabase/gmail-inbox-cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/** PostgREST: 42P01 (relation missing) or PGRST205 (schema cache). */
export function isMissingGmailTableError(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return Boolean(error.message?.includes("user_gmail_connections"));
}

export type GmailConnectionRow = {
  user_id: string;
  email: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

export async function getGmailConnectionForUser(
  userId: string,
): Promise<GmailConnectionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_gmail_connections")
    .select("user_id, email, refresh_token, access_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingGmailTableError(error)) {
      console.warn("[gmail] user_gmail_connections table missing — run supabase/migrations/003_user_gmail.sql");
      return null;
    }
    throw error;
  }
  return data as GmailConnectionRow | null;
}

/** Service role lookup (webhooks / Pub/Sub — no user session). */
export async function getGmailConnectionForUserService(
  userId: string,
): Promise<GmailConnectionRow | null> {
  const supabase = createServiceClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_gmail_connections")
    .select("user_id, email, refresh_token, access_token, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingGmailTableError(error)) return null;
    throw error;
  }
  return data as GmailConnectionRow | null;
}

export async function upsertGmailConnection(row: {
  user_id: string;
  email: string;
  refresh_token: string;
  access_token: string;
  expires_in: number;
  scopes?: string;
}): Promise<void> {
  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + row.expires_in * 1000).toISOString();
  const { error } = await supabase.from("user_gmail_connections").upsert({
    user_id: row.user_id,
    email: row.email,
    refresh_token: row.refresh_token,
    access_token: row.access_token,
    access_token_expires_at: expiresAt,
    scopes: row.scopes ?? null,
  });
  if (error) {
    if (isMissingGmailTableError(error)) {
      throw new Error(
        "Database table user_gmail_connections is missing. Run supabase/migrations/003_user_gmail.sql in the Supabase SQL editor.",
      );
    }
    throw error;
  }
}

export async function deleteGmailConnection(
  userId: string,
  opts?: { admin?: boolean },
): Promise<void> {
  const supabase = (opts?.admin ? createServiceClient() : null) ?? (await createClient());
  const { error } = await supabase.from("user_gmail_connections").delete().eq("user_id", userId);
  if (error && !isMissingGmailTableError(error)) throw error;
  try {
    await clearGmailInboxCache(userId);
  } catch {
    /* best effort — session may be missing on service routes */
  }
}

/** Returns a valid access token, refreshing when expired. */
export async function getValidGmailAccessToken(
  connection: GmailConnectionRow,
  opts?: { admin?: boolean },
): Promise<{ accessToken: string; connection: GmailConnectionRow }> {
  const expires = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  const stillValid =
    connection.access_token && expires > Date.now() + 60_000;

  if (stillValid && connection.access_token) {
    return { accessToken: connection.access_token, connection };
  }

  let tokens;
  try {
    tokens = await refreshGmailAccessToken(connection.refresh_token);
  } catch (e) {
    if (isGmailReauthRequiredError(e)) {
      await deleteGmailConnection(connection.user_id, { admin: opts?.admin });
    }
    throw e;
  }
  const supabase = (opts?.admin ? createServiceClient() : null) ?? (await createClient());
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase
    .from("user_gmail_connections")
    .update({
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
    })
    .eq("user_id", connection.user_id);

  return {
    accessToken: tokens.access_token,
    connection: {
      ...connection,
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
    },
  };
}
