import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { fetchJoinedTeamsForMember } from "@/lib/supabase/workspace-memberships";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ teams: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const teams = await fetchJoinedTeamsForMember(supabase, user.id);
    return NextResponse.json({ teams });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    return NextResponse.json({ error: msg, teams: [] }, { status: 400 });
  }
}
