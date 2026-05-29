import Link from "next/link";
import type { Project } from "@/lib/types/project";
import { formatShortDate, clientInitials } from "@/lib/format";
import { milestoneProgressPercent } from "@/lib/milestones";
import { healthLabel, projectHealth } from "@/lib/health";
import { MilestoneStrip } from "@/components/milestone-strip";

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
      return "bg-emerald-50 text-emerald-900";
    case "at_risk":
      return "bg-amber-50 text-amber-950";
    case "delayed":
      return "bg-red-50 text-red-950";
  }
}

export function ProjectCard({ project }: { project: Project }) {
  const band = projectHealth(project);
  const pct = milestoneProgressPercent(project);
  const lead = project.lead_team_member ?? project.dev_prod_assigned_team_member ?? "—";
  const subtitle =
    [project.category, project.type].filter(Boolean).join(" · ") || "—";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex h-full min-h-[22rem] w-full min-w-0 flex-col rounded-2xl border border-border-light bg-surface-card p-5 shadow-sm transition hover:border-accent/30 hover:shadow-md"
    >
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-text-primary group-hover:text-accent">
              {project.name}
            </h3>
            {project.po_number ? (
              <p className="mt-0.5 text-xs font-medium text-text-secondary">PO {project.po_number}</p>
            ) : null}
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-text-secondary">
              {subtitle}
            </p>
          </div>
        </div>
        {/* Fixed block for two lines so short/long copy does not change card rhythm */}
        <p className="mt-3 min-h-[2.75rem] text-sm leading-relaxed text-text-secondary line-clamp-2">
          {project.description ?? project.status_overview ?? "No description yet."}
        </p>
      </div>
      <div
        className={`mt-4 flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${healthBannerClass(band)}`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${healthBarClass(band)}`} aria-hidden />
        {healthLabel(band)}
        <span className="ml-auto text-xs font-normal opacity-80">{project.status}</span>
      </div>
      <div className="mt-4 shrink-0">
        <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
          <span>Milestone progress</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-body">
          <div
            className={`h-full rounded-full ${healthBarClass(band)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="mt-4 grid shrink-0 grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-body px-3 py-2 text-xs">
          <div className="text-text-secondary">Client</div>
          <div className="mt-0.5 truncate font-medium text-text-primary">{project.client.name}</div>
        </div>
        <div className="rounded-lg bg-surface-body px-3 py-2 text-xs">
          <div className="text-text-secondary">Lead</div>
          <div className="mt-0.5 truncate font-medium text-text-primary">{lead}</div>
        </div>
      </div>
      {/* Absorbs extra row height so footers line up across the grid */}
      <div className="min-h-4 flex-1" aria-hidden />
      <div className="flex shrink-0 items-center justify-between border-t border-border-light pt-4 text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-chrome-elevated text-[11px] font-bold text-white"
            title={project.client.name}
          >
            {clientInitials(project.client.name)}
          </span>
          <MilestoneStrip project={project} />
        </div>
        <div className="text-right font-medium text-text-primary">
          Due {formatShortDate(project.due_date)}
        </div>
      </div>
    </Link>
  );
}
