import Link from "next/link";
import type { Project } from "@/lib/types/project";
import { formatShortDate, clientInitials } from "@/lib/format";
import { milestoneProgressPercent } from "@/lib/milestones";
import { healthLabel, projectHealth } from "@/lib/health";
import { migrateProjectStatus, projectStatusBadgeClass } from "@/lib/project-status";

function healthBarClass(band: ReturnType<typeof projectHealth>): string {
  switch (band) {
    case "on_track":
      return "bg-health-ok";
    case "at_risk":
      return "bg-health-warn";
    case "delayed":
      return "bg-health-bad";
  }
}

function healthBannerClass(band: ReturnType<typeof projectHealth>): string {
  switch (band) {
    case "on_track":
      return "bg-emerald-50 text-emerald-900 ring-emerald-100";
    case "at_risk":
      return "bg-amber-50 text-amber-950 ring-amber-100";
    case "delayed":
      return "bg-red-50 text-red-950 ring-red-100";
  }
}

export function ProjectCard({ project }: { project: Project }) {
  const band = projectHealth(project);
  const pct = milestoneProgressPercent(project);
  const lead = project.lead_team_member ?? project.dev_prod_assigned_team_member ?? "—";
  const stage = migrateProjectStatus(project.status);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex h-full min-h-[22rem] w-full min-w-0 flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-violet-200 hover:shadow-md"
    >
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-text-primary group-hover:text-accent">
              {project.name}
            </h3>
            {(project.project_number ?? project.po_number) ? (
              <p className="mt-0.5 text-xs font-medium text-text-secondary">
                {project.project_number ?? project.po_number}
              </p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${projectStatusBadgeClass(stage)}`}
          >
            {stage}
          </span>
        </div>
        <p className="mt-3 min-h-[2.75rem] text-sm leading-relaxed text-text-secondary line-clamp-2">
          {project.description ?? project.status_overview ?? "No description yet."}
        </p>
      </div>
      <div
        className={`mt-4 flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ring-1 ${healthBannerClass(band)}`}
        suppressHydrationWarning
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${healthBarClass(band)}`} aria-hidden />
        <span suppressHydrationWarning>{healthLabel(band)}</span>
      </div>
      <div className="mt-4 shrink-0">
        <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
          <span>Milestone progress</span>
          <span className="tabular-nums font-medium text-text-primary">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${healthBarClass(band)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="mt-4 grid shrink-0 grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs ring-1 ring-slate-100">
          <div className="text-text-secondary">Client</div>
          <div className="mt-0.5 truncate font-semibold text-text-primary">{project.client.name}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs ring-1 ring-slate-100">
          <div className="text-text-secondary">Lead</div>
          <div className="mt-0.5 truncate font-semibold text-text-primary">{lead}</div>
        </div>
      </div>
      <div className="min-h-4 flex-1" aria-hidden />
      <div className="flex shrink-0 items-center justify-between border-t border-slate-100 pt-4 text-xs text-text-secondary">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white"
          title={project.client.name}
        >
          {clientInitials(project.client.name)}
        </span>
        <div className="text-right font-semibold text-text-primary" suppressHydrationWarning>
          Due {formatShortDate(project.due_date) || "—"}
        </div>
      </div>
    </Link>
  );
}
