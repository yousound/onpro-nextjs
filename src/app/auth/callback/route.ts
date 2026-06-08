import { NextResponse } from "next/server";
import { avatarFromAuthMetadata } from "@/lib/current-user-display";
import { fetchProfile, upsertProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        const oauthAvatar = avatarFromAuthMetadata(user);
        if (oauthAvatar) {
          try {
            const profile = await fetchProfile(supabase, user.id);
            if (!profile?.avatar_url?.trim()) {
              await upsertProfile(supabase, user.id, user.email, {
                avatar_url: oauthAvatar,
              });
            }
          } catch {
            /* profile table may be missing columns — /api/profile will retry */
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
