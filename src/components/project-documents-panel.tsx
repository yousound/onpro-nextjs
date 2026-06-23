"use client";

import { useEffect, useMemo } from "react";
import { DocumentsView } from "@/components/documents-view";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { reassignMailroomDocumentJobs } from "@/lib/documents/import-mailroom-images";
import { getDocuments } from "@/lib/mock/documents";
import { loadProjectJobs } from "@/lib/project-wip-edits";
import type { Project } from "@/lib/types/project";

function jobChoiceLabel(job: { job_number?: string; id: string; name?: string }) {
  const num = job.job_number?.trim() || job.id;
  const name = job.name?.trim();
  return name ? `${num} — ${name}` : num;
}

export function ProjectDocumentsPanel({ project }: { project: Project }) {
  const seedDocuments = useMemo(() => (isClientLiveBackend() ? [] : getDocuments()), []);
  const jobs = useMemo(() => loadProjectJobs(project.id, project), [project]);

  const jobChoices = useMemo(
    () =>
      jobs.map((job) => ({
        id: job.id,
        jobNumber: job.job_number?.trim() || job.id,
        label: jobChoiceLabel(job),
      })),
    [jobs],
  );

  useEffect(() => {
    void reassignMailroomDocumentJobs({ projectId: project.id, jobs });
  }, [project.id, jobs]);

  return (
    <DocumentsView
      documents={seedDocuments}
      projectScope={{ projectId: project.id, projectName: project.name, jobs: jobChoices }}
    />
  );
}
