"use client";

import Link from "next/link";
import {
  FactoryIcon,
  OnProLogoMark,
  UsersIcon,
} from "@/components/onboarding/onboarding-ui";

type Props = {
  loginHref?: string;
};

export function SignupIntentLanding({ loginHref = "/login" }: Props) {
  return (
    <div className="relative flex min-h-svh flex-col bg-[#f3f0ff] px-4 py-6 sm:px-8 sm:py-10">
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-8">
        <div className="overflow-hidden rounded-[1.35rem] bg-white p-8 shadow-xl ring-1 ring-slate-200/80 sm:p-10">
          <OnProLogoMark />
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-slate-900">How will you use OnPro?</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Choose the path that matches your role. You can always ask your production partner for an invite link.
          </p>

          <div className="mt-8 space-y-3">
            <Link
              href="/login?signup=1&kind=client"
              className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-violet-300 hover:bg-violet-50/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <UsersIcon />
              </span>
              <span>
                <span className="block text-base font-semibold text-slate-900">I work with a production team</span>
                <span className="mt-1 block text-sm text-slate-500">
                  Join your brand or client workspace — collaborate on projects and messages.
                </span>
              </span>
            </Link>

            <Link
              href="/login?signup=1&kind=operator"
              className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-violet-300 hover:bg-violet-50/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <FactoryIcon />
              </span>
              <span>
                <span className="block text-base font-semibold text-slate-900">I run production / my workspace</span>
                <span className="mt-1 block text-sm text-slate-500">
                  Set up your operator workspace — projects, jobs, contacts, and Mailroom.
                </span>
              </span>
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href={loginHref} className="font-semibold text-[#7c3aed] hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
