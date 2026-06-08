import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { updateProfileFields } from "@/lib/supabase/profile";
import { OnboardingSchemaError } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import type { AccountKind } from "@/lib/types/onboarding";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    account_kind?: AccountKind;
    redirect_after?: string;
  };

  try {
    const patch: Record<string, unknown> = {};
    if (body.account_kind) patch.account_kind = body.account_kind;
    if (body.redirect_after?.trim()) patch.redirect_after_onboarding = body.redirect_after.trim();

    await updateProfileFields(supabase, user.id, user.email, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof OnboardingSchemaError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
