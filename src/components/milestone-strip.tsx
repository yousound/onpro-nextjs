import type { Project } from "@/lib/types/project";
import { MILESTONE_DEFINITIONS } from "@/lib/milestones";

export function MilestoneStrip({ project }: { project: Project }) {
  return (
    <div
      className="flex items-center gap-0.5"
      title="Read-only preview: each dot fills when the matching project date (or flag) is set in data. Edit project fields (or API) to move forward; clear a field to go back."
    >
      {MILESTONE_DEFINITIONS.map((m) => {
        const v = m.pick(project);
        const filled =
          typeof v === "boolean" ? v === true : v != null && String(v).length > 0;
        return (
          <span
            key={m.id}
            title={m.label}
            className={`h-2 w-2 rounded-full ${
              filled ? "bg-health-ok" : "bg-border-light"
            }`}
          />
        );
      })}
    </div>
  );
}
