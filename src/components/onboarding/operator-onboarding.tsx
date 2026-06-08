"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { OnboardingShell, type OnboardingStepItem } from "@/components/onboarding/onboarding-shell";
import {
  FolderIcon,
  MailIcon,
  OnboardingAvatarUpload,
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
  OnboardingStepLabel,
  OnboardingSubtitle,
  OnboardingTitle,
  OnboardingWhatsNext,
  RocketIcon,
  UserPlusIcon,
  onboardingFieldClass,
  onboardingLabelClass,
} from "@/components/onboarding/onboarding-ui";
import { markWorkspaceWelcomePending } from "@/lib/workspace-welcome-session";
import type { OnboardingInviteLink } from "@/lib/supabase/onboarding";
import {
  BUSINESS_TYPE_OPTIONS,
  OPERATOR_ROLE_OPTIONS,
  type OnboardingStatus,
  type TeamInviteDraft,
} from "@/lib/types/onboarding";

const TOTAL_STEPS = 4;

const STEPS: OnboardingStepItem[] = [
  { id: 1, label: "Workspace", description: "Set up your workspace" },
  { id: 2, label: "Business", description: "Tell us about your business" },
  { id: 3, label: "Team", description: "Invite your team" },
  { id: 4, label: "Launch", description: "You're all set!" },
];

/** Map legacy 7-step progress to the new 4-step wizard. */
function normalizeOperatorStep(stored: number): number {
  if (stored <= 0) return 1;
  if (stored <= 2) return stored;
  if (stored === 3) return 3;
  if (stored === 4) return 3;
  return 4;
}

async function saveOperatorStep(
  body: Record<string, unknown>,
): Promise<{ inviteLinks?: OnboardingInviteLink[] }> {
  const res = await fetch("/api/onboarding/operator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save_step", ...body }),
  });
  const data = (await res.json()) as { error?: string; inviteLinks?: OnboardingInviteLink[] };
  if (!res.ok) {
    throw new Error(data.error ?? "Could not save");
  }
  return { inviteLinks: data.inviteLinks };
}

export function OperatorOnboarding({ initial }: { initial: OnboardingStatus }) {
  const router = useRouter();
  const [step, setStep] = useState(() => normalizeOperatorStep(initial.step || 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState(initial.profile.workspaceName ?? "");
  const [companyName, setCompanyName] = useState(initial.profile.companyName ?? "");
  const [displayName, setDisplayName] = useState(initial.profile.displayName ?? "");
  const [fullName, setFullName] = useState(initial.profile.fullName ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.profile.avatarUrl ?? null);
  const [operatorRole, setOperatorRole] = useState(initial.profile.operatorRole ?? "");
  const [businessType, setBusinessType] = useState(initial.profile.businessType ?? "");
  const [invites, setInvites] = useState<TeamInviteDraft[]>([
    { name: "", email: "", role: "" },
    { name: "", email: "", role: "" },
    { name: "", email: "", role: "" },
  ]);
  const [sendInviteEmails, setSendInviteEmails] = useState(true);
  const [inviteLinks, setInviteLinks] = useState<OnboardingInviteLink[]>([]);

  const goStep = useCallback((n: number) => setStep(n), []);

  async function persistAndGo(next: number, payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const result = await saveOperatorStep({ step: next, ...payload });
      if (result.inviteLinks?.length) setInviteLinks(result.inviteLinks);
      setStep(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!res.ok) throw new Error("Could not complete onboarding");
      markWorkspaceWelcomePending();
      router.push("/?welcome=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish");
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <div className="flex items-center justify-between gap-4">
      <OnboardingSecondaryButton disabled={step <= 1 || saving} onClick={() => goStep(step - 1)}>
        ← Back
      </OnboardingSecondaryButton>
      {step < TOTAL_STEPS ? (
        <OnboardingPrimaryButton
          disabled={saving}
          onClick={() => {
            if (step === 1) {
              if (
                !workspaceName.trim() ||
                !companyName.trim() ||
                !fullName.trim() ||
                !displayName.trim() ||
                !operatorRole
              ) {
                setError("Fill in workspace, company, display name, your name, and role.");
                return;
              }
              void persistAndGo(2, {
                workspace_name: workspaceName,
                company_name: companyName,
                full_name: fullName,
                username: displayName,
                avatar_url: avatarUrl,
                operator_role: operatorRole,
              });
            } else if (step === 2) {
              if (!businessType) {
                setError("Select a business type.");
                return;
              }
              void persistAndGo(3, { business_type: businessType });
            } else if (step === 3) {
              void persistAndGo(4, {
                invites: invites.filter((i) => i.email.trim() && i.name.trim()),
                send_invite_emails: sendInviteEmails,
              });
            }
          }}
        >
          {saving ? "Saving…" : "Next →"}
        </OnboardingPrimaryButton>
      ) : (
        <OnboardingPrimaryButton disabled={saving} onClick={() => void finish()}>
          {saving ? "Loading…" : "Go to workspace"}
        </OnboardingPrimaryButton>
      )}
    </div>
  );

  return (
    <OnboardingShell steps={STEPS} currentStep={step} footer={footer}>
      <OnboardingStepLabel>Step {step} of {TOTAL_STEPS}</OnboardingStepLabel>

      {step === 1 ? (
        <>
          <OnboardingTitle>Create your workspace</OnboardingTitle>
          <OnboardingSubtitle>This is the home for your projects, team, and operations.</OnboardingSubtitle>
          <OnboardingAvatarUpload
            avatarUrl={avatarUrl}
            onChange={setAvatarUrl}
            fallbackInitials={(displayName || fullName || "?").slice(0, 2).toUpperCase()}
          />
          <div className="mt-8 grid max-w-2xl gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={onboardingLabelClass}>Display name</span>
              <input
                className={onboardingFieldClass}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ric"
                autoComplete="nickname"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={onboardingLabelClass}>Full name</span>
              <input
                className={onboardingFieldClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ric Leung"
                autoComplete="name"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={onboardingLabelClass}>Workspace name</span>
              <input
                className={onboardingFieldClass}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Void Star Manufacturing"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={onboardingLabelClass}>Company name</span>
              <input
                className={onboardingFieldClass}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Void Star Manufacturing, Inc."
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={onboardingLabelClass}>Your role</span>
              <select
                className={onboardingFieldClass}
                value={operatorRole}
                onChange={(e) => setOperatorRole(e.target.value)}
              >
                <option value="">Select your role</option>
                {OPERATOR_ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <OnboardingTitle>What best describes your business?</OnboardingTitle>
          <OnboardingSubtitle>This helps OnPro tailor your workspace.</OnboardingSubtitle>
          <div className="mt-10 max-w-2xl space-y-3">
            {BUSINESS_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBusinessType(opt.id)}
                className={`flex w-full items-start gap-4 rounded-2xl border px-5 py-5 text-left transition ${
                  businessType === opt.id
                    ? "border-[#7c3aed] bg-violet-50 ring-2 ring-[#7c3aed]/25"
                    : "border-slate-200 bg-white hover:border-violet-200"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="text-base font-semibold text-slate-900">{opt.label}</span>
                  <span className="mt-1 block text-sm text-slate-500">{opt.description}</span>
                </span>
                <span
                  className={`mt-1 size-5 shrink-0 rounded-full border-2 ${
                    businessType === opt.id ? "border-[#7c3aed] bg-[#7c3aed]" : "border-slate-300"
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <OnboardingTitle>Invite your team</OnboardingTitle>
          <OnboardingSubtitle>
            Add teammates to collaborate in OnPro. You can always invite more later from People.
          </OnboardingSubtitle>
          <div className="mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
            <p className="text-base font-semibold text-slate-900">Add team members (optional)</p>
            <div className="mt-5 space-y-3">
              <div className="hidden gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:grid sm:grid-cols-[1fr_1fr_10rem_2rem]">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span />
              </div>
              {invites.map((row, idx) => (
                <div key={idx} className="grid gap-3 sm:grid-cols-[1fr_1fr_10rem_2rem] sm:items-center">
                  <input
                    placeholder="e.g. Jordan Lee"
                    className={onboardingFieldClass.replace("mt-2", "mt-0")}
                    value={row.name}
                    onChange={(e) => {
                      const next = [...invites];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setInvites(next);
                    }}
                  />
                  <input
                    placeholder="e.g. jordan@company.com"
                    type="email"
                    className={onboardingFieldClass.replace("mt-2", "mt-0")}
                    value={row.email}
                    onChange={(e) => {
                      const next = [...invites];
                      next[idx] = { ...next[idx], email: e.target.value };
                      setInvites(next);
                    }}
                  />
                  <select
                    className={onboardingFieldClass.replace("mt-2", "mt-0")}
                    value={row.role}
                    onChange={(e) => {
                      const next = [...invites];
                      next[idx] = { ...next[idx], role: e.target.value };
                      setInvites(next);
                    }}
                  >
                    <option value="">Select role</option>
                    {OPERATOR_ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setInvites((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex size-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Remove row"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInvites((prev) => [...prev, { name: "", email: "", role: "" }])}
              className="mt-4 text-sm font-semibold text-[#7c3aed] hover:underline"
            >
              + Add another person
            </button>
            <label className="mt-6 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={sendInviteEmails}
                onChange={(e) => setSendInviteEmails(e.target.checked)}
                className="mt-1 size-4 rounded border-slate-300 text-[#7c3aed] focus:ring-[#7c3aed]"
              />
              <span>
                <span className="block text-base font-semibold text-slate-900">Create invite links</span>
                <span className="mt-1 block text-sm text-slate-500">
                  Generate shareable signup links on the next screen (copy and send by email or Slack).
                </span>
              </span>
            </label>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <OnboardingTitle>You&apos;re all set!</OnboardingTitle>
          <OnboardingSubtitle>Your workspace is ready. Let&apos;s get you started.</OnboardingSubtitle>
          {inviteLinks.length > 0 ? (
            <div className="mt-8 max-w-2xl rounded-2xl border border-violet-200 bg-violet-50/60 p-5 text-left">
              <p className="text-sm font-semibold text-slate-900">Team invite links</p>
              <p className="mt-1 text-sm text-slate-600">
                Copy each link and send it to your teammate. Links expire in 14 days.
              </p>
              <ul className="mt-4 space-y-3">
                {inviteLinks.map((link) => (
                  <li
                    key={link.email}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-slate-900">
                      {link.name} <span className="font-normal text-slate-500">({link.email})</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(link.loginUrl)}
                      className="mt-2 break-all text-left text-xs font-semibold text-[#7c3aed] hover:underline"
                    >
                      {link.loginUrl}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <OnboardingWhatsNext
            items={[
              {
                icon: <FolderIcon />,
                title: "Explore your workspace",
                description: "Projects, production, and People — take a quick tour when you're ready.",
              },
              {
                icon: <UserPlusIcon />,
                title: "Invite more team members",
                description: "Add colleagues anytime from People.",
              },
              {
                icon: <RocketIcon />,
                title: "Create projects when you're ready",
                description: "Start a new project from Projects whenever you need to.",
              },
              {
                icon: <MailIcon />,
                title: "Connect Mailroom",
                description: "Link Gmail from the app when you want AI on email.",
              },
            ]}
          />
        </>
      ) : null}

      {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
    </OnboardingShell>
  );
}
