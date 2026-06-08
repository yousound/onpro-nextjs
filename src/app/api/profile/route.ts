import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  avatarFromAuthMetadata,
  buildCurrentUserDisplay,
  type CurrentUserDisplay,
} from "@/lib/current-user-display";
import { fetchProfile, upsertProfile } from "@/lib/supabase/profile";
import {
  normalizeStoredAvatarUrl,
  resolveAvatarUrlForUser,
} from "@/lib/supabase/resolve-profile-avatar";
import { createClient } from "@/lib/supabase/server";

/** Signed-in user display (name, avatar, company) for sidebar and Settings. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const oauthAvatar = avatarFromAuthMetadata(user);
    let profile = await fetchProfile(supabase, user.id);

    if (!profile) {
      const metaName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "";
      profile = await upsertProfile(supabase, user.id, user.email, {
        full_name: metaName || user.email.split("@")[0] || "User",
        avatar_url: oauthAvatar,
      });
    }

    const resolvedAvatar = await resolveAvatarUrlForUser(
      supabase,
      user.id,
      user.email,
      profile.avatar_url,
      oauthAvatar,
    );
    const profileAvatar = normalizeStoredAvatarUrl(profile.avatar_url);
    if (resolvedAvatar && resolvedAvatar !== profileAvatar) {
      profile = await upsertProfile(supabase, user.id, user.email, {
        avatar_url: resolvedAvatar,
      });
    } else if (resolvedAvatar && !profile.avatar_url) {
      profile = { ...profile, avatar_url: resolvedAvatar };
    }

    if (resolvedAvatar && profile.self_contact_id != null) {
      await supabase
        .from("contacts")
        .update({ avatar_url: resolvedAvatar })
        .eq("id", profile.self_contact_id)
        .eq("user_id", user.id);
    } else if (resolvedAvatar) {
      await supabase
        .from("contacts")
        .update({ avatar_url: resolvedAvatar })
        .eq("user_id", user.id)
        .eq("role", "Team")
        .ilike("email", user.email.trim());
    }

    const display: CurrentUserDisplay = buildCurrentUserDisplay(user, profile);
    return NextResponse.json({ user: display });
  } catch (e) {
    console.error("[api/profile] GET", e);
    const oauthAvatar = avatarFromAuthMetadata(user);
    const fallbackAvatar = await resolveAvatarUrlForUser(
      supabase,
      user.id,
      user.email,
      null,
      oauthAvatar,
    );
    const display = buildCurrentUserDisplay(user, {
      id: user.id,
      username: null,
      full_name:
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : null) || user.email.split("@")[0],
      email: user.email,
      phone: null,
      company_name: null,
      business_address: null,
      business_phone: null,
      avatar_url: fallbackAvatar,
      onboarding_completed_at: null,
      account_kind: "operator",
      workspace_name: null,
      operator_company_code: null,
      operator_role: null,
      business_type: null,
      onboarding_step: 0,
      redirect_after_onboarding: null,
      self_contact_id: null,
      workspace_welcome_dismissed_at: null,
    });
    return NextResponse.json({ user: display });
  }
}

/** Link an uploaded storage URL to the signed-in user's profile row. */
export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { avatar_url?: string | null };
  const avatar = normalizeStoredAvatarUrl(body.avatar_url);
  if (!avatar) {
    return NextResponse.json({ error: "Invalid avatar_url" }, { status: 400 });
  }

  const profile = await upsertProfile(supabase, user.id, user.email, { avatar_url: avatar });
  const display = buildCurrentUserDisplay(user, profile);
  return NextResponse.json({ user: display });
}
