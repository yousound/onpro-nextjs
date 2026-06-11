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
    const { splitWorkspaceTeams } = await import("@/lib/workspace-team-filters");
    const { joined, pending } = splitWorkspaceTeams(teams, user.id);
    return NextResponse.json({ teams, joined, pending, authUserId: user.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    return NextResponse.json({ error: msg, teams: [] }, { status: 400 });
  }
}
