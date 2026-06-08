"use client";

import { SignupIntentLanding } from "@/components/onboarding/signup-intent-landing";

/** Public entry: choose client vs operator before sign up. */
export function OnboardingLanding() {
  return <SignupIntentLanding loginHref="/login" />;
}
