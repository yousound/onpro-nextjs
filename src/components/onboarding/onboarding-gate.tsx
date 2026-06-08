"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientOnboarding } from "@/components/onboarding/client-onboarding";
import { MemberOnboarding } from "@/components/onboarding/member-onboarding";
import { OperatorOnboarding } from "@/components/onboarding/operator-onboarding";
import type { OnboardingStatus } from "@/lib/types/onboarding";
import { markWorkspaceWelcomePending } from "@/lib/workspace-welcome-session";

export function OnboardingGate({ initial }: { initial: OnboardingStatus }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    const kind = searchParams.get("kind");
    const next = searchParams.get("next");
    if (!kind && !next) return;
    void fetch("/api/onboarding/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_kind: kind === "client" ? "client" : "operator",
        redirect_after: next ?? undefined,
      }),
    }).then(() =>
      fetch("/api/onboarding/status")
        .then((r) => r.json())
        .then((s) => setStatus(s as OnboardingStatus)),
    );
  }, [searchParams]);

  useEffect(() => {
    if (status.completed) {
      markWorkspaceWelcomePending();
      const base = status.redirectAfter ?? "/";
      const sep = base.includes("?") ? "&" : "?";
      router.replace(`${base}${sep}welcome=1`);
    }
  }, [status.completed, status.redirectAfter, router]);

  /** New signups land with step 0 — advance to workspace setup immediately. */
  useEffect(() => {
    if (status.accountKind !== "operator" || status.completed || status.step > 0) return;
    void fetch("/api/onboarding/operator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_step", step: 1 }),
    }).then(() =>
      fetch("/api/onboarding/status")
        .then((r) => r.json())
        .then((s) => setStatus(s as OnboardingStatus)),
    );
  }, [status.accountKind, status.completed, status.step]);

  if (status.completed) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-text-secondary">
        Redirecting…
      </div>
    );
  }

  if (status.accountKind === "client") {
    return <ClientOnboarding initial={status} />;
  }

  if (status.accountKind === "member") {
    return <MemberOnboarding initial={status} />;
  }

  return <OperatorOnboarding initial={status} />;
}
