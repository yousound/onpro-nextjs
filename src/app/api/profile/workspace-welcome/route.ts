import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { updateProfileFields } from "@/lib/supabase/profile";
import { fetchWorkspaceHasContent } from "@/lib/workspace-has-content";
import { fetchWorkspaceWelcomeShow } from "@/lib/supabase/workspace-welcome";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ show: false });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ show: false });

  try {
    const [show, hasContent] = await Promise.all([
      fetchWorkspaceWelcomeShow(supabase, user.id),
      fetchWorkspaceHasContent(supabase, user.id),
    ]);
    return NextResponse.json({ show, hasContent, aiPath: "/" });
  } catch (e) {
    console.warn("[workspace-welcome]", e);
    return NextResponse.json({ show: false, error: "profile_fetch_failed" }, { status: 500 });
  }
}

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await updateProfileFields(supabase, user.id, user.email, {
      workspace_welcome_dismissed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[workspace-welcome] dismiss save failed", e);
  }
  return NextResponse.json({ ok: true });
}
