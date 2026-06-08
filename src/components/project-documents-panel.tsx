"use client";

import { useMemo } from "react";
import { DocumentsView } from "@/components/documents-view";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getDocuments } from "@/lib/mock/documents";
import type { Project } from "@/lib/types/project";

export function ProjectDocumentsPanel({ project }: { project: Project }) {
  const seedDocuments = useMemo(() => (isClientLiveBackend() ? [] : getDocuments()), []);

  return (
    <DocumentsView
      documents={seedDocuments}
      projectScope={{ projectId: project.id, projectName: project.name }}
    />
  );
}
