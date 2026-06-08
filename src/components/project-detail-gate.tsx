"use client";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/types/project";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { upsertLiveProject } from "@/lib/data/live-cache";
import { readSessionProjects } from "@/lib/mock/project-session";
import { ProjectJobsView } from "@/components/project-jobs-view";
import type { ProjectJob } from "@/lib/types/wip";

export function ProjectDetailGate({
  id,
  staticProject,
  initialJobs,
}: {
  id: number;
  staticProject: Project | null;
  initialJobs?: ProjectJob[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sessionProject = useMemo(() => {
    if (!mounted) return null;
    return readSessionProjects().find((p) => p.id === id) ?? null;
  }, [id, mounted]);

  const project = staticProject ?? sessionProject;

  useEffect(() => {
    if (!project || !isClientLiveBackend()) return;
    upsertLiveProject(project);
  }, [project, id]);

  if (!staticProject && !mounted) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white text-sm text-text-secondary">
        Loading…
      </div>
    );
  }

  if (!project) notFound();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <Suspense
        fallback={
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white text-sm text-text-secondary">
            Loading…
          </div>
        }
      >
        <ProjectJobsView project={project} initialJobs={initialJobs} />
      </Suspense>
    </div>
  );
}
