"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreateJobLauncher } from "@/components/create-job-launcher";
import { PageHeader } from "@/components/page-header";
import { ProductionBoard } from "@/components/production-board";
import { JobsConnectHero } from "@/components/jobs-connect-hero";
import { resolveClientProjectList } from "@/lib/mock/project-session";
import { countJobsAcrossProjects } from "@/lib/project-wip-edits";
import { sectionCoverHref, shouldShowSectionCover } from "@/lib/section-cover";
import { useStripSectionCoverWhenPopulated } from "@/lib/section-cover-hooks";
import { dispatchOpenNewProject } from "@/lib/onpro-events";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

function ProductionPageInner({
  projects: projectsProp,
  initialJobsByProject,
}: {
  projects: Project[];
  initialJobsByProject?: Record<number, ProjectJob[]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCoverPage = searchParams.get("cover") === "1";

  const projects = useMemo(() => resolveClientProjectList(projectsProp), [projectsProp]);
  const hasProjects = projects.length > 0;

  const [jobCount, setJobCount] = useState(0);
  const [jobsRevision, setJobsRevision] = useState(0);

  useLayoutEffect(() => {
    setJobCount(countJobsAcrossProjects(projects, initialJobsByProject));
  }, [projects, initialJobsByProject, jobsRevision]);

  useEffect(() => {
    setJobCount(countJobsAcrossProjects(projects, initialJobsByProject));
  }, [projects, initialJobsByProject, jobsRevision]);

  useEffect(() => {
    const bump = () => setJobsRevision((r) => r + 1);
    window.addEventListener("onpro-jobs-changed", bump);
    window.addEventListener("onpro-projects-changed", bump);
    return () => {
      window.removeEventListener("onpro-jobs-changed", bump);
      window.removeEventListener("onpro-projects-changed", bump);
    };
  }, []);

  const showHero = shouldShowSectionCover(showCoverPage, jobCount);
  useStripSectionCoverWhenPopulated("/production", searchParams, jobCount);

  const jobsHref = (cover: boolean) => sectionCoverHref("/production", searchParams, cover);
  const openCoverPage = () => router.push(jobsHref(true));
  const openBoard = () => router.push(jobsHref(false));
  const openProjects = () => router.push("/projects");

  function openCreateProject() {
    router.push("/projects");
    dispatchOpenNewProject();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Jobs"
          onInfoClick={openCoverPage}
          infoLabel="About Jobs"
          action={
            hasProjects ? (
              <CreateJobLauncher
                projects={projects}
                variant="header"
                buttonLabel="+ New job"
                onJobCreated={() => setJobsRevision((r) => r + 1)}
              />
            ) : null
          }
        />
      </div>
      {showHero ? (
        <JobsConnectHero
          hasProjects={hasProjects}
          onOpenProjects={openProjects}
          onCreateProject={openCreateProject}
          onDismiss={jobCount > 0 && showCoverPage ? openBoard : undefined}
        />
      ) : (
        <ProductionBoard projects={projects} refreshKey={jobsRevision} />
      )}
    </div>
  );
}

export function ProductionPageContent({
  projects,
  initialJobsByProject,
}: {
  projects: Project[];
  initialJobsByProject?: Record<number, ProjectJob[]>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-text-secondary">Loading production board…</div>
      }
    >
      <ProductionPageInner projects={projects} initialJobsByProject={initialJobsByProject} />
    </Suspense>
  );
}
