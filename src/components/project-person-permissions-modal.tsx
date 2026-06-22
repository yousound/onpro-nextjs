"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Project } from "@/lib/types/project";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { loadContacts } from "@/lib/contacts-store";
import { segmentBadgeSoftClass, segmentLabel } from "@/lib/mock/people";
import type { ProjectPersonRow } from "@/lib/project-people";
import {
  clearPersonPermissionOverride,
  resolvePersonProjectFlags,
  savePersonPermissionOverride,
  type PersonProjectFlagsSource,
} from "@/lib/project-person-permissions";
import {
  defaultPermissionsForSegment,
  type ProjectPermissionFlags,
} from "@/lib/project-permissions";
import type { PeopleSegment } from "@/lib/mock/people";
import { PermissionsEditor } from "@/components/permissions-editor";
import { useWorkspace } from "@/components/workspace-provider";
import { canManageWorkspacePermissions } from "@/lib/workspace-permissions-admin";

function sourceHint(source: PersonProjectFlagsSource, segment: PeopleSegment): string {
  switch (source) {
    case "saved":
      return "Custom permissions saved for this person on this project.";
    case "mock":
      return "Starting from demo access data — save to keep changes in this browser.";
    case "contact":
      return "Starting from this contact’s workspace profile — changes here apply to this project only.";
    case "role_default":
      return `Starting from ${segmentLabel(segment).toLowerCase()} role defaults on this project.`;
  }
}

export function ProjectPersonPermissionsModal({
  project,
  person,
  roleDefaults,
  onClose,
  onSaved,
}: {
  project: Project;
  person: ProjectPersonRow;
  roleDefaults: Record<PeopleSegment, ProjectPermissionFlags>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { isTeamView } = useWorkspace();
  const readOnly = !canManageWorkspacePermissions(isTeamView);
  const contacts = loadContacts();
  const baseline = resolvePersonProjectFlags(project.id, person, contacts, roleDefaults);
  const [draft, setDraft] = useState<ProjectPermissionFlags>(baseline.flags);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const next = resolvePersonProjectFlags(project.id, person, loadContacts(), roleDefaults);
    setDraft(next.flags);
    // Only re-load when switching person / project — not when role defaults change mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, person.key]);

  function save() {
    savePersonPermissionOverride(project.id, person.key, draft);
    setSavedFlash(true);
    onSaved();
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  function resetToRoleDefaults() {
    clearPersonPermissionOverride(project.id, person.key);
    setDraft(roleDefaults[person.segment]);
    onSaved();
  }

  function resetToSegmentDefaults() {
    clearPersonPermissionOverride(project.id, person.key);
    setDraft(defaultPermissionsForSegment(person.segment));
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-person-perm-title"
        className="relative z-10 flex max-h-[min(720px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-border-light sm:max-w-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-light px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <DirectoryAvatar
              name={person.displayName}
              avatarUrl={person.avatarUrl}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">On project</p>
              <p className="truncate text-sm font-semibold text-accent">{project.name}</p>
              <span
                className={`mt-1 inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(person.segment)}`}
              >
                {segmentLabel(person.segment)}
              </span>
              <h2 id="project-person-perm-title" className="truncate text-lg font-bold text-text-primary">
                {person.displayName}
              </h2>
              {person.subtitle ? (
                <p className="truncate text-sm text-text-secondary">{person.subtitle}</p>
              ) : null}
              <p className="mt-1 text-xs font-medium text-text-primary">{person.roleOnProject}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-text-secondary hover:bg-surface-body hover:text-text-primary"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-text-secondary">
            {readOnly
              ? "View only — only the workspace owner can change permissions."
              : sourceHint(baseline.source, person.segment)}
          </p>
          <div className="mt-4 max-h-[min(420px,50vh)] overflow-y-auto rounded-xl border border-border-light bg-surface-body/40 p-3">
            <PermissionsEditor
              segment={person.segment}
              flags={draft}
              onChange={setDraft}
              dense
              readOnly={readOnly}
            />
          </div>
        </div>

        <div className="shrink-0 space-y-2 border-t border-border-light px-5 py-3">
          {readOnly ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-border-light bg-white py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
            >
              Close
            </button>
          ) : (
            <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:opacity-95 sm:flex-none sm:px-6"
            >
              {savedFlash ? "Saved" : "Save for this project"}
            </button>
            <button
              type="button"
              onClick={resetToRoleDefaults}
              className="rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
            >
              Use role defaults
            </button>
            <button
              type="button"
              onClick={resetToSegmentDefaults}
              className="rounded-lg px-2 py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
            >
              Reset to OnPro defaults
            </button>
          </div>
          {person.contactId ? (
            <Link
              href="/people"
              className="block text-center text-xs font-semibold text-accent hover:underline"
              onClick={onClose}
            >
              Open full profile in People →
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-border-light bg-white py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
          >
            Close
          </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
