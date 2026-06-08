import { buildCurrentUserDisplay } from "@/lib/current-user-display";
import { fetchProfile } from "@/lib/supabase/profile";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve first name from auth + profile in live mode (ignore client-sent demo names). */
export async function resolveAssistantUserName(
  supabase: SupabaseClient,
  clientFallback?: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return clientFallback?.trim() || "there";
  const profile = await fetchProfile(supabase, user.id);
  return buildCurrentUserDisplay(user, profile).firstName;
}
