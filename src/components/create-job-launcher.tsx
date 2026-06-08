"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import { NewJobModal } from "@/components/new-job-modal";
import { loadContacts, vendorContacts } from "@/lib/contacts-store";
import { normalizeJob } from "@/lib/job-defaults";
import { createNewJobSeed } from "@/lib/project-job-create";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";
import { clientCodeByName } from "@/lib/reference/client-codes";
import { resolveClientProjectList } from "@/lib/mock/project-session";

const HEADER_BUTTON_CLASS =
  "rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

const INLINE_BUTTON_CLASS = "text-sm font-semibold text-accent hover:underline disabled:opacity-50";

export function CreateJobLauncher({
  projects: projectsProp,
  presetProjectId,
  variant = "header",
  buttonLabel = "+ New job",
  className,
  onJobCreated,
  renderTrigger,
  open: controlledOpen,
  onOpenChange,
}: {
  projects?: Project[];
  presetProjectId?: number;
  variant?: "header" | "inline";
  buttonLabel?: string;
  className?: string;
  onJobCreated?: (projectId: number, job: ProjectJob) => void;
  renderTrigger?: (open: () => void) => ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const projects = useMemo(() => resolveClientProjectList(projectsProp ?? []), [projectsProp]);
  const vendors = useMemo(() => vendorContacts(loadContacts()), []);

  const defaultProjectId = useMemo(() => {
    if (presetProjectId != null && projects.some((p) => p.id === presetProjectId)) {
      return presetProjectId;
    }
    return projects[0]?.id ?? null;
  }, [presetProjectId, projects]);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [jobSeed, setJobSeed] = useState<ProjectJob | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const projectJobs = useMemo(() => {
    if (!selectedProject) return [];
    return loadProjectJobs(selectedProject.id, selectedProject);
  }, [selectedProject, open, jobSeed?.id]);

  useEffect(() => {
    if (!open) return;
    const id = defaultProjectId;
    setSelectedProjectId(id);
  }, [open, defaultProjectId]);

  useEffect(() => {
    if (!open || selectedProjectId == null) {
      setJobSeed(null);
      return;
    }
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) {
      setJobSeed(null);
      return;
    }
    setJobSeed(createNewJobSeed(project, loadProjectJobs(project.id, project)));
  }, [open, selectedProjectId, projects]);

  const openModal = useCallback(() => {
    if (projects.length === 0) return;
    setOpen(true);
  }, [projects.length, setOpen]);

  const handleProjectChange = useCallback(
    (projectId: number) => {
      setSelectedProjectId(projectId);
    },
    [],
  );

  const handleSave = useCallback(
    (saved: ProjectJob) => {
      const project = projects.find((p) => p.id === saved.project_id);
      if (!project) return;
      const current = loadProjectJobs(project.id, project);
      saveProjectJobs(project.id, [...current, saved]);
      onJobCreated?.(project.id, saved);
      setOpen(false);
    },
    [projects, onJobCreated, setOpen],
  );

  const disabled = projects.length === 0;

  const trigger =
    renderTrigger?.(openModal) ??
    (variant === "header" ? (
      <button
        type="button"
        onClick={openModal}
        disabled={disabled}
        className={className ?? HEADER_BUTTON_CLASS}
      >
        {buttonLabel}
      </button>
    ) : (
      <button
        type="button"
        onClick={openModal}
        disabled={disabled}
        className={className ?? INLINE_BUTTON_CLASS}
      >
        {buttonLabel}
      </button>
    ));

  return (
    <>
      {trigger}
      {open && selectedProject && jobSeed ? (
        <NewJobModal
          key={selectedProject.id}
          projects={projects}
          project={selectedProject}
          onProjectChange={handleProjectChange}
          job={normalizeJob(jobSeed, selectedProject)}
          allJobs={projectJobs}
          clientCode={clientCodeByName(selectedProject.client.name) ?? "GG"}
          vendors={vendors}
          onClose={() => setOpen(false)}
          onSave={handleSave}
        />
      ) : null}
    </>
  );
}
