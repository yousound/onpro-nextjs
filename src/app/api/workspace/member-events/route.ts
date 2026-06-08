import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  fetchUnreadMemberEvents,
  markMemberEventsRead,
} from "@/lib/supabase/workspace-memberships";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ events: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const events = await fetchUnreadMemberEvents(supabase, user.id);
    return NextResponse.json({ events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ events: [], error: msg });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { event_ids?: number[] };
  const ids = body.event_ids ?? [];

  try {
    await markMemberEventsRead(supabase, user.id, ids);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
