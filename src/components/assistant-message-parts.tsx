"use client";

import Link from "next/link";
import { mailroomThreadHref } from "@/lib/assistant-mailroom-links";
import type { BriefingLinkAction, BriefingPart } from "@/lib/mock/overview-briefing";

const linkClass =
  "font-semibold text-[#7c3aed] underline decoration-violet-400/70 underline-offset-2 hover:text-[#6d28d9]";

type Props = {
  parts: BriefingPart[];
  onOpenJob?: (projectId: number, jobId: string) => void;
  onCreateProject?: () => void;
};

export function AssistantMessageParts({ parts, onOpenJob, onCreateProject }: Props) {
  return (
    <span className="leading-relaxed">
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={`t-${i}`}>{part.value}</span>
        ) : (
          <AssistantLink
            key={`l-${i}`}
            action={part.action}
            onOpenJob={onOpenJob}
            onCreateProject={onCreateProject}
          />
        ),
      )}
    </span>
  );
}

function AssistantLink({
  action,
  onOpenJob,
  onCreateProject,
}: {
  action: BriefingLinkAction;
  onOpenJob?: (projectId: number, jobId: string) => void;
  onCreateProject?: () => void;
}) {
  if (action.kind === "job" && onOpenJob) {
    return (
      <button type="button" className={linkClass} onClick={() => onOpenJob(action.projectId, action.jobId)}>
        {action.label}
      </button>
    );
  }

  if (action.kind === "projects" && onCreateProject && /create/i.test(action.label)) {
    return (
      <button type="button" className={linkClass} onClick={onCreateProject}>
        {action.label}
      </button>
    );
  }

  if (action.kind === "project") {
    return (
      <Link href={`/projects/${action.projectId}`} className={linkClass}>
        {action.label}
      </Link>
    );
  }

  if (action.kind === "mailroom") {
    return (
      <Link href={mailroomThreadHref(action.threadId)} className={linkClass}>
        {action.label}
      </Link>
    );
  }

  if (action.kind === "messages") {
    return (
      <Link href={action.href ?? "/messages"} className={linkClass}>
        {action.label}
      </Link>
    );
  }

  if (action.kind === "calendar") {
    return (
      <Link href="/calendar" className={linkClass}>
        {action.label}
      </Link>
    );
  }

  if (action.kind === "people") {
    return (
      <Link href="/people" className={linkClass}>
        {action.label}
      </Link>
    );
  }

  if (action.kind === "production") {
    return (
      <Link href="/production" className={linkClass}>
        {action.label}
      </Link>
    );
  }

  if (action.kind === "projects") {
    return (
      <Link href="/projects" className={linkClass}>
        {action.label}
      </Link>
    );
  }

  return (
    <Link href="/documents" className={linkClass}>
      {action.label}
    </Link>
  );
}
