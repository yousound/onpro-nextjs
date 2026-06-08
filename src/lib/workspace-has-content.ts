import { getGmailConnectionForUser } from "@/lib/supabase/gmail-connection";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Workspace has real data — skip “Let’s get you started” and land on OnPro AI. */
export async function fetchWorkspaceHasContent(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const [{ count: projectCount, error: projectError }, { count: contactCount, error: contactError }] =
    await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("contacts").select("id", { count: "exact", head: true }),
    ]);

  if (projectError) throw projectError;
  if (contactError) throw contactError;

  if ((projectCount ?? 0) > 0) return true;

  const gmail = await getGmailConnectionForUser(userId);
  if (gmail) return true;

  // Onboarding usually creates a self contact; more than one means imports / team / clients.
  if ((contactCount ?? 0) > 1) return true;

  return false;
}
