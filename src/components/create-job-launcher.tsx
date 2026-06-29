"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import { JobDetailsModal } from "@/components/job-details-modal";
import { loadContacts, vendorContacts } from "@/lib/contacts-store";
import { normalizeJob } from "@/lib/job-defaults";
import { createNewJobSeed } from "@/lib/project-job-create";
import { getOrCreateOrderForJob, loadProjectOrders } from "@/lib/project-order-edits";
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

  const orders = useMemo(() => {
    if (!selectedProject) return [];
    return loadProjectOrders(selectedProject.id);
  }, [selectedProject, open]);

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

  const handleProjectChange = useCallback((projectId: number) => {
    setSelectedProjectId(projectId);
  }, []);

  const handleSave = useCallback(
    (saved: ProjectJob) => {
      const project = projects.find((p) => p.id === saved.project_id);
      if (!project) return;

      let jobToSave = saved;
      if (!saved.order_id) {
        const existingOrders = loadProjectOrders(project.id);
        const created = getOrCreateOrderForJob(project.id, project, existingOrders, "MAT", projects);
        jobToSave = { ...saved, order_id: created.orderId };
      }

      const current = loadProjectJobs(project.id, project);
      saveProjectJobs(project.id, [...current, jobToSave]);
      onJobCreated?.(project.id, jobToSave);
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
        <JobDetailsModal
          key={selectedProject.id}
          project={selectedProject}
          job={normalizeJob(jobSeed, selectedProject)}
          allJobs={projectJobs}
          orders={orders}
          clientCode={clientCodeByName(selectedProject.client.name) ?? "GG"}
          vendors={vendors}
          isNew
          allowProjectChange
          projects={projects}
          onProjectChange={handleProjectChange}
          onClose={() => setOpen(false)}
          onSave={handleSave}
        />
      ) : null}
    </>
  );
}
