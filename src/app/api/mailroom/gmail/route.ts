import { NextResponse } from "next/server";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { isGmailOAuthConfigured } from "@/lib/gmail/env";
import {
  deleteGmailConnection,
  getGmailConnectionForUser,
  isMissingGmailTableError,
} from "@/lib/supabase/gmail-connection";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const live = await isLiveBackendEnabled();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ connected: false, email: null, mode: "unauthenticated" }, { status: 401 });
  }

  if (!live) {
    return NextResponse.json({
      connected: false,
      email: null,
      mode: "mock",
      oauthConfigured: isGmailOAuthConfigured(),
      message: "Switch to Mock mode to use demo inbox threads, or stay on Live and connect Gmail.",
    });
  }

  if (!isGmailOAuthConfigured()) {
    return NextResponse.json({
      connected: false,
      email: null,
      mode: "oauth_not_configured",
      oauthConfigured: false,
      message: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, then connect Gmail.",
    });
  }

  try {
    const connection = await getGmailConnectionForUser(user.id);
    return NextResponse.json({
      connected: Boolean(connection),
      email: connection?.email ?? null,
      mode: "gmail",
      oauthConfigured: true,
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (isMissingGmailTableError(err) || err.message?.includes("user_gmail_connections")) {
      return NextResponse.json({
        connected: false,
        email: null,
        mode: "db_migration_required",
        oauthConfigured: true,
        message:
          "Run supabase/migrations/003_user_gmail.sql in your Supabase project (SQL editor), then reload Mailroom.",
      });
    }
    throw e;
  }
}

export async function DELETE() {
  const live = await isLiveBackendEnabled();
  if (!live) {
    return NextResponse.json({ error: "Only available in Live mode" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteGmailConnection(user.id);
  return NextResponse.json({ connected: false, email: null });
}

/** Mock-only connect for local demo (blocked in Live). */
export async function POST() {
  const live = await isLiveBackendEnabled();
  if (live) {
    return NextResponse.json(
      { error: "Use GET /api/mailroom/gmail/connect for real Gmail OAuth in Live mode." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    connected: true,
    email: user?.email ?? "demo@onpro.app",
    mode: "mock",
  });
}
