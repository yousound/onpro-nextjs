import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { fetchMemberWorkspaceTeams } from "@/lib/supabase/workspace-memberships";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ teams: [], joined: [], pending: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const teams = await fetchMemberWorkspaceTeams(supabase, user.id, user.email);
    const joined = teams.filter((t) => t.alreadyJoined);
    const pending = teams.filter((t) => !t.alreadyJoined);
    return NextResponse.json({ teams, joined, pending });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    return NextResponse.json({ error: msg, teams: [] }, { status: 400 });
  }
}
