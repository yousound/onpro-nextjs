import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeGmailCode } from "@/lib/gmail/oauth";
import { fetchGoogleUserEmail } from "@/lib/gmail/fetch-threads";
import { upsertGmailConnection } from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE = "onpro_gmail_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${origin}/mailroom?gmail=denied`);
  }

  const store = await cookies();
  const expectedState = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/mailroom?gmail=invalid_state`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=/mailroom`);
  }

  try {
    const tokens = await exchangeGmailCode(origin, code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/mailroom?gmail=no_refresh`);
    }
    const email = await fetchGoogleUserEmail(tokens.access_token);
    await upsertGmailConnection({
      user_id: user.id,
      email,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      scopes: tokens.scope,
    });
    return NextResponse.redirect(`${origin}/mailroom?gmail=connected`);
  } catch (e) {
    console.error("[gmail/callback]", e);
    return NextResponse.redirect(`${origin}/mailroom?gmail=error`);
  }
}
