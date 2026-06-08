import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  completeClientOnboarding,
  saveClientProfileFields,
} from "@/lib/supabase/onboarding";
import { OnboardingSchemaError, updateProfileFields } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

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
    full_name?: string;
    username?: string;
    company_name?: string;
    phone?: string;
    avatar_url?: string | null;
    redirect_after?: string;
    profile_only?: boolean;
    complete?: boolean;
  };

  if (!body.full_name?.trim()) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  const patch = {
    full_name: body.full_name.trim(),
    username: body.username?.trim(),
    company_name: body.company_name?.trim(),
    phone: body.phone?.trim(),
    avatar_url: body.avatar_url,
    redirect_after: body.redirect_after?.trim(),
  };

  try {
    if (body.profile_only) {
      await saveClientProfileFields(supabase, user.id, user.email, patch);
      return NextResponse.json({ ok: true, step: 1 });
    }

    if (body.redirect_after?.trim()) {
      await updateProfileFields(supabase, user.id, user.email, {
        redirect_after_onboarding: body.redirect_after.trim(),
        account_kind: "client",
      });
    }

    const result = await completeClientOnboarding(supabase, user.id, user.email, patch);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof OnboardingSchemaError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
