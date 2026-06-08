import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { findWorkspacesForEmail } from "@/lib/supabase/workspace-memberships";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ matches: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.email_confirmed_at) {
    return NextResponse.json({ matches: [], emailVerified: false });
  }

  try {
    const matches = await findWorkspacesForEmail(supabase, user.email, user.id);
    return NextResponse.json({ matches, emailVerified: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    if (msg.includes("find_workspaces_for_email")) {
      return NextResponse.json({
        matches: [],
        schemaMissing: true,
        hint: "Run migrations 008_workspace_memberships.sql and 013_workspace_member_team_vendor.sql",
      });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
