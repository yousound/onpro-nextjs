"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MOCK_DIRECTORY_PEOPLE,
  MOCK_PENDING_INVITES,
  projectsForPerson,
  segmentBadgeSoftClass,
  segmentLabel,
  segmentPillSelectedClass,
  type DirectoryPerson,
  type PendingInvite,
  type PeopleSegment,
} from "@/lib/mock/people";
import { formatShortDate } from "@/lib/format";
import { defaultPermissionsForSegment, type ProjectPermissionFlags } from "@/lib/project-permissions";
import { InviteSentToast, type InviteToastPayload } from "@/components/invite-sent-toast";
import { PermissionsEditor } from "@/components/permissions-editor";

function inviteHasCustomPermissions(inv: PendingInvite): boolean {
  if (!inv.permissions) return false;
  return JSON.stringify(inv.permissions) !== JSON.stringify(defaultPermissionsForSegment(inv.segment));
}

const SEGMENTS: PeopleSegment[] = ["team", "vendor", "client"];

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function segmentFromRoleLabel(role: string): PeopleSegment | null {
  const x = role.trim().toLowerCase();
  if (x === "team") return "team";
  if (x === "vendor") return "vendor";
  if (x === "client") return "client";
  return null;
}

export function PeopleView() {
  const [segment, setSegment] = useState<PeopleSegment>("team");
  const [q, setQ] = useState("");
  const [detailPerson, setDetailPerson] = useState<DirectoryPerson | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteToast, setInviteToast] = useState<InviteToastPayload | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(() => [...MOCK_PENDING_INVITES]);

  useEffect(() => {
    if (!detailPerson && !inviteModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (inviteModalOpen) setInviteModalOpen(false);
      else if (detailPerson) setDetailPerson(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailPerson, inviteModalOpen]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return MOCK_DIRECTORY_PEOPLE.filter((p) => {
      if (p.segment !== segment) return false;
      if (!needle) return true;
      const blob = `${p.name} ${p.email} ${p.company ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [segment, q]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {detailPerson ? (
        <PersonDetailModal person={detailPerson} onClose={() => setDetailPerson(null)} />
      ) : null}
      {inviteModalOpen ? (
        <InviteByEmailModal
          onClose={() => setInviteModalOpen(false)}
          onSent={(inv) => {
            setPendingInvites((prev) => [...prev, inv]);
            setInviteToast({ email: inv.email, segment: inv.segment });
          }}
        />
      ) : null}

      <InviteSentToast payload={inviteToast} onDismiss={() => setInviteToast(null)} />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-5">
        <div className="mx-auto max-w-[1600px] space-y-8">
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Pending invitations</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailPerson(null);
                  setInviteModalOpen(true);
                }}
                className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                + Invite by email
              </button>
            </div>
            {pendingInvites.length === 0 ? (
              <p className="mt-4 text-sm text-text-secondary">No pending invites.</p>
            ) : (
              <div className="relative mt-4">
                <ul
                  className="scrollbar-light-gray -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 [-ms-overflow-style:auto] [scrollbar-gutter:stable]"
                >
                  {pendingInvites.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex w-[min(280px,calc(100vw-3rem))] shrink-0 snap-start flex-col rounded-xl border border-border-light bg-surface-card px-4 py-3 shadow-sm"
                    >
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(inv.segment)}`}
                      >
                        {segmentLabel(inv.segment)}
                      </span>
                      <p className="mt-1 font-medium text-text-primary">{inv.email}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">{inv.invited_label}</p>
                      <p className="mt-2 text-[11px] text-text-secondary">Sent {formatShortDate(`${inv.sent_at}T12:00:00`)}</p>
                      {inviteHasCustomPermissions(inv) ? (
                        <p className="mt-2 text-[11px] font-semibold text-violet-700">Custom permissions</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <div className="border-t border-border-light pt-6">
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSegment(s)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                    segment === s
                      ? segmentPillSelectedClass(s)
                      : "bg-surface-card text-text-secondary ring-1 ring-border-light hover:text-text-primary"
                  }`}
                >
                  {segmentLabel(s)}
                </button>
              ))}
            </div>

            <section className="mt-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-sm font-semibold text-text-primary">{segmentLabel(segment)}</h2>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, email, or company…"
                  className="h-11 w-full max-w-md rounded-xl border border-border-light bg-surface-card px-4 text-sm text-text-primary shadow-sm outline-none ring-accent/30 focus:ring-2"
                  aria-label="Search people"
                />
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-border-light shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border-light bg-surface-body text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    <tr>
                      <th className="px-4 py-3">Person</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Company</th>
                      <th className="hidden px-4 py-3 md:table-cell">Email</th>
                      <th className="hidden px-4 py-3 lg:table-cell">Phone</th>
                      <th className="px-4 py-3 text-right">Projects</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light bg-white">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-text-secondary">
                          No people match your search in this segment (mock).
                        </td>
                      </tr>
                    ) : (
                      filtered.map((p) => (
                        <PersonRow key={p.id} person={p} onOpen={() => setDetailPerson(p)} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonRow({ person: p, onOpen }: { person: DirectoryPerson; onOpen: () => void }) {
  const n = projectsForPerson(p.id).length;

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer border-border-light transition hover:bg-violet-50/60 focus-visible:bg-violet-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
      aria-label={`Open ${p.name} — projects and permissions`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-700">
            {initials(p.name)}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-accent underline-offset-2 hover:underline">{p.name}</p>
            <p className="mt-0.5 text-xs text-text-secondary sm:hidden">{p.email}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">{p.company ?? "—"}</td>
      <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{p.email}</td>
      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{p.phone ?? "—"}</td>
      <td className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
        {n === 0 ? "—" : `${n} project${n === 1 ? "" : "s"}`}
      </td>
    </tr>
  );
}

function InviteByEmailModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: (invite: PendingInvite) => void;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [inviteSegment, setInviteSegment] = useState<PeopleSegment>("vendor");
  const [permissionFlags, setPermissionFlags] = useState<ProjectPermissionFlags>(() =>
    defaultPermissionsForSegment("vendor"),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => emailRef.current?.focus());
  }, []);

  useEffect(() => {
    setPermissionFlags(defaultPermissionsForSegment(inviteSegment));
  }, [inviteSegment]);

  function validateEmail(value: string): boolean {
    const v = value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter an email address.");
      return;
    }
    if (!validateEmail(trimmed)) {
      setError("That doesn't look like a valid email.");
      return;
    }
    setError(null);
    const invited_label =
      note.trim() ||
      `${segmentLabel(inviteSegment)} · ${inviteSegment === "team" ? "Workspace member" : inviteSegment === "vendor" ? "Vendor lane" : "Client access"}`;
    const sent_at = new Date().toISOString().slice(0, 10);
    onSent({
      id: `inv-${Date.now()}`,
      email: trimmed,
      segment: inviteSegment,
      invited_label,
      sent_at,
      permissions: permissionFlags,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[225] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-email-title"
        className="relative z-10 flex min-h-0 max-h-[min(680px,92vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-border-light sm:max-w-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-light px-5 py-4">
          <div>
            <h2 id="invite-email-title" className="text-lg font-bold text-text-primary">
              Invite by email
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Choose segment and permissions — mock adds them to pending below.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-text-secondary hover:bg-surface-body hover:text-text-primary"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <label htmlFor="invite-email-input" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Email
          </label>
          <input
            ref={emailRef}
            id="invite-email-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => {
              setEmail(ev.target.value);
              setError(null);
            }}
            placeholder="name@company.com"
            className="mt-2 h-11 w-full rounded-xl border border-border-light bg-surface-card px-4 text-sm text-text-primary shadow-sm outline-none ring-accent/30 focus:ring-2"
          />

          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Segment</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInviteSegment(s)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  inviteSegment === s
                    ? segmentPillSelectedClass(s)
                    : "bg-surface-card text-text-secondary ring-1 ring-border-light hover:text-text-primary"
                }`}
              >
                {segmentLabel(s)}
              </button>
            ))}
          </div>

          <label htmlFor="invite-note-input" className="mt-5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Label <span className="font-normal normal-case text-text-secondary">(optional)</span>
          </label>
          <input
            id="invite-note-input"
            type="text"
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="e.g. Vendor · QC lane"
            className="mt-2 h-11 w-full rounded-xl border border-border-light bg-surface-card px-4 text-sm text-text-primary shadow-sm outline-none ring-accent/30 focus:ring-2"
          />

          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Permissions for this invite</p>
          <p className="mt-1 text-xs text-text-secondary">Adjust toggles before sending; segment chips above choose which rows apply.</p>
          <div className="mt-3 max-h-[min(260px,38vh)] overflow-y-auto rounded-xl border border-border-light bg-surface-body/40 p-3 pr-2">
            <PermissionsEditor dense segment={inviteSegment} flags={permissionFlags} onChange={setPermissionFlags} />
          </div>

          {error ? (
            <p className="mt-3 text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border-light px-5 py-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PersonDetailModal({ person: p, onClose }: { person: DirectoryPerson; onClose: () => void }) {
  const access = projectsForPerson(p.id);

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-detail-title"
        className="relative z-10 flex max-h-[min(720px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-border-light sm:max-w-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-light px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-violet-200 text-sm font-bold text-violet-900">
              {initials(p.name)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Workspace segment</p>
              <span
                className={`mt-1 inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(p.segment)}`}
              >
                {segmentLabel(p.segment)}
              </span>
              <h2 id="people-detail-title" className="truncate text-lg font-bold text-text-primary">
                {p.name}
              </h2>
              <p className="truncate text-sm text-text-secondary">{p.email}</p>
              {p.company ? <p className="truncate text-xs text-text-secondary">{p.company}</p> : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-text-secondary hover:bg-surface-body hover:text-text-primary"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Projects &amp; permissions</h3>
          {access.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">No project access in mock data for this person.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {access.map((row) => {
                const roleSeg = segmentFromRoleLabel(row.role_on_project);
                return (
                  <li key={`${p.id}-${row.project_id}`} className="rounded-xl border border-border-light bg-surface-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${row.project_id}`}
                        className="font-semibold text-accent hover:underline"
                        onClick={onClose}
                      >
                        {row.project_name}
                      </Link>
                      <p className="mt-1 text-xs text-text-secondary">Role on project</p>
                      {roleSeg ? (
                        <span
                          className={`mt-1 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(roleSeg)}`}
                        >
                          {row.role_on_project}
                        </span>
                      ) : (
                        <p className="mt-1 text-sm font-medium text-text-primary">{row.role_on_project}</p>
                      )}
                    </div>
                    <Link
                      href={`/projects/${row.project_id}`}
                      className="shrink-0 text-xs font-semibold text-accent hover:underline"
                      onClick={onClose}
                    >
                      Open project →
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3 border-t border-border-light pt-3">
                    {row.permission_groups.map((g) => (
                      <div key={g.title}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{g.title}</p>
                        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-text-primary">
                          {g.lines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <Link
                    href={`/projects/${row.project_id}?module=people_access`}
                    className="mt-3 inline-flex text-xs font-semibold text-accent hover:underline"
                    onClick={onClose}
                  >
                    People &amp; access — edit role defaults on this project
                  </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-border-light px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-border-light bg-white py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
