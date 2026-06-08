import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  deletePendingInvite,
  fetchPendingInvitesForOperator,
  pendingInviteToUiRow,
} from "@/lib/supabase/pending-invites";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ invites: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const invites = await fetchPendingInvitesForOperator(supabase, user.id);
    return NextResponse.json({ invites: invites.map(pendingInviteToUiRow) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ invites: [], error: msg });
  }
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const inviteId = new URL(request.url).searchParams.get("id")?.trim();
  if (!inviteId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    await deletePendingInvite(supabase, user.id, inviteId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
