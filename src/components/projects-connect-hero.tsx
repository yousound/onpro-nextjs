"use client";

import { CoverPreviewShell, OpsSectionCover } from "@/components/ops-section-cover";

type Props = {
  onCreateProject: () => void;
  onDismiss?: () => void;
};

export function ProjectsConnectHero({ onCreateProject, onDismiss }: Props) {
  return (
    <OpsSectionCover
      headline={
        <>
          Every client engagement in <span className="text-[#7c3aed]">one place</span>
        </>
      }
      subhead="Each project is a production engagement — a style, collection, or order tied to a client. Track status, due dates, jobs, and team from one command center."
      dismissAction={onDismiss ? { label: "View projects →", onClick: onDismiss } : undefined}
      cards={[
        {
          title: "Browse and filter",
          description: "Search by name, PO, or style. Filter by status and client. Switch between cards and table view.",
          preview: (
            <CoverPreviewShell>
              <div className="space-y-2">
                <div className="h-2 w-3/4 rounded bg-slate-100" />
                <div className="flex gap-2">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">In progress</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">Due May 18</span>
                </div>
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Track project at a glance",
          description: "Header KPIs show total projects, on track, at risk, and delayed — so you know where to focus.",
          preview: (
            <CoverPreviewShell>
              <div className="grid grid-cols-4 gap-1.5">
                {["12", "8", "3", "1"].map((n, i) => (
                  <div key={i} className="rounded-lg bg-slate-50 px-1 py-1.5 text-center">
                    <p className="text-xs font-bold text-slate-800">{n}</p>
                  </div>
                ))}
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Jobs inside each project",
          description: "Open a project to manage production runs — main styles, add-ons, and reorders with WIP timelines.",
          preview: (
            <CoverPreviewShell>
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-violet-600">Main style · PO-2401</div>
                <div className="flex gap-0.5">
                  {["Inq", "Mock", "Cost", "Prod"].map((c, i) => (
                    <div
                      key={c}
                      className={`flex-1 rounded py-1 text-center text-[9px] font-semibold ${
                        i < 2 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </CoverPreviewShell>
          ),
        },
      ]}
      primaryAction={{ label: "Create your first project", onClick: onCreateProject }}
    />
  );
}
