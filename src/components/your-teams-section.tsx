"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { segmentLabel } from "@/lib/mock/people";
import type { WorkspaceMatch } from "@/lib/types/workspace";

type Props = {
  /** Overview uses a page section; Contacts uses a compact card below roster tools. */
  variant?: "overview" | "contacts";
  className?: string;
};

export function YourTeamsSection({ variant = "overview", className }: Props) {
  const liveMode = isClientLiveBackend();
  const [teams, setTeams] = useState<WorkspaceMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!liveMode) return;
    setLoading(true);
    void fetch("/api/workspace/joined-teams", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { teams: [] }))
      .then((data: { teams?: WorkspaceMatch[] }) => {
        setTeams(data.teams ?? []);
      })
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  }, [liveMode]);

  if (!liveMode) return null;

  const showEmpty = !loading && teams.length === 0;
  const showOverview = variant === "overview" && (loading || teams.length > 0);
  const showContacts = variant === "contacts";

  if (!showOverview && !showContacts) return null;

  const list = (
    <ul className={variant === "overview" ? "mt-4 space-y-3" : "mt-3 space-y-2"}>
      {loading ? (
        <li className="rounded-2xl border border-dashed border-border-light bg-surface-body/30 px-4 py-6 text-center text-sm text-text-secondary">
          Loading teams…
        </li>
      ) : showEmpty ? (
        <li className="rounded-xl border border-dashed border-border-light bg-surface-body/30 px-4 py-5 text-center text-sm text-text-secondary">
          You&apos;re not on any workspaces yet. Accept a team invite or join from onboarding to appear here.
        </li>
      ) : (
        teams.map((team) => {
          const key = `${team.operatorUserId}:${team.contactId}`;
          const roleLabel = team.segment ? segmentLabel(team.segment) : "Team";
          return (
            <li key={key}>
              <div
                className={
                  variant === "overview"
                    ? "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-light bg-surface-card p-4 shadow-sm"
                    : "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light bg-white px-4 py-3"
                }
              >
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary">{team.workspaceName}</p>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {roleLabel} · {team.contactDisplayName} · {team.projectCount}{" "}
                    {team.projectCount === 1 ? "project" : "projects"}
                  </p>
                </div>
                <Link
                  href="/projects"
                  className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                >
                  Open projects
                </Link>
              </div>
            </li>
          );
        })
      )}
    </ul>
  );

  if (variant === "contacts") {
    return (
      <div
        className={`mt-6 rounded-2xl border border-border-light bg-surface-card p-5 shadow-sm ${className ?? ""}`}
      >
        <h3 className="text-sm font-semibold text-text-primary">Teams you&apos;re part of</h3>
        <p className="mt-1 text-xs text-text-secondary">
          Workspaces where you&apos;re on the roster as a teammate, vendor, or client contact.
        </p>
        {list}
      </div>
    );
  }

  return (
    <section className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-text-primary">Your teams</h2>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
          {loading ? "…" : teams.length}
        </span>
      </div>
      {list}
    </section>
  );
}
