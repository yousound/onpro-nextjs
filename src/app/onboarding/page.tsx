import { Suspense } from "react";
import { redirect } from "next/navigation";
import { OnboardingLanding } from "@/components/onboarding/onboarding-landing";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { onboardingStatusFromProfile } from "@/lib/supabase/onboarding";
import { fetchProfile } from "@/lib/supabase/profile";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <OnboardingLanding />;
  }

  const profile = await fetchProfile(supabase, user.id);
  const initial = onboardingStatusFromProfile(profile, user.email ?? "");

  if (initial.completed) {
    const dest = initial.redirectAfter ?? "/";
    const sep = dest.includes("?") ? "&" : "?";
    redirect(`${dest}${sep}welcome=1`);
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center text-sm text-text-secondary">
          Loading…
        </div>
      }
    >
      <OnboardingGate initial={initial} />
    </Suspense>
  );
}
