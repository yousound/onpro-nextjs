"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const projectModalFieldClass =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15";

export const projectModalTextareaClass = `${projectModalFieldClass} min-h-[5.5rem] py-2.5`;

export const projectModalLabelClass =
  "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function ProjectModalOverlay({
  titleId,
  onClose,
  aside,
  children,
  overlayClassName = "z-[150]",
  size = "default",
}: {
  titleId: string;
  onClose: () => void;
  aside: ReactNode;
  children: ReactNode;
  overlayClassName?: string;
  size?: "default" | "wide" | "wide-tall";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const maxHeightClass =
    size === "wide-tall" ? "max-h-[92vh]" : "max-h-[min(640px,92vh)]";
  const widthClass = size === "default" ? "max-w-4xl" : "max-w-5xl";

  const overlay = (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px] ${overlayClassName}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex ${maxHeightClass} w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/90 ${widthClass}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
          {aside}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}

export function ProjectModalAside({
  badge,
  title,
  body,
  nav,
}: {
  badge: ReactNode;
  title: ReactNode;
  body: string;
  /** Section list (e.g. job details) — scrolls below intro copy. */
  nav?: ReactNode;
}) {
  return (
    <aside className="hidden min-h-0 shrink-0 flex-col bg-gradient-to-br from-[#f5f3ff] to-violet-100 px-8 py-10 sm:flex sm:w-[34%]">
      <div className="shrink-0">
        {badge}
        <h2 className="mt-8 text-2xl font-bold leading-tight text-[#5b21b6]">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-violet-900/70">{body}</p>
      </div>
      {nav ? (
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto py-1">{nav}</div>
      ) : (
        <div className="flex-1" />
      )}
    </aside>
  );
}

export function ProjectModalPanelHeader({
  title,
  subtitle,
  onClose,
  onBack,
  editableTitle,
  titleId = "project-modal-title",
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onBack?: () => void;
  /** Editable style name in the modal header (e.g. job details). */
  editableTitle?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  titleId?: string;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="min-w-0 flex-1 pr-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-sm font-semibold text-[#7c3aed] hover:underline"
          >
            ← Back to project
          </button>
        ) : null}
        {editableTitle ? (
          <input
            id={titleId}
            type="text"
            value={editableTitle.value}
            onChange={(e) => editableTitle.onChange(e.target.value)}
            placeholder={editableTitle.placeholder ?? "Style name"}
            className="w-full rounded-lg border border-transparent bg-transparent px-0 text-xl font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:px-2 focus:ring-2 focus:ring-violet-500/20"
          />
        ) : (
          <h2 id={titleId} className="text-xl font-bold text-slate-900">
            {title}
          </h2>
        )}
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

export function ProjectModalPanelFooter({
  secondaryLabel,
  onSecondary,
  primaryLabel,
  primaryIcon,
  primaryDisabled,
  deleteLabel,
  onDelete,
  deleteDisabled,
}: {
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel: string;
  primaryIcon?: ReactNode;
  primaryDisabled?: boolean;
  deleteLabel?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-3 border-t border-slate-100 px-5 py-4 sm:px-6 ${
        deleteLabel && onDelete ? "justify-between" : "justify-end"
      }`}
    >
      {deleteLabel && onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteDisabled}
          className="rounded-xl px-2 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deleteLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSecondary}
          disabled={deleteDisabled}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          {secondaryLabel}
        </button>
        <button
          type="submit"
          disabled={primaryDisabled}
          className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/25 hover:bg-[#6d28d9] disabled:opacity-50"
        >
          {primaryLabel}
          {primaryIcon}
        </button>
      </div>
    </div>
  );
}

export function ProjectModalField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className={projectModalLabelClass}>
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

export function ProjectModalBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#7c3aed] text-white shadow-md">
      {children}
    </span>
  );
}

export function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <path d="M3 7h5l2 2h11v10H3V7z" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3 3-5 7-5s7 2 7 5" />
    </svg>
  );
}

export function StatusDot() {
  return <span className="size-2.5 rounded-full bg-amber-400" aria-hidden />;
}

export function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

export function HashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <path d="M10 3v18M14 3v18M4 8h16M4 16h16" />
    </svg>
  );
}

export function NotesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <path d="M6 4h12v16H6z" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
}

export function RocketMini() {
  return <span aria-hidden>🚀</span>;
}

export function CheckMini() {
  return <span aria-hidden>✓</span>;
}
