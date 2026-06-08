import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { loginUrlForPendingInvite } from "@/lib/supabase/pending-invites";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { invite_id?: string; refresh_expiry?: boolean };
  const inviteId = body.invite_id?.trim();
  if (!inviteId) {
    return NextResponse.json({ error: "invite_id required" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    const loginUrl = await loginUrlForPendingInvite(
      supabase,
      user.id,
      inviteId,
      origin,
      { refreshExpiry: body.refresh_expiry !== false },
    );
    return NextResponse.json({ ok: true, loginUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not get invite link";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
