"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { OnboardingLanguagePill } from "@/components/onboarding/onboarding-ui";

export type OnboardingStepItem = {
  id: number;
  label: string;
  description: string;
};

/**
 * Wizard steps — same violet page + elevated white workspace card as welcome.
 */
export function OnboardingShell({
  steps,
  currentStep,
  children,
  footer,
  headerRight,
}: {
  steps: OnboardingStepItem[];
  currentStep: number;
  children: ReactNode;
  footer?: ReactNode;
  headerRight?: ReactNode;
}) {
  const topRight = (
    <div className="flex items-center gap-3">
      {headerRight}
      <OnboardingLanguagePill />
    </div>
  );

  return (
    <div className="relative flex min-h-svh flex-col bg-[#f3f0ff]">
      <div className="relative z-10 flex shrink-0 items-center justify-between px-5 py-5 sm:px-8 lg:hidden">
        <div className="flex items-center gap-2">
          <Image src="/onpro-logo.png" alt="" width={28} height={28} className="size-7 rounded-md" />
          <span className="text-lg font-bold text-slate-900">OnPro</span>
        </div>
        {topRight}
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pb-6 sm:px-8 sm:pb-10">
        <div className="mb-4 hidden items-center justify-end gap-3 lg:flex">
          {topRight}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-[1.35rem] bg-white shadow-[0_8px_40px_-12px_rgba(79,70,229,0.18),0_4px_24px_-8px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
          <aside className="hidden w-[17.5rem] shrink-0 flex-col border-r border-slate-100 bg-[#faf9ff] px-6 py-8 lg:flex">
            <div className="flex items-center gap-2">
              <Image src="/onpro-logo.png" alt="" width={28} height={28} className="size-7 rounded-md" />
              <span className="text-lg font-bold text-slate-900">OnPro</span>
            </div>
            <nav className="mt-12 space-y-1" aria-label="Onboarding progress">
              {steps.map((step) => {
                const done = currentStep > step.id;
                const active = currentStep === step.id;
                return (
                  <div key={step.id} className={`flex gap-3 rounded-xl px-1 py-2.5 ${active ? "" : ""}`}>
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        done || active
                          ? "bg-[#7c3aed] text-white"
                          : "bg-slate-100 text-slate-400"
                      }`}
                      aria-hidden
                    >
                      {done ? (
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12l5 5L19 7" />
                        </svg>
                      ) : (
                        step.id
                      )}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span
                        className={`block text-sm font-semibold ${active ? "text-[#7c3aed]" : "text-slate-800"}`}
                      >
                        {step.label}
                      </span>
                      <span className="block text-xs leading-snug text-slate-500">{step.description}</span>
                    </span>
                  </div>
                );
              })}
            </nav>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
              {children}
            </main>

            {footer ? (
              <footer className="shrink-0 border-t border-slate-100 bg-white px-6 py-5 sm:px-10 lg:px-12">
                {footer}
              </footer>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
