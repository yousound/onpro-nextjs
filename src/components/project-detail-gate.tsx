"use client";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/types/project";
import { readSessionProjects } from "@/lib/mock/project-session";
import { ProjectJobsView } from "@/components/project-jobs-view";

export function ProjectDetailGate({
  id,
  staticProject,
}: {
  id: number;
  staticProject: Project | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const project = useMemo(() => {
    if (staticProject) return staticProject;
    if (!mounted) return null;
    return readSessionProjects().find((p) => p.id === id) ?? null;
  }, [staticProject, id, mounted]);

  if (!staticProject && !mounted) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white text-sm text-text-secondary">
        Loading…
      </div>
    );
  }

  if (!project) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <Suspense
        fallback={
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white text-sm text-text-secondary">
            Loading…
          </div>
        }
      >
        <ProjectJobsView project={project} />
      </Suspense>
    </div>
  );
}
