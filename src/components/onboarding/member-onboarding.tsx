"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OnboardingShell, type OnboardingStepItem } from "@/components/onboarding/onboarding-shell";
import {
  ClientOnboardingFeatureGrid,
  OnboardingAvatarUpload,
  OnboardingCelebrationGraphic,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingStepLabel,
  OnboardingSubtitle,
  OnboardingTitle,
  onboardingFieldClass,
  onboardingLabelClass,
} from "@/components/onboarding/onboarding-ui";
import type { OnboardingStatus } from "@/lib/types/onboarding";
import type { WorkspaceMatch } from "@/lib/types/workspace";
import { dispatchProfileChanged } from "@/lib/data/refresh-live-contacts";
import { markWorkspaceWelcomePending } from "@/lib/workspace-welcome-session";

const STEPS: OnboardingStepItem[] = [
  { id: 1, label: "Your info", description: "Set up your profile" },
  { id: 2, label: "Workspace", description: "Join your team" },
  { id: 3, label: "You're in", description: "Open projects" },
];

export function MemberOnboarding({ initial }: { initial: OnboardingStatus }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token")?.trim() ?? "";

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(initial.profile.displayName ?? "");
  const [fullName, setFullName] = useState(initial.profile.fullName ?? "");
  const [email] = useState(initial.profile.email ?? "");
  const [companyName, setCompanyName] = useState(initial.profile.companyName ?? "");
  const [phone, setPhone] = useState(initial.profile.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.profile.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [matches, setMatches] = useState<WorkspaceMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [joinedCount, setJoinedCount] = useState(0);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const redirectAfter =
    searchParams.get("next")?.trim() || initial.redirectAfter || "/";

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const res = await fetch("/api/onboarding/workspace-matches");
      const data = (await res.json()) as { matches?: WorkspaceMatch[] };
      setMatches(data.matches ?? []);
    } catch {
      setMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 2) void loadMatches();
  }, [step, loadMatches]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !displayName.trim()) {
      setError("Display name and full name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          username: displayName,
          company_name: companyName,
          phone,
          avatar_url: avatarUrl,
          redirect_after: redirectAfter,
          profile_only: true,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Could not save");
      }
      dispatchProfileChanged();

      if (inviteToken) {
        const joinRes = await fetch("/api/onboarding/join-workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_token: inviteToken }),
        });
        if (joinRes.ok) {
          setJoinedCount(1);
          setStep(3);
          return;
        }
        const joinErr = (await joinRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(joinErr?.error ?? "Could not accept invite");
      }

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function joinWorkspace(match: WorkspaceMatch) {
    const key = `${match.operatorUserId}:${match.contactId}`;
    setJoiningId(key);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/join-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_user_id: match.operatorUserId,
          contact_id: match.contactId,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Could not join");
      }
      setJoinedCount((n) => n + 1);
      setMatches((prev) =>
        prev.map((m) =>
          m.operatorUserId === match.operatorUserId && m.contactId === match.contactId
            ? { ...m, alreadyJoined: true }
            : m,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setJoiningId(null);
    }
  }

  async function finishOnboarding() {
    setSaving(true);
    try {
      await fetch("/api/onboarding/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          username: displayName,
          company_name: companyName,
          phone,
          avatar_url: avatarUrl,
          redirect_after: redirectAfter,
          complete: true,
        }),
      });
      dispatchProfileChanged();
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish");
    } finally {
      setSaving(false);
    }
  }

  function goToApp() {
    dispatchProfileChanged();
    markWorkspaceWelcomePending();
    const sep = redirectAfter.includes("?") ? "&" : "?";
    router.push(`${redirectAfter}${sep}welcome=1`);
    router.refresh();
  }

  const footer =
    step === 1 ? (
      <div className="flex justify-between gap-4">
        <OnboardingSecondaryButton disabled>Cancel</OnboardingSecondaryButton>
        <OnboardingPrimaryButton type="submit" form="member-onboarding-form" disabled={saving}>
          {saving ? "Saving…" : "Continue →"}
        </OnboardingPrimaryButton>
      </div>
    ) : step === 2 ? (
      <div className="flex justify-between gap-4">
        <OnboardingSecondaryButton onClick={() => setStep(1)}>← Back</OnboardingSecondaryButton>
        <OnboardingPrimaryButton onClick={() => void finishOnboarding()} disabled={saving}>
          {saving ? "Finishing…" : joinedCount > 0 ? "Continue →" : "Continue without joining →"}
        </OnboardingPrimaryButton>
      </div>
    ) : (
      <div className="flex justify-end">
        <OnboardingPrimaryButton onClick={goToApp}>Go to OnPro AI →</OnboardingPrimaryButton>
      </div>
    );

  return (
    <OnboardingShell steps={STEPS} currentStep={step} footer={footer}>
      {step === 1 ? (
        <>
          <OnboardingStepLabel>Step 1 of 3</OnboardingStepLabel>
          <OnboardingTitle>Join your team on OnPro</OnboardingTitle>
          <OnboardingSubtitle>
            Set up your profile to access projects, jobs, and messages in your workspace.
          </OnboardingSubtitle>
          <form id="member-onboarding-form" onSubmit={handleProfileSubmit} className="max-w-2xl">
            <OnboardingAvatarUpload
              avatarUrl={avatarUrl}
              onChange={setAvatarUrl}
              fallbackInitials={(displayName || fullName || "?").slice(0, 2).toUpperCase()}
            />
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={onboardingLabelClass}>Display name</span>
                <input
                  required
                  className={onboardingFieldClass}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Jordan"
                  autoComplete="nickname"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={onboardingLabelClass}>Full name</span>
                <input
                  required
                  className={onboardingFieldClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jordan Lee"
                  autoComplete="name"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className={onboardingLabelClass}>Email</span>
                <input
                  readOnly
                  className={`${onboardingFieldClass} bg-slate-50 text-slate-500`}
                  value={email}
                />
              </label>
              <label className="block">
                <span className={onboardingLabelClass}>Company (optional)</span>
                <input
                  className={onboardingFieldClass}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Void Star Manufacturing"
                />
              </label>
              <label className="block">
                <span className={onboardingLabelClass}>Phone (optional)</span>
                <input
                  className={onboardingFieldClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 415 123 4567"
                  autoComplete="tel"
                />
              </label>
            </div>
            {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
          </form>
        </>
      ) : step === 2 ? (
        <>
          <OnboardingStepLabel>Step 2 of 3</OnboardingStepLabel>
          <OnboardingTitle>Your workspace</OnboardingTitle>
          <OnboardingSubtitle>
            We found teams that listed your email. Join to open shared projects — or continue and ask for a
            fresh invite link.
          </OnboardingSubtitle>
          <div className="mt-8 max-w-2xl space-y-3">
            {matchesLoading ? (
              <p className="text-sm text-slate-500">Looking for workspaces…</p>
            ) : matches.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-6 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">No workspace match yet</p>
                <p className="mt-2 leading-relaxed">
                  Ask your workspace owner to send an invite from People, or add your email on your contact
                  record.
                </p>
              </div>
            ) : (
              matches.map((match) => {
                const key = `${match.operatorUserId}:${match.contactId}`;
                const joining = joiningId === key;
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{match.workspaceName}</p>
                      <p className="text-sm text-slate-500">
                        {match.contactDisplayName} · {match.projectCount}{" "}
                        {match.projectCount === 1 ? "project" : "projects"}
                      </p>
                    </div>
                    {match.alreadyJoined ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                        Joined
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={joining}
                        onClick={() => void joinWorkspace(match)}
                        className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-50"
                      >
                        {joining ? "Joining…" : "Join workspace"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-3xl text-center">
          <OnboardingStepLabel>Step 3 of 3</OnboardingStepLabel>
          <OnboardingCelebrationGraphic />
          <OnboardingTitle>You&apos;re in!</OnboardingTitle>
          <OnboardingSubtitle centered>
            {joinedCount > 0 ? (
              <>
                You joined {joinedCount} workspace{joinedCount === 1 ? "" : "s"}. Open Projects to see work
                shared with you.
              </>
            ) : (
              <>
                Your profile is ready. When you join a workspace, projects will appear under Projects.
              </>
            )}
          </OnboardingSubtitle>
          <ClientOnboardingFeatureGrid />
          <p className="mt-8 text-sm text-slate-500">
            {joinedCount > 0
              ? "We'll take you to OnPro AI next."
              : "We'll take you to OnPro AI — join a workspace when your invite arrives."}
          </p>
        </div>
      )}
    </OnboardingShell>
  );
}
