import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  completeOperatorOnboarding,
  provisionOnboardingTeamInvites,
} from "@/lib/supabase/onboarding";
import { fetchProfile, updateProfileFields } from "@/lib/supabase/profile";
import { OnboardingSchemaError } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";
import type { TeamInviteDraft } from "@/lib/types/onboarding";

type Body = {
  action?: "save_step" | "complete";
  step?: number;
  workspace_name?: string;
  company_name?: string;
  full_name?: string;
  username?: string;
  avatar_url?: string | null;
  operator_role?: string;
  business_type?: string;
  invites?: TeamInviteDraft[];
  send_invite_emails?: boolean;
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;

  try {
    if (body.action === "complete") {
      const result = await completeOperatorOnboarding(supabase, user.id, user.email);
      return NextResponse.json(result);
    }

    const patch: Record<string, unknown> = { id: user.id, email: user.email };
    if (body.full_name !== undefined) patch.full_name = body.full_name.trim() || null;
    if (body.username !== undefined) patch.username = body.username.trim() || null;
    if (body.avatar_url !== undefined) patch.avatar_url = body.avatar_url;
    if (body.company_name !== undefined) patch.company_name = body.company_name.trim() || null;
    if (body.workspace_name !== undefined) patch.workspace_name = body.workspace_name.trim() || null;
    if (body.operator_role !== undefined) patch.operator_role = body.operator_role.trim() || null;
    if (body.business_type !== undefined) patch.business_type = body.business_type.trim() || null;
    if (body.step !== undefined) patch.onboarding_step = body.step;

    await updateProfileFields(supabase, user.id, user.email, patch);

    const profile = await fetchProfile(supabase, user.id);

    let inviteLinks: Awaited<ReturnType<typeof provisionOnboardingTeamInvites>> = [];
    if (body.step === 3 && body.invites?.length) {
      const origin = new URL(request.url).origin;
      inviteLinks = await provisionOnboardingTeamInvites(
        supabase,
        user.id,
        body.invites,
        profile?.company_name ?? profile?.workspace_name,
        origin,
        body.send_invite_emails !== false,
      );
    }

    const updated = await fetchProfile(supabase, user.id);
    return NextResponse.json({
      ok: true,
      step: updated?.onboarding_step ?? body.step,
      inviteLinks,
    });
  } catch (e) {
    if (e instanceof OnboardingSchemaError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
