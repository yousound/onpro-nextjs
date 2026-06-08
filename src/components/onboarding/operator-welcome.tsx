"use client";

import Link from "next/link";
import {
  FactoryIcon,
  FeatureRow,
  FolderIcon,
  LockIcon,
  OnboardingHeroGraphic,
  OnboardingLanguagePill,
  OnProLogoMark,
  UsersIcon,
} from "@/components/onboarding/onboarding-ui";

type Props = {
  /** Signed-in: start wizard. Ignored when `onSetupHref` is set. */
  onSetup?: () => void;
  onImport?: () => void;
  /** Signed-out landing: header Log in + Set up → signup. */
  showAuthLinks?: boolean;
  onSetupHref?: string;
  loginHref?: string;
};

/**
 * Welcome landing — light violet page, large white card on top (per onboarding mock).
 */
export function OperatorWelcome({
  onSetup,
  onImport,
  showAuthLinks = false,
  onSetupHref,
  loginHref = "/login",
}: Props) {
  return (
    <div className="relative flex min-h-svh flex-col bg-[#f3f0ff] px-4 py-6 sm:px-8 sm:py-10">
      <div className="relative z-10 flex items-center justify-end gap-3">
        <OnboardingLanguagePill />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1080px] flex-1 flex-col justify-center py-4">
        <div className="overflow-hidden rounded-[1.35rem] bg-white shadow-[0_8px_40px_-12px_rgba(79,70,229,0.18),0_4px_24px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
          <div className="flex min-h-[min(640px,85vh)] flex-col lg:flex-row">
            {/* Left — lavender panel inside the card */}
            <div className="flex flex-1 flex-col bg-[#f5f3ff] px-8 py-10 sm:px-10 lg:min-w-[42%] lg:px-12 lg:py-12">
              <OnProLogoMark />
              <div className="flex flex-1 flex-col items-center justify-center py-8">
                <OnboardingHeroGraphic />
                <p className="mt-10 max-w-[16rem] text-center text-base font-medium leading-relaxed text-slate-600">
                  All your operations.
                  <br />
                  One intelligent workspace.
                </p>
              </div>
              <div className="flex justify-center gap-2 pb-2" aria-hidden>
                <span className="size-2 rounded-full bg-[#7c3aed]" />
                <span className="size-2 rounded-full bg-violet-200" />
                <span className="size-2 rounded-full bg-violet-200" />
                <span className="size-2 rounded-full bg-violet-200" />
              </div>
            </div>

            {/* Right — content */}
            <div className="flex flex-1 flex-col justify-center px-8 py-10 sm:px-10 lg:px-12 lg:py-14">
              <h1 className="text-[2rem] font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-[2.5rem]">
                Welcome to OnPro
              </h1>
              <p className="mt-4 text-base leading-relaxed text-slate-500 sm:text-[1.05rem]">
                Your operations command center for custom production, fulfillment, and client work.
              </p>

              <ul className="mt-10 space-y-6">
                <FeatureRow
                  icon={<FolderIcon />}
                  title="Manage projects"
                  description="Track every project from quote to delivery."
                />
                <FeatureRow
                  icon={<FactoryIcon />}
                  title="Run production"
                  description="Organize jobs, milestones, and timelines."
                />
                <FeatureRow
                  icon={<UsersIcon />}
                  title="Work with your team"
                  description="Collaborate with clients, vendors, and teammates."
                />
              </ul>

              <div className="mt-10">
                {onSetupHref ? (
                  <Link
                    href={onSetupHref}
                    className="flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-[#7c3aed] text-base font-semibold text-white shadow-md shadow-violet-500/30 transition hover:bg-[#6d28d9]"
                  >
                    Sign up
                    <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={onSetup}
                    className="flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-[#7c3aed] text-base font-semibold text-white shadow-md shadow-violet-500/30 transition hover:bg-[#6d28d9]"
                  >
                    Set up my workspace
                    <span aria-hidden>→</span>
                  </button>
                )}

                {showAuthLinks ? (
                  <p className="mt-6 text-center text-sm text-slate-500">
                    Already have an account?{" "}
                    <Link href={loginHref} className="font-semibold text-[#7c3aed] hover:underline">
                      Log in
                    </Link>
                  </p>
                ) : (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-3 text-slate-400">or</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onImport ?? onSetup}
                      className="flex h-[3.25rem] w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      Import existing data
                    </button>
                  </>
                )}
              </div>

              <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
                <LockIcon />
                Your data is secure and private. We&apos;ll never share it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
