"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { segmentLabel } from "@/lib/mock/people";
import { joinWorkspaceMatch } from "@/lib/workspace-join-client";
import type { WorkspaceMatch } from "@/lib/types/workspace";

type Props = {
  /** Overview uses a page section; Contacts uses a compact card below roster tools. */
  variant?: "overview" | "contacts";
  className?: string;
};

export function YourTeamsSection({ variant = "overview", className }: Props) {
  const liveMode = isClientLiveBackend();
  const [teams, setTeams] = useState<WorkspaceMatch[]>([]);
  const [joined, setJoined] = useState<WorkspaceMatch[]>([]);
  const [pending, setPending] = useState<WorkspaceMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!liveMode) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/joined-teams", { cache: "no-store" });
      const data = (await res.json()) as {
        teams?: WorkspaceMatch[];
        joined?: WorkspaceMatch[];
        pending?: WorkspaceMatch[];
      };
      const all = data.teams ?? [];
      setTeams(all);
      setJoined(data.joined ?? all.filter((t) => t.alreadyJoined));
      setPending(data.pending ?? all.filter((t) => !t.alreadyJoined));
    } catch {
      setTeams([]);
      setJoined([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [liveMode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!liveMode) return;
    const onChange = () => void load();
    window.addEventListener("onpro-workspace-changed", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("onpro-workspace-changed", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [liveMode, load]);

  async function handleJoin(team: WorkspaceMatch) {
    const key = `${team.operatorUserId}:${team.contactId}`;
    setJoiningId(key);
    setJoinError(null);
    try {
      await joinWorkspaceMatch(team);
      await fetch("/api/workspace/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_user_id: team.operatorUserId }),
      });
      window.dispatchEvent(new Event("onpro-workspace-changed"));
      await load();
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Could not join team");
    } finally {
      setJoiningId(null);
    }
  }

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
          No team invites yet. When someone adds your email as a teammate, you&apos;ll see a join
          option here and in the sidebar.
        </li>
      ) : (
        <>
          {pending.map((team) => {
            const key = `${team.operatorUserId}:${team.contactId}`;
            const roleLabel = team.segment ? segmentLabel(team.segment) : "Team";
            return (
              <li key={`pending-${key}`}>
                <div
                  className={
                    variant === "overview"
                      ? "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm"
                      : "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3"
                  }
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary">{team.workspaceName}</p>
                    <p className="mt-0.5 text-sm text-amber-900/90">
                      Invited as {roleLabel} · {team.contactDisplayName}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={joiningId === key}
                    onClick={() => void handleJoin(team)}
                    className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
                  >
                    {joiningId === key ? "Joining…" : "Join team"}
                  </button>
                </div>
              </li>
            );
          })}
          {joined.map((team) => {
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
          })}
        </>
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
          Pending invites and workspaces you&apos;ve joined — use the sidebar switcher to change
          active workspace.
        </p>
        {joinError ? (
          <p className="mt-2 text-xs font-medium text-red-600" role="alert">
            {joinError}
          </p>
        ) : null}
        {list}
      </div>
    );
  }

  return (
    <section className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-text-primary">Your teams</h2>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
          {loading ? "…" : joined.length}
        </span>
        {pending.length > 0 ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
            {pending.length} invite{pending.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      {list}
    </section>
  );
}
