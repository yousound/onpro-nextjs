"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildJobShareUrl } from "@/lib/job-inspect";
import {
  jobShareMessageBody,
  messagesComposeHref,
  stashJobShareCompose,
} from "@/lib/job-share-compose";
import { jobShareEmailDraft } from "@/lib/job-share-targets";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

type Props = {
  project: Project;
  job: ProjectJob;
};

export function JobShareMenu({ project, job }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const context = pathname.startsWith("/production") ? "production" : "project";
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildJobShareUrl(window.location.origin, project.id, job.id, context);
  }, [project.id, job.id, context]);

  const emailDraft = useMemo(
    () => (shareUrl ? jobShareEmailDraft({ project, job, link: shareUrl }) : null),
    [project, job, shareUrl],
  );

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      /* ignore */
    }
  }

  const mailtoHref =
    emailDraft != null
      ? `mailto:${encodeURIComponent(emailDraft.to)}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`
      : null;

  return (
    <div ref={rootRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border-light bg-white px-3 py-1.5 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <ShareIcon className="size-4 text-accent" />
        Share
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1.5 min-w-[220px] overflow-hidden rounded-xl border border-border-light bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-text-primary hover:bg-slate-50"
            onClick={() => {
              if (!shareUrl) return;
              stashJobShareCompose({
                contactId: String(project.client.id),
                body: jobShareMessageBody({ project, job, link: shareUrl }),
              });
              setOpen(false);
              router.push(messagesComposeHref());
            }}
          >
            <MessagesIcon className="size-4 shrink-0 text-accent" />
            Share in Messages
          </button>
          {mailtoHref ? (
            <a
              role="menuitem"
              href={mailtoHref}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-text-primary hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <EmailIcon className="size-4 shrink-0 text-accent" />
              Email client
            </a>
          ) : (
            <p className="px-3 py-2 text-xs text-text-secondary" role="presentation">
              No client email on file — add one in People.
            </p>
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-border-light px-3 py-2.5 text-left text-sm font-medium text-text-primary hover:bg-slate-50"
            onClick={() => {
              void copyLink();
              setOpen(false);
            }}
          >
            <LinkIcon className="size-4 shrink-0 text-text-secondary" />
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" />
    </svg>
  );
}

function MessagesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
