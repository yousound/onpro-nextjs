import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { revokeWorkspaceMembership } from "@/lib/supabase/workspace-memberships";
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

  const body = (await request.json()) as { membership_id?: number; contact_id?: number };

  try {
    let membershipId = body.membership_id;

    if (membershipId == null && body.contact_id != null) {
      const { data } = await supabase
        .from("workspace_memberships")
        .select("id")
        .eq("operator_user_id", user.id)
        .eq("contact_id", body.contact_id)
        .eq("status", "active")
        .maybeSingle();

      membershipId = data?.id as number | undefined;
    }

    if (membershipId == null || !Number.isFinite(membershipId)) {
      return NextResponse.json({ error: "membership_id or contact_id required" }, { status: 400 });
    }

    await revokeWorkspaceMembership(supabase, membershipId, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Revoke failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
