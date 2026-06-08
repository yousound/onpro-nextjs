import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { onboardingStatusFromProfile } from "@/lib/supabase/onboarding";
import { fetchProfile, OnboardingSchemaError } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const profile = await fetchProfile(supabase, user.id);
    return NextResponse.json(onboardingStatusFromProfile(profile, user.email ?? ""));
  } catch (e) {
    if (e instanceof OnboardingSchemaError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
}
