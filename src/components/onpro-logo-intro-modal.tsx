"use client";

import Image from "next/image";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onDismiss: () => void;
};

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
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

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Matches app sidebar order & labels (scaled-down UI mock). */
function PreviewRailIcon({ kind }: { kind: string }) {
  const cls = "h-3 w-3 shrink-0";
  switch (kind) {
    case "messages":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "projects":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "jobs":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case "calendar":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "documents":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
          <path d="M14 2v6h6" />
        </svg>
      );
    case "team":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "reports":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
  }
}

function SketchArrow({
  className,
  pathD,
  flip,
}: {
  className?: string;
  pathD: string;
  flip?: boolean;
}) {
  return (
    <svg
      className={`pointer-events-none text-slate-500 ${className ?? ""}`}
      viewBox="0 0 48 40"
      fill="none"
      aria-hidden
    >
      <g transform={flip ? "scale(-1,1) translate(-48,0)" : undefined}>
        <path d={pathD} stroke="currentColor" strokeWidth="1.25" strokeDasharray="3 3" strokeLinecap="round" />
        <path d="M42 8l4 4-4 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function MiniAppPreview() {
  const rail = [
    { k: "messages", label: "Messages", active: true },
    { k: "projects", label: "Projects", active: false },
    { k: "jobs", label: "Jobs", active: false },
    { k: "calendar", label: "Calendar", active: false },
    { k: "documents", label: "Documents", active: false },
    { k: "team", label: "People", active: false },
    { k: "reports", label: "Reports", active: false },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl px-2">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-emerald-300/35 via-cyan-300/25 to-violet-400/35 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_80px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-100">
        <div className="flex min-h-[260px] text-[10px] leading-tight text-slate-700">
          {/* Mini sidebar */}
          <div className="flex w-[52px] shrink-0 flex-col border-r border-slate-100 bg-slate-50 py-1.5">
            <div className="mb-1 flex justify-center px-1">
              <span className="flex size-6 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-slate-200">
                <Image src="/onpro-logo.png" alt="" width={18} height={18} className="size-[18px] rounded-sm object-cover" />
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-0.5 px-1">
              {rail.map((item) => (
                <div
                  key={item.label}
                  title={item.label}
                  className={`flex items-center justify-center rounded-md py-1 ${
                    item.active ? "bg-violet-100 text-violet-700 ring-1 ring-violet-100" : "text-slate-500"
                  }`}
                >
                  <PreviewRailIcon kind={item.k} />
                </div>
              ))}
            </div>
            <div className="mt-auto border-t border-slate-100 px-1 pt-1">
              <div className="flex items-center justify-center rounded-md py-1 text-slate-500">
                <PreviewRailIcon kind="settings" />
              </div>
            </div>
          </div>

          {/* Inbox */}
          <div className="flex w-[118px] shrink-0 flex-col border-r border-slate-100 bg-white">
            <div className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-900">Messages</div>
            <div className="px-1.5 py-1.5">
              <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[8px] text-slate-400">
                <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <span className="truncate">People, chat…</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5 px-1 pb-2">
              <div className="rounded-md bg-violet-50 px-1.5 py-1 ring-1 ring-violet-100">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-medium text-slate-900">Glo Gang</span>
                  <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-violet-600 px-1 text-[7px] font-bold text-white">
                    2
                  </span>
                </div>
              </div>
              <div className="rounded-md px-1.5 py-1 text-slate-500">
                <span className="truncate font-medium text-slate-700">Fillo Mills</span>
              </div>
              <div className="rounded-md px-1.5 py-1 text-slate-500">
                <span className="truncate font-medium text-slate-700">QC Team</span>
              </div>
            </div>
          </div>

          {/* Thread */}
          <div className="relative min-w-0 flex-1 bg-slate-50/90">
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-white px-2 py-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[8px] font-bold text-slate-700">
                GG
              </span>
              <div>
                <div className="font-semibold text-slate-900">Glo Gang</div>
                <div className="text-[8px] font-medium text-emerald-600">online</div>
              </div>
            </div>

            <div className="relative space-y-2 overflow-hidden px-2 pb-10 pt-2">
              <div className="flex gap-1">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[7px] font-bold text-slate-600">
                  GG
                </span>
                <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-white px-2 py-1.5 text-[9px] shadow-sm ring-1 ring-slate-100">
                  Strike-off timeline — can we lock Friday?
                </div>
              </div>

              {/* Callout 1 */}
              <div className="pointer-events-none absolute left-[18%] top-[6%] z-10 max-w-[140px] sm:left-[12%]">
                <p className="font-[family-name:ui-serif,Georgia,Cambria,serif] text-[9px] italic leading-snug text-slate-700">
                  One place for every project conversation
                </p>
                <SketchArrow className="mt-0.5 h-8 w-14 text-slate-400" pathD="M4 28 Q 18 8 38 12" />
              </div>

              <div className="flex justify-end gap-1">
                <div className="max-w-[92%] rounded-xl rounded-tr-sm bg-violet-600 px-2 py-1.5 text-[9px] text-white shadow-sm">
                  Yes — approvals on our side by EOD.
                </div>
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[7px] font-bold text-violet-900">
                  ME
                </span>
              </div>

              <div className="flex gap-1">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[7px] font-bold text-slate-600">
                  GG
                </span>
                <div className="max-w-[92%] space-y-1">
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
                    <span className="rounded bg-red-100 px-1 py-0.5 text-[7px] font-bold uppercase text-red-700">pdf</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">Strike-off schedule</p>
                      <p className="text-[8px] text-slate-500">2.4 MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-sm">
                    <span className="rounded bg-blue-100 px-1 py-0.5 text-[7px] font-bold uppercase text-blue-700">doc</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">Color standards</p>
                      <p className="text-[8px] text-slate-500">180 KB</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Callout 2 */}
              <div className="pointer-events-none absolute bottom-[38%] left-0 z-10 max-w-[150px] sm:left-1">
                <SketchArrow className="mb-0.5 ml-4 h-7 w-16 rotate-12 text-slate-400" pathD="M8 4 Q 28 20 40 32" />
                <p className="font-[family-name:ui-serif,Georgia,Cambria,serif] text-[9px] italic leading-snug text-slate-700">
                  Attach files and keep everything in context
                </p>
              </div>

              <div className="flex justify-end gap-1">
                <div className="relative max-w-[min(100%,11rem)] rounded-xl rounded-tr-sm border border-violet-200 bg-white px-2 py-1.5 text-left shadow-sm ring-1 ring-violet-100">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-[9px] font-semibold text-slate-900">Invoice INV-2026-0142</p>
                    <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[7px] font-bold text-violet-800">
                      $3,000.00
                    </span>
                  </div>
                  <p className="mt-0.5 text-[8px] text-slate-600">Fillo Product Design</p>
                  <p className="mt-1 text-[7px] font-semibold uppercase tracking-wide text-slate-400">Invoice</p>
                </div>
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[7px] font-bold text-violet-900">
                  ME
                </span>
              </div>

              {/* Callout 3 */}
              <div className="pointer-events-none absolute bottom-[26%] right-0 z-10 max-w-[140px] text-right sm:right-1">
                <p className="ml-auto font-[family-name:ui-serif,Georgia,Cambria,serif] text-[9px] italic leading-snug text-slate-700">
                  Quickly reference important info
                </p>
                <SketchArrow className="ml-auto mt-0.5 h-8 w-14 text-slate-400" flip pathD="M6 30 Q 22 10 40 8" />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-2 py-1.5">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1">
                <PaperclipIcon className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="flex-1 truncate text-[8px] text-slate-400">Type your message here</span>
                <span className="text-[10px] text-slate-400">😊</span>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white shadow-sm">
                  +
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OnProLogoIntroModal({ open, onDismiss }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const bullets = [
    {
      icon: <ChatBubbleIcon className="h-4 w-4 text-violet-700" />,
      bg: "bg-violet-100",
      title: "Chat in context",
      desc: "Keep all project conversations in one thread so nothing gets lost.",
    },
    {
      icon: <PaperclipIcon className="h-4 w-4 text-emerald-700" />,
      bg: "bg-emerald-100",
      title: "Share files easily",
      desc: "Attach docs, designs, and files right in the chat.",
    },
    {
      icon: <FolderIcon className="h-4 w-4 text-amber-800" />,
      bg: "bg-amber-100",
      title: "Stay organized",
      desc: "Everything is organized by project and easy to find.",
    },
    {
      icon: <UsersIcon className="h-4 w-4 text-sky-700" />,
      bg: "bg-sky-100",
      title: "Work together",
      desc: "Invite your team and collaborate in real time.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onpro-intro-title"
    >
      <button type="button" className="absolute inset-0 z-0 cursor-default" aria-label="Dismiss dialog" onClick={onDismiss} />

      <div className="relative z-10 flex max-h-[min(880px,92vh)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 lg:max-h-[90vh] lg:flex-row">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 z-20 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <span className="text-xl leading-none">×</span>
        </button>

        <div className="flex flex-1 flex-col justify-center overflow-y-auto border-b border-slate-100 px-7 py-10 lg:max-w-[46%] lg:border-b-0 lg:border-r lg:py-12 lg:pl-10 lg:pr-8">
          <div className="mb-5 flex items-center gap-3">
            <Image
              src="/onpro-logo.png"
              alt="OnPro"
              width={44}
              height={44}
              className="size-11 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-slate-200"
            />
            <span className="text-lg font-semibold text-slate-900">OnPro</span>
          </div>

          <h2 id="onpro-intro-title" className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            OnPro helps you get work done.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-[15px]">
            All your projects, conversations, files, and team—together in one place.
          </p>

          <ul className="mt-8 space-y-5">
            {bullets.map((b) => (
              <li key={b.title} className="flex gap-3">
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${b.bg}`}>
                  {b.icon}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{b.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-xl bg-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700"
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

        <div className="relative flex flex-1 flex-col justify-center overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-6 py-8 lg:px-10 lg:py-10">
          <MiniAppPreview />
          <div className="mx-auto mt-8 flex max-w-xl items-center justify-center gap-2 text-center text-xs text-slate-500">
            <LockIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>Your data is secure and always in your control.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
