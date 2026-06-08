import { fetchWorkspaceHasContent } from "@/lib/workspace-has-content";
import type { SupabaseClient } from "@supabase/supabase-js";

async function profileEligibleForWelcome(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, workspace_welcome_dismissed_at")
    .eq("id", userId)
    .maybeSingle();

  if (!error) {
    return Boolean(data?.onboarding_completed_at && !data.workspace_welcome_dismissed_at);
  }

  if (error.code === "42703" || error.code === "PGRST204") {
    const { data: slim, error: slimError } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle();
    if (slimError) throw slimError;
    return Boolean(slim?.onboarding_completed_at);
  }

  throw error;
}

/** Whether to show the post-onboarding “Let’s get you started” modal (empty workspace only). */
export async function fetchWorkspaceWelcomeShow(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const eligible = await profileEligibleForWelcome(supabase, userId);
  if (!eligible) return false;
  const hasContent = await fetchWorkspaceHasContent(supabase, userId);
  return !hasContent;
}
