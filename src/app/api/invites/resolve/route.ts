import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { resolveInviteToken } from "@/lib/supabase/pending-invites";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ valid: false, error: "token required" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ valid: false, error: "Supabase not configured" });
  }

  const supabase = await createClient();

  try {
    const resolved = await resolveInviteToken(supabase, token);
    return NextResponse.json(resolved);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Resolve failed";
    return NextResponse.json({ valid: false, error: msg });
  }
}
