"use client";

/** Bump when onboarding content changes so returning users see the new tour once. */
const STORAGE_KEY = "onpro-messages-attach-files-onboarding-v2";

export function hasSeenAttachmentsOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(STORAGE_KEY) === "1";
}

export function markAttachmentsOnboardingSeen(): void {
  sessionStorage.setItem(STORAGE_KEY, "1");
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MicIconSmall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

type Props = {
  open: boolean;
  onDismiss: () => void;
};

/** First-run education: attachment composer vs reading in thread (matches product onboarding mock). */
export function AttachmentsOnboardingModal({ open, onDismiss }: Props) {
  if (!open) return null;

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attach-onboarding-title"
    >
      <div className="relative flex max-h-[min(920px,94vh)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 lg:max-h-[88vh] lg:flex-row">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 z-10 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <span className="text-xl leading-none">×</span>
        </button>

        {/* Left — story */}
        <div className="flex flex-1 flex-col justify-center border-b border-slate-100 px-8 py-10 lg:max-w-[46%] lg:border-b-0 lg:border-r lg:py-12 lg:pl-10 lg:pr-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <PaperclipIcon className="h-6 w-6" />
          </div>
          <h2 id="attach-onboarding-title" className="text-3xl font-bold tracking-tight text-slate-900">
            Attach files.
          </h2>
          <p className="mt-2 text-xl font-semibold text-violet-600">Keep conversations in context.</p>
          <p className="mt-5 text-sm leading-relaxed text-slate-600">
            Share important docs, designs, and files right in the chat — so your team has everything they need, all in
            one place.
          </p>

          <ul className="mt-8 space-y-5">
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <PaperclipIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">Share with ease</p>
                <p className="mt-1 text-sm text-slate-600">
                  Attach files from your device and send instantly in the conversation.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <FolderIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">Keep things organized</p>
                <p className="mt-1 text-sm text-slate-600">
                  All attachments live in the right conversation, ready when you need them.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <UsersIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">Collaborate better</p>
                <p className="mt-1 text-sm text-slate-600">Everyone in the room can view and access shared files.</p>
              </div>
            </li>
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl bg-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Got it
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-sm font-semibold text-violet-600 hover:underline"
            >
              Learn more
            </button>
          </div>
        </div>

        {/* Right — chat preview */}
        <div className="relative flex flex-1 flex-col bg-slate-50/90 px-6 py-8 lg:py-10 lg:pl-8 lg:pr-10">
          <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] text-slate-400">Today, {todayLabel}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                    GG
                  </span>
                  <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-100">
                    Hey — can we confirm the strike-off timeline?
                  </div>
                </div>

                <div className="relative flex justify-end">
                  <div className="relative max-w-[88%] rounded-2xl rounded-tr-sm bg-violet-600 px-3 py-2 text-sm text-white shadow-sm">
                    Yes, targeting Friday for approvals on our side.
                  </div>
                  {/* Callout — Replying in context */}
                  <div className="pointer-events-none absolute -left-2 bottom-full mb-1 hidden sm:block">
                    <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50 px-2.5 py-1.5 text-[10px] font-medium leading-snug text-violet-900 shadow-sm">
                      Replying in context
                      <p className="mt-0.5 font-normal text-violet-800/90">Attachments stay with the conversation.</p>
                    </div>
                    <div className="ml-6 h-3 w-px border-l border-dashed border-violet-300" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-600">
                    GG
                  </span>
                  <div className="max-w-[88%] space-y-2">
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
                      {extIcon("pdf")}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">Strike-off schedule</p>
                        <p className="text-[10px] text-slate-500">2.4 MB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm">
                      {extIcon("doc")}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900">Color standards</p>
                        <p className="text-[10px] text-slate-500">180 KB</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex justify-end gap-2">
                  <div className="relative max-w-[min(100%,17rem)] rounded-2xl rounded-tr-sm border border-violet-200 bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-violet-100">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Invoice INV-2026-0142</p>
                      <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                        $3,000.00
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">Fillo Product Design</p>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Invoice</p>
                  </div>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[9px] font-bold text-violet-900">
                    ME
                  </span>
                  {/* Callout — All in one place */}
                  <div className="pointer-events-none absolute -right-1 bottom-full mb-1 hidden sm:block">
                    <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50 px-2.5 py-1.5 text-[10px] font-medium leading-snug text-violet-900 shadow-sm">
                      All in one place
                      <p className="mt-0.5 font-normal text-violet-800/90">View and reference without switching tabs.</p>
                    </div>
                    <div className="mr-8 ml-auto h-3 w-px border-r border-dashed border-violet-300" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                <MicIconSmall className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 truncate text-xs text-slate-400">Type your message here</span>
                <span className="flex shrink-0 gap-1 text-slate-400">
                  <span className="text-sm font-semibold text-violet-600">+</span>
                  <span className="text-xs">🖼</span>
                  <span className="text-xs">😊</span>
                  <span className="text-xs">📍</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function extIcon(ext: string) {
  const c =
    ext === "pdf"
      ? "bg-red-100 text-red-700"
      : ext === "doc"
        ? "bg-blue-100 text-blue-700"
        : "bg-emerald-100 text-emerald-800";
  return (
    <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase ${c}`}>{ext}</span>
  );
}
