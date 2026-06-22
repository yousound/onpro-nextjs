"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { JobScopeKind, JobType, ProjectJob } from "@/lib/types/wip";
import { VendorFieldSelect } from "@/components/vendor-select";
import {
  CalendarIcon,
  FolderIcon,
  HashIcon,
  NotesIcon,
  ProjectModalAside,
  ProjectModalBadge,
  ProjectModalField,
  ProjectModalOverlay,
  ProjectModalPanelFooter,
  ProjectModalPanelHeader,
  RocketMini,
  StatusDot,
  projectModalFieldClass,
  projectModalLabelClass,
  projectModalTextareaClass,
} from "@/components/project-modal-ui";
import { normalizeJob } from "@/lib/job-defaults";
import { dateInputToIso, isoToDateInput } from "@/lib/format";
import {
  CATEGORY_CODES,
  JOB_TYPE_OPTIONS,
  dropdownLabelForCategoryCode,
} from "@/lib/reference/category-codes";
function resolveCategoryDropdown(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return CATEGORY_CODES[0]?.dropdownLabel ?? "Tee";
  const byLabel = CATEGORY_CODES.find(
    (c) => c.dropdownLabel.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byLabel) return byLabel.dropdownLabel;
  const byCode = CATEGORY_CODES.find((c) => c.code.toLowerCase() === trimmed.toLowerCase());
  if (byCode) return byCode.dropdownLabel;
  const byFullLabel = CATEGORY_CODES.find((c) => c.label.toLowerCase() === trimmed.toLowerCase());
  if (byFullLabel) return byFullLabel.dropdownLabel;
  return dropdownLabelForCategoryCode(trimmed) !== "Custom" ? dropdownLabelForCategoryCode(trimmed) : trimmed;
}

function jobTypeLabel(jobType: JobType | undefined): string {
  const hit = JOB_TYPE_OPTIONS.find((o) => o.value === jobType);
  return hit?.label ?? "Print Production";
}

function JobBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M10 2h4a2 2 0 0 1 2 2v2h4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6h4V4a2 2 0 0 1 2-2zm2 4V4h-4v2h4z" />
    </svg>
  );
}

type Props = {
  projects: Project[];
  project: Project;
  onProjectChange: (projectId: number) => void;
  job: ProjectJob;
  allJobs: ProjectJob[];
  clientCode: string;
  vendors: Contact[];
  overlayClassName?: string;
  onClose: () => void;
  onSave: (job: ProjectJob) => void;
};

export function NewJobModal({
  projects,
  project,
  onProjectChange,
  job,
  allJobs,
  clientCode,
  vendors,
  overlayClassName,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(() => normalizeJob(job));
  const [categoryDropdown, setCategoryDropdown] = useState(() => resolveCategoryDropdown(job.category));

  useEffect(() => {
    setDraft(normalizeJob(job));
    setCategoryDropdown(resolveCategoryDropdown(job.category));
  }, [job.id, project.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function patch(partial: Partial<ProjectJob>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function handleCategoryChange(label: string) {
    setCategoryDropdown(label);
    patch({ category: label });
  }

  function handleJobTypeChange(jobType: JobType) {
    patch({
      job_type: jobType,
      type: jobTypeLabel(jobType).toUpperCase(),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const saved: ProjectJob = {
      ...draft,
      name: draft.name.trim() || "Untitled job",
      category: categoryDropdown,
      po_number: draft.po_number?.trim() || null,
      scope_note: draft.scope_note?.trim() || undefined,
      updated_at: new Date().toISOString(),
    };
    onSave(normalizeJob(saved, project));
  }

  const canCreate = Boolean(draft.name.trim());
  const subtitleParts = [
    project.name,
    draft.job_number ? `Job ${draft.job_number}` : null,
  ].filter(Boolean);

  return (
    <ProjectModalOverlay
      titleId="new-job-title"
      onClose={onClose}
      overlayClassName={overlayClassName}
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <JobBadgeIcon />
            </ProjectModalBadge>
          }
          title={
            <>
              Add a job to
              <br />
              the run.
            </>
          }
          body="Set up the production job — style, type, and vendor. You can fill in costing, timeline, and labels after it’s created."
        />
      }
    >
      <ProjectModalPanelHeader
        title="New job"
        subtitle={subtitleParts.join(" · ")}
        onClose={onClose}
      />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <ProjectModalField label="Project" icon={<FolderIcon />}>
            <select
              className={projectModalFieldClass}
              value={project.id}
              onChange={(e) => onProjectChange(Number(e.target.value))}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.client.name ? ` · ${p.client.name}` : ""}
                </option>
              ))}
            </select>
          </ProjectModalField>

          <ProjectModalField label="Job name" icon={<FolderIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Summer tee run"
              required
              autoComplete="off"
              autoFocus
            />
          </ProjectModalField>

          <ProjectModalField label="Subtitle (optional)" icon={<NotesIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.subtitle}
              onChange={(e) => patch({ subtitle: e.target.value })}
              placeholder="Short label for the team"
              autoComplete="off"
            />
          </ProjectModalField>

          <div className="grid gap-4 sm:grid-cols-2">
            <ProjectModalField label="Job type" icon={<StatusDot />}>
              <select
                className={projectModalFieldClass}
                value={draft.job_type ?? "print_production"}
                onChange={(e) => handleJobTypeChange(e.target.value as JobType)}
              >
                {JOB_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </ProjectModalField>

            <ProjectModalField label="Category" icon={<StatusDot />}>
              <select
                className={projectModalFieldClass}
                value={categoryDropdown}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                {CATEGORY_CODES.map((c) => (
                  <option key={c.code} value={c.dropdownLabel}>
                    {c.dropdownLabel}
                  </option>
                ))}
              </select>
            </ProjectModalField>
          </div>

          <ProjectModalField label="Scope" icon={<StatusDot />}>
            <select
              className={projectModalFieldClass}
              value={draft.scope_kind ?? "original"}
              onChange={(e) => patch({ scope_kind: e.target.value as JobScopeKind })}
            >
              <option value="original">Original deliverable</option>
              <option value="addon">Reorder</option>
            </select>
          </ProjectModalField>

          <ProjectModalField label="Style #" icon={<HashIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.style_number}
              placeholder="e.g. GGT01"
              onChange={(e) => patch({ style_number: e.target.value.toUpperCase() })}
              autoComplete="off"
            />
          </ProjectModalField>

          <ProjectModalField label="Due date (optional)" icon={<CalendarIcon />}>
            <input
              type="date"
              className={projectModalFieldClass}
              value={isoToDateInput(draft.due_date)}
              onChange={(e) => patch({ due_date: dateInputToIso(e.target.value) })}
            />
          </ProjectModalField>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <VendorFieldSelect
              label="Lead vendor (optional)"
              vendors={vendors}
              value={draft.lead_vendor}
              onChange={(name) => patch({ lead_vendor: name ?? "" })}
              labelClassName={projectModalLabelClass}
            />
          </div>

          {draft.scope_kind === "addon" ? (
            <ProjectModalField label="Reorder note (optional)" icon={<NotesIcon />}>
              <textarea
                className={projectModalTextareaClass}
                rows={2}
                value={draft.scope_note ?? ""}
                onChange={(e) => patch({ scope_note: e.target.value })}
                placeholder="What changed vs the original deliverable?"
              />
            </ProjectModalField>
          ) : null}

          <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
            <span className="mr-1 inline-block text-slate-400">ⓘ</span>
            Vendor POs are assigned when you send quote requests. Timeline steps are seeded from the job type you pick.
          </p>
        </div>

        <ProjectModalPanelFooter
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel="Create job"
          primaryIcon={<RocketMini />}
          primaryDisabled={!canCreate}
        />
      </form>
    </ProjectModalOverlay>
  );
}
