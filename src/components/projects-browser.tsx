"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Project, ProjectStatus } from "@/lib/types/project";
import { ProjectCard } from "@/components/project-card";

const STATUSES: (ProjectStatus | "ALL")[] = [
  "ALL",
  "IN DEVELOPMENT",
  "PENDING",
  "IN-PROGRESS",
  "COMPLETED",
  "DELIVERED",
];

/** Wider minimum track (~384px): fewer columns per row, cards use more horizontal space; `1fr` still evens gaps. */
const CARD_GRID_CLASS =
  "grid w-full grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-4 sm:gap-5";

export function ProjectsBrowser({ projects }: { projects: Project[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [clientId, setClientId] = useState<number | "ALL">("ALL");

  const clients = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of projects) m.set(p.client.id, p.client.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (clientId !== "ALL" && p.client.id !== clientId) return false;
      if (!needle) return true;
      const blob = `${p.name} ${p.client.name} ${p.project_number ?? ""} ${p.style_number ?? ""} ${p.po_number ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [projects, q, status, clientId]);

  const [dense, setDense] = useState(false);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Status filters under light Projects header */}
      <div className="shrink-0 border-b border-border-light bg-white px-6 py-2.5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                status === s
                  ? "bg-accent text-white shadow-sm"
                  : "bg-surface-card text-text-secondary ring-1 ring-border-light hover:text-text-primary"
              }`}
            >
              {s === "ALL" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white">
        <div className="w-full max-w-none px-6 pb-8 pt-4">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search projects…"
                className="h-11 flex-1 rounded-xl border border-border-light bg-surface-card px-4 text-sm text-text-primary shadow-sm outline-none ring-accent/30 focus:ring-2"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={clientId === "ALL" ? "" : String(clientId)}
                  onChange={(e) =>
                    setClientId(e.target.value === "" ? "ALL" : Number(e.target.value))
                  }
                  className="h-11 rounded-xl border border-border-light bg-surface-card px-3 text-sm text-text-primary"
                  aria-label="Filter by client"
                >
                  <option value="">All clients</option>
                  {clients.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setDense((d) => !d)}
                  className="h-11 rounded-xl border border-border-light bg-surface-card px-4 text-sm font-medium text-text-primary hover:bg-surface-body"
                >
                  {dense ? "Card view" : "More filters"}
                </button>
              </div>
            </div>

            <div className="mt-6">
              {dense ? (
                <div className="overflow-x-auto rounded-xl border border-border-light bg-surface-card">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-border-light bg-surface-body text-xs uppercase text-text-secondary">
                      <tr>
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Due</th>
                        <th className="px-4 py-3">Lead</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr key={p.id} className="border-b border-border-light last:border-0">
                          <td className="px-4 py-3 font-medium text-text-primary">
                            <Link href={`/projects/${p.id}`} className="hover:text-accent">
                              {p.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{p.client.name}</td>
                          <td className="px-4 py-3 text-text-secondary">{p.status}</td>
                          <td className="px-4 py-3 text-text-secondary">{p.due_date ?? "—"}</td>
                          <td className="px-4 py-3 text-text-secondary">
                            {p.lead_team_member ?? p.dev_prod_assigned_team_member ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={CARD_GRID_CLASS}>
                  {filtered.map((p) => (
                    <div key={p.id} className="flex h-full min-h-0 w-full min-w-0">
                      <ProjectCard project={p} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
