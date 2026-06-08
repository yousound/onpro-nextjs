import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { fetchMembershipForContact } from "@/lib/supabase/workspace-memberships";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ membership: null });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contactId = Number(new URL(request.url).searchParams.get("contact_id"));
  if (!Number.isFinite(contactId)) {
    return NextResponse.json({ error: "contact_id required" }, { status: 400 });
  }

  try {
    const membership = await fetchMembershipForContact(supabase, user.id, contactId);
    return NextResponse.json({ membership });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
