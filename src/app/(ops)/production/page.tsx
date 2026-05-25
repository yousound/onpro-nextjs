import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ProductionBoard } from "@/components/production-board";
import { getProjects } from "@/lib/mock/projects";

export default function ProductionPage() {
  const projects = getProjects();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Jobs"
          subtitle="See where each job stands across your pipeline—columns follow each project’s dates and milestones."
        />
      </div>
      <Suspense
        fallback={
          <div className="p-6 text-sm text-text-secondary">Loading production board…</div>
        }
      >
        <ProductionBoard projects={projects} />
      </Suspense>
    </div>
  );
}
