"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  mode: "mock" | "live";
  oauthConfigured: boolean;
  statusMessage?: string;
  onConnectMock: () => void;
  /** Gmail already connected — show inbox CTA instead of connect. */
  connected?: boolean;
  connectedEmail?: string | null;
  onOpenInbox?: () => void;
  /** OnPro account email (helps debug per-user Gmail connections). */
  signedInEmail?: string | null;
};

export function MailroomConnectHero({
  mode,
  oauthConfigured,
  statusMessage,
  onConnectMock,
  connected = false,
  connectedEmail,
  onOpenInbox,
  signedInEmail,
}: Props) {
  const isMock = mode === "mock";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-12 text-center sm:px-10 sm:py-16">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Turn your inbox into <span className="text-[#7c3aed]">operations</span>
        </h2>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-[17px]">
          Mailroom reads your Gmail inbox and turns important emails into projects, jobs, POs, and
          next steps — ready for your review.
        </p>

        <div className="mt-12 grid w-full max-w-3xl grid-cols-1 items-stretch gap-6 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:gap-4">
          <StepCard
            icon={<GmailStepIcon />}
            title="Emails come in"
            description="Vendor quotes, client approvals, shipping updates, and more."
          />
          <StepArrow />
          <StepCard
            icon={<SparklesStepIcon />}
            title="AI understands"
            description="Mailroom extracts the key details and matches the right context."
          />
          <StepArrow />
          <StepCard
            icon={<CheckStepIcon />}
            title="Drafts for your review"
            description="Projects, jobs, POs, and updates — ready for you to approve."
          />
        </div>

        {connected && connectedEmail ? (
          <p className="mt-8 text-sm text-slate-500">
            Connected as <span className="font-medium text-slate-700">{connectedEmail}</span>
          </p>
        ) : null}

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {connected && onOpenInbox ? (
            <button
              type="button"
              onClick={onOpenInbox}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#7c3aed] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:bg-[#6d28d9]"
            >
              Open inbox
            </button>
          ) : isMock ? (
            <button
              type="button"
              onClick={onConnectMock}
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#7c3aed] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:bg-[#6d28d9]"
            >
              <GmailButtonIcon />
              Connect Gmail
            </button>
          ) : (
            <a
              href="/api/mailroom/gmail/connect"
              className="inline-flex items-center gap-2.5 rounded-xl bg-[#7c3aed] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:bg-[#6d28d9]"
            >
              <GmailButtonIcon />
              Connect Gmail
            </a>
          )}

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => {
              document.getElementById("mailroom-how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <PlayIcon />
            See how Mailroom works
          </button>
        </div>

        {!isMock && !connected && !oauthConfigured ? (
          <p className="mt-4 max-w-md text-sm font-medium text-amber-800">
            {statusMessage ??
              "Gmail OAuth is not configured on the server. Ask your admin to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."}
          </p>
        ) : null}

        {!isMock && !signedInEmail ? (
          <p className="mt-4 max-w-md text-sm text-slate-600">
            <Link href="/login?next=/mailroom" className="font-semibold text-[#7c3aed] hover:underline">
              Sign in
            </Link>{" "}
            to connect Gmail.
          </p>
        ) : null}

        {!isMock && !connected && statusMessage && oauthConfigured ? (
          <p className="mt-3 max-w-md text-sm text-slate-500">{statusMessage}</p>
        ) : null}

        <p
          id="mailroom-how-it-works"
          className="mt-10 flex max-w-lg items-start justify-center gap-2 text-left text-sm leading-relaxed text-slate-400 sm:text-center"
        >
          <LockIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            We only read your emails to draft and organize information. Nothing is sent or applied
            automatically. You approve everything first.
          </span>
        </p>
      </div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white px-5 pb-6 pt-6 text-left shadow-sm">
      <div className="flex size-14 items-center justify-center rounded-xl border border-slate-100 bg-slate-50/80">
        {icon}
      </div>
      <h3 className="mt-5 text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

function StepArrow() {
  return (
    <div className="hidden items-center justify-center text-slate-300 sm:flex" aria-hidden>
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M13 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function GmailStepIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-9" aria-hidden>
      <path fill="#4285F4" d="M22 6v12H2V6l10 7 10-7z" />
      <path fill="#EA4335" d="M22 6 12 13 2 6h20z" />
      <path fill="#FBBC05" d="M2 6v1.5l10 7.5 10-7.5V6H2z" opacity="0.9" />
      <path fill="#34A853" d="M2 18V7.5l10 7.5L22 7.5V18H2z" opacity="0" />
    </svg>
  );
}

function GmailButtonIcon() {
  return (
    <span className="flex size-6 items-center justify-center rounded-md bg-white/20 text-xs font-bold">
      M
    </span>
  );
}

function SparklesStepIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8 text-[#7c3aed]" fill="currentColor" aria-hidden>
      <path d="M12 2l1.2 4.4L17.6 8l-4.4 1.2L12 14l-1.2-4.8L6.4 8l4.4-1.6L12 2zm0 10l.9 3.3L16.2 16l-3.3.9L12 20l-.9-3.1L7.8 16l3.3-.7L12 12z" />
    </svg>
  );
}

function CheckStepIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8 text-[#7c3aed]" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-slate-500" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}
