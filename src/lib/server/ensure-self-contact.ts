import { isLiveBackendEnabled } from "@/lib/config/backend";
import { ensureSelfTeamContact } from "@/lib/supabase/onboarding";
import { fetchProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

/** Ensures the signed-in user appears on their own Team list in Contacts (Live only). */
export async function ensureSelfTeamContactForSession(): Promise<void> {
  if (!(await isLiveBackendEnabled())) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await fetchProfile(supabase, user.id);
  if (!profile?.onboarding_completed_at) return;
  if (profile.account_kind === "client") return;

  await ensureSelfTeamContact(supabase, user.id, profile);
}
