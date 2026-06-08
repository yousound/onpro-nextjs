"use client";

import type { ReactNode } from "react";

type Props = {
  onStartConversation: () => void;
  onSeeSmartAttachments: () => void;
  onDismiss?: () => void;
};

export function MessagesConnectHero({ onStartConversation, onSeeSmartAttachments, onDismiss }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 py-10 text-center sm:px-10 sm:py-14">
        {onDismiss ? (
          <div className="mb-4 w-full max-w-5xl text-right">
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm font-semibold text-[#7c3aed] hover:underline"
            >
              View inbox →
            </button>
          </div>
        ) : null}
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Coordinate work <span className="text-[#7c3aed]">in real time</span>
        </h2>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-[17px]">
          Chat with clients, vendors, and your team in conversations tied to projects, jobs, files, and
          approvals.
        </p>

        <div className="mt-12 grid w-full grid-cols-1 gap-5 lg:grid-cols-3 lg:items-stretch lg:gap-6">
          <FeatureCard
            title="Open a thread"
            description="Start a conversation with a client, vendor, or your internal team."
          >
            <ThreadPreviewRow />
          </FeatureCard>

          <FeatureCard
            title="Send smart attachments"
            description="Attach quotes, jobs, invoices, POs, tasks, and approvals as editable cards — not screenshots."
          >
            <QuoteAttachmentPreview />
          </FeatureCard>

          <FeatureCard
            title="Promote to Mailroom"
            description="Escalate important conversations into AI-assisted workflows without losing the thread."
          >
            <PromotePreview />
          </FeatureCard>
        </div>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onStartConversation}
            className="inline-flex items-center gap-2.5 rounded-xl bg-[#7c3aed] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:bg-[#6d28d9]"
          >
            <ChatBubbleIcon className="size-4" />
            Start a conversation
          </button>
          <button
            type="button"
            onClick={onSeeSmartAttachments}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <PlayIcon />
            See smart attachments
          </button>
        </div>
      </div>
    </div>
  );
}

const PREVIEW_SLOT_CLASS = "flex h-[5.75rem] w-full flex-col justify-end";

function FeatureCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white px-5 pb-5 pt-5 text-left shadow-sm">
      <h3 className="text-base font-bold leading-snug text-slate-900">{title}</h3>
      <p className="mt-2 min-h-[4.5rem] text-sm leading-relaxed text-slate-500">{description}</p>
      <div className={`mt-auto pt-4 ${PREVIEW_SLOT_CLASS}`}>{children}</div>
    </div>
  );
}

/** Card 1 — overlapping avatars + skeleton message lines */
function ThreadPreviewRow() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center">
          <AvatarChip initials="SB" className="z-[3] bg-sky-100 text-sky-700 ring-2 ring-white" />
          <AvatarChip initials="FS" className="-ml-2.5 z-[2] bg-emerald-100 text-emerald-700 ring-2 ring-white" />
          <AvatarChip initials="AC" className="-ml-2.5 z-[1] bg-orange-100 text-orange-700 ring-2 ring-white" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-2.5 w-full max-w-[9.5rem] rounded-full bg-slate-200" />
          <div className="h-2.5 w-full max-w-[7.5rem] rounded-full bg-slate-200/95" />
          <div className="h-2.5 w-full max-w-[5.5rem] rounded-full bg-slate-200/90" />
        </div>
      </div>
    </div>
  );
}

/** Card 2 — quote smart-attachment card */
function QuoteAttachmentPreview() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 px-3 pb-4 pt-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[#7c3aed]">
          <QuoteDocIcon />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-slate-900">Quote #Q-1023</p>
              <p className="mt-0.5 text-xs text-slate-500">Sew Bright Apparel</p>
            </div>
            <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              Sent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Card 3 — summarize + mailroom triage stack */
function PromotePreview() {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-violet-100 px-3 py-2.5 text-center text-sm font-semibold text-[#7c3aed]">
        Summarize &amp; promote
      </div>
      <div className="flex min-h-[2.75rem] items-center gap-2 border-t border-slate-100 bg-white px-3 pb-3.5 pt-2.5">
        <SparkleMini className="size-4 shrink-0 text-[#7c3aed]" />
        <span className="text-left text-xs leading-snug text-slate-500">Send to Mailroom for AI triage</span>
      </div>
    </div>
  );
}

function AvatarChip({ initials, className }: { initials: string; className: string }) {
  return (
    <span
      className={`relative flex size-9 items-center justify-center rounded-full text-[11px] font-bold ${className}`}
    >
      {initials}
    </span>
  );
}

function QuoteDocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function SparkleMini({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-3.5"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.2 4.4L17.6 8l-4.4 1.2L12 14l-1.2-4.8L6.4 8l4.4-1.6L12 2z" />
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
