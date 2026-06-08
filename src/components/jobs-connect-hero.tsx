"use client";

import { CoverPreviewShell, OpsSectionCover } from "@/components/ops-section-cover";

type Props = {
  onOpenProjects: () => void;
  onCreateProject: () => void;
  hasProjects: boolean;
  onDismiss?: () => void;
};

export function JobsConnectHero({ onOpenProjects, onCreateProject, hasProjects, onDismiss }: Props) {
  return (
    <OpsSectionCover
      headline={
        <>
          See every job across your <span className="text-[#7c3aed]">pipeline</span>
        </>
      }
      subhead="The Jobs board rolls up every production run from all projects. Columns follow each job’s WIP milestones so you can spot bottlenecks before they slip."
      dismissAction={onDismiss ? { label: "View jobs board →", onClick: onDismiss } : undefined}
      cards={[
        {
          title: "One board, all projects",
          description: "Every job from every project in a single table — job number, client, project, and current WIP stage.",
          preview: (
            <CoverPreviewShell>
              <div className="space-y-1.5 font-mono text-[10px] text-slate-600">
                <div className="font-bold text-violet-600">PO-2401 · Main style</div>
                <div className="text-slate-400">Acme Co · Spring collection</div>
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "WIP columns",
          description: "Track vendor inquiries, mock-ups, costing, production, and shipping — aligned to how your floor actually runs.",
          preview: (
            <CoverPreviewShell>
              <div className="flex gap-0.5">
                {["VI", "MO", "CS", "PR", "SH"].map((c, i) => (
                  <div
                    key={c}
                    className={`flex-1 rounded py-1 text-center text-[9px] font-semibold ${i < 3 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}
                  >
                    {c}
                  </div>
                ))}
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Open job details",
          description: "Click any row to inspect timelines, vendors, POs, and updates — without leaving the board.",
          preview: (
            <CoverPreviewShell>
              <div className="space-y-1">
                <div className="h-2 w-full rounded bg-slate-100" />
                <div className="h-2 w-2/3 rounded bg-slate-100" />
                <div className="h-2 w-1/2 rounded bg-slate-100" />
              </div>
            </CoverPreviewShell>
          ),
        },
      ]}
      primaryAction={{
        label: hasProjects ? "Open projects" : "Create your first project",
        onClick: hasProjects ? onOpenProjects : onCreateProject,
      }}
    />
  );
}
