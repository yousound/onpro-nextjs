import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import { buildGmailAuthUrl } from "@/lib/gmail/oauth";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE = "onpro_gmail_oauth_state";

export async function GET(request: Request) {
  if (!(await isLiveBackendEnabled())) {
    return NextResponse.redirect(new URL("/mailroom?gmail=mock_mode", request.url));
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.redirect(new URL("/mailroom?gmail=not_configured", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/mailroom", request.url));
  }

  const state = crypto.randomUUID();
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const origin = new URL(request.url).origin;
  const url = buildGmailAuthUrl(origin, state);
  return NextResponse.redirect(url);
}
