"use client";

import { useEffect, type FormEvent } from "react";
import type { ProjectStatus } from "@/lib/types/project";
import {
  CalendarIcon,
  CheckMini,
  FolderIcon,
  HashIcon,
  NotesIcon,
  PencilIcon,
  ProjectModalAside,
  ProjectModalBadge,
  ProjectModalField,
  ProjectModalOverlay,
  ProjectModalPanelFooter,
  ProjectModalPanelHeader,
  StatusDot,
  UserIcon,
  projectModalFieldClass,
  projectModalTextareaClass,
} from "@/components/project-modal-ui";

export type EditProjectDraft = {
  name: string;
  status: ProjectStatus;
  po_number: string;
  hand_off: string;
  due_date: string;
  status_update: string;
  status_overview: string;
};

type Props = {
  open: boolean;
  titleId?: string;
  clientName: string;
  draft: EditProjectDraft;
  onDraftChange: (patch: Partial<EditProjectDraft>) => void;
  statusOptions: readonly ProjectStatus[];
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onDelete: () => void;
  deleting?: boolean;
};

export function EditProjectModal({
  open,
  titleId = "edit-project-title",
  clientName,
  draft,
  onDraftChange,
  statusOptions,
  onClose,
  onSubmit,
  onDelete,
  deleting = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSave = Boolean(draft.name.trim());

  return (
    <ProjectModalOverlay titleId={titleId} onClose={onClose} aside={
      <ProjectModalAside
        badge={
          <ProjectModalBadge>
            <PencilIcon />
          </ProjectModalBadge>
        }
        title={
          <>
            Keep everything
            <br />
            on track.
          </>
        }
        body="Update status, dates, and notes — your team sees the latest project details in one place."
      />
    }>
      <ProjectModalPanelHeader
        title="Edit project"
        subtitle="Update the basics for this production project."
        onClose={onClose}
      />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <ProjectModalField label="Project name" icon={<FolderIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.name}
              onChange={(e) => onDraftChange({ name: e.target.value })}
              placeholder="e.g. Spring capsule"
              required
              autoComplete="off"
            />
          </ProjectModalField>

          <ProjectModalField label="Client" icon={<UserIcon />}>
            <input
              className={`${projectModalFieldClass} bg-slate-50 text-slate-500`}
              value={clientName}
              readOnly
              tabIndex={-1}
              aria-readonly
            />
          </ProjectModalField>

          <ProjectModalField label="PO number" icon={<HashIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.po_number}
              onChange={(e) => onDraftChange({ po_number: e.target.value.toUpperCase() })}
              placeholder="e.g. DW260607"
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs font-normal normal-case text-slate-400">
              ClientCode+YYMM+Seq with no dashes. A new number is suggested when the month changes.
            </p>
          </ProjectModalField>

          <ProjectModalField label="Status" icon={<StatusDot />}>
            <select
              className={projectModalFieldClass}
              value={draft.status}
              onChange={(e) => onDraftChange({ status: e.target.value as ProjectStatus })}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </ProjectModalField>

          <div className="grid gap-4 sm:grid-cols-2">
            <ProjectModalField label="Hand off" icon={<CalendarIcon />}>
              <input
                type="date"
                className={projectModalFieldClass}
                value={draft.hand_off}
                onChange={(e) => onDraftChange({ hand_off: e.target.value })}
              />
            </ProjectModalField>
            <ProjectModalField label="Due date" icon={<CalendarIcon />}>
              <input
                type="date"
                className={projectModalFieldClass}
                value={draft.due_date}
                onChange={(e) => onDraftChange({ due_date: e.target.value })}
              />
            </ProjectModalField>
            <ProjectModalField label="Status update" icon={<CalendarIcon />}>
              <input
                type="date"
                className={projectModalFieldClass}
                value={draft.status_update}
                onChange={(e) => onDraftChange({ status_update: e.target.value })}
              />
            </ProjectModalField>
          </div>

          <ProjectModalField label="Status overview" icon={<NotesIcon />}>
            <textarea
              className={projectModalTextareaClass}
              rows={3}
              value={draft.status_overview}
              onChange={(e) => onDraftChange({ status_overview: e.target.value })}
              placeholder="Short update for the team"
            />
          </ProjectModalField>
        </div>

        <ProjectModalPanelFooter
          deleteLabel={deleting ? "Deleting…" : "Delete project"}
          onDelete={onDelete}
          deleteDisabled={deleting}
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel="Save changes"
          primaryIcon={<CheckMini />}
          primaryDisabled={!canSave || deleting}
        />
      </form>
    </ProjectModalOverlay>
  );
}
