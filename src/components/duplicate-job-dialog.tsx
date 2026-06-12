"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  projectModalFieldClass,
  projectModalLabelClass,
  ProjectModalPanelFooter,
} from "@/components/project-modal-ui";
import { COMMON_COLORWAY_NAMES, resolveColorCode } from "@/lib/style-number";
import type { ProjectJob } from "@/lib/types/wip";

export type DuplicateJobFormValues = {
  name: string;
  colorway: string;
  style_number: string;
  color_code: string;
};

export function duplicateFormFromJob(job: ProjectJob): DuplicateJobFormValues {
  const baseName = job.name?.trim() ?? "";
  return {
    name: baseName ? `${baseName} (Copy)` : "",
    colorway: job.colorway ?? "",
    style_number: job.style_number ?? "",
    color_code: job.color_code ?? "",
  };
}

type Props = {
  open: boolean;
  source: ProjectJob;
  onClose: () => void;
  onConfirm: (values: DuplicateJobFormValues) => void;
};

export function DuplicateJobDialog({ open, source, onClose, onConfirm }: Props) {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState(() => duplicateFormFromJob(source));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(duplicateFormFromJob(source));
  }, [open, source]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const codePreview = resolveColorCode(form.colorway, form.color_code) || "—";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(560px,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/90"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            Duplicate job
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Copies Development, Costing, and labels. PO is cleared and timeline resets. Edit any
            field or leave as shown.
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
          <label className={projectModalLabelClass}>
            Job name
            <input
              className={projectModalFieldClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cami Tee (Copy)"
              autoFocus
            />
          </label>

          <label className={projectModalLabelClass}>
            Colorway
            <input
              className={projectModalFieldClass}
              list="duplicate-colorway-options"
              value={form.colorway}
              onChange={(e) => setForm((f) => ({ ...f, colorway: e.target.value }))}
              placeholder="Leave as-is or enter new colorway"
            />
            <datalist id="duplicate-colorway-options">
              {COMMON_COLORWAY_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label className={projectModalLabelClass}>
            Style #
            <input
              className={projectModalFieldClass}
              value={form.style_number}
              onChange={(e) => setForm((f) => ({ ...f, style_number: e.target.value.toUpperCase() }))}
              placeholder="Leave as-is or enter new style #"
            />
          </label>

          <label className={projectModalLabelClass}>
            Color code
            <input
              className={projectModalFieldClass}
              value={form.color_code}
              onChange={(e) => setForm((f) => ({ ...f, color_code: e.target.value.toUpperCase() }))}
              placeholder="Optional — auto from colorway if blank"
            />
            <p className="mt-1 text-[11px] font-normal normal-case tracking-normal text-slate-500">
              Preview: <span className="font-mono font-semibold text-slate-700">{codePreview}</span>
            </p>
          </label>
        </div>

        <ProjectModalPanelFooter
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel="Duplicate job"
          onPrimary={() => onConfirm(form)}
        />
      </div>
    </div>,
    document.body,
  );
}
