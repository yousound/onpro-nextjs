import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  ACTIVE_WORKSPACE_COOKIE,
  activeWorkspaceCookieValue,
} from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: "self" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { operator_user_id?: string | null };
  const requested = body.operator_user_id?.trim() || null;

  if (requested && requested !== user.id) {
    const { data, error } = await supabase
      .from("workspace_memberships")
      .select("id")
      .eq("operator_user_id", requested)
      .eq("member_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "You are not a member of that workspace" }, { status: 403 });
    }
  }

  const cookieValue = activeWorkspaceCookieValue(
    requested && requested !== user.id ? requested : null,
  );

  const res = NextResponse.json({
    ok: true,
    mode: cookieValue === "self" ? "self" : "team",
    operatorUserId: cookieValue === "self" ? user.id : requested,
  });

  res.cookies.set(ACTIVE_WORKSPACE_COOKIE, cookieValue, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });

  return res;
}
