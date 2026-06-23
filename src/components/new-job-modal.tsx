"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { JobScopeKind, JobType, ProjectJob } from "@/lib/types/wip";
import { JobOverviewFields } from "@/components/job-overview-fields";
import { JobColorwayEditor } from "@/components/job-colorway-editor";
import {
  CalendarIcon,
  FolderIcon,
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
  projectModalTextareaClass,
} from "@/components/project-modal-ui";
import { normalizeJob } from "@/lib/job-defaults";
import { dateInputToIso, isoToDateInput } from "@/lib/format";
import {
  CATEGORY_CODES,
  JOB_TYPE_OPTIONS,
  dropdownLabelForCategoryCode,
} from "@/lib/reference/category-codes";
import { normalizeColorwayRows, syncLegacyColorwayFields } from "@/lib/job-colorways";

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
      name: draft.name.trim() || "Untitled style",
      style_name: draft.style_name?.trim() || draft.name.trim() || "Untitled style",
      category: categoryDropdown,
      po_number: draft.po_number?.trim() || null,
      scope_note: draft.scope_note?.trim() || undefined,
      updated_at: new Date().toISOString(),
    };
    onSave(normalizeJob(saved, project));
  }

  const colorwayRows = useMemo(
    () => draft.colorway_rows ?? normalizeColorwayRows(draft),
    [draft.colorway_rows, draft.colorway, draft.color_code],
  );
  const isPrimaryJob = allJobs.length === 0;

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
          body="Set up style, category, and sizing — same layout as the client quote. Costing and timeline come after create."
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

          <JobOverviewFields
            draft={draft}
            patch={patch}
            vendors={vendors}
            categoryDropdown={categoryDropdown}
            onCategoryChange={handleCategoryChange}
            onJobTypeChange={handleJobTypeChange}
            isPrimaryJob={isPrimaryJob}
            fieldClass={projectModalFieldClass}
            textareaClass={projectModalTextareaClass}
          />

          <ProjectModalField label="Colorways & sizing" icon={<StatusDot />}>
            <JobColorwayEditor
              rows={colorwayRows}
              onChange={(rows) =>
                patch(syncLegacyColorwayFields({ ...draft, colorway_rows: rows }))
              }
            />
          </ProjectModalField>

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

          <ProjectModalField label="Due date (optional)" icon={<CalendarIcon />}>
            <input
              type="date"
              className={projectModalFieldClass}
              value={isoToDateInput(draft.due_date)}
              onChange={(e) => patch({ due_date: dateInputToIso(e.target.value) })}
            />
          </ProjectModalField>

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
            Vendor POs are assigned when you send quote requests. Timeline steps seed from the job type.
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
