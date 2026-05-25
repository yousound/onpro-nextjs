"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MOCK_PENDING_INVITES,
  projectsForPerson,
  segmentBadgeSoftClass,
  segmentLabel,
  segmentPillSelectedClass,
  type DirectoryPerson,
  type PendingInvite,
  type PeopleSegment,
} from "@/lib/mock/people";
import type { Contact, TeamRole } from "@/lib/types/contact";
import { findContactByEmail, loadContacts, saveContacts, clientListContacts, searchContacts, upsertInvitedContact } from "@/lib/contacts-store";
import { effectiveContactPermissions, permissionsLabel } from "@/lib/contact-permissions";
import {
  AddClientModal,
  AddTeamMemberModal,
  AddVendorModal,
  contactToDirectoryRow,
  TEAM_ROLE_OPTIONS,
} from "@/components/add-contact-modals";
import { AvatarUpload, fieldClass } from "@/components/contact-form-fields";
import { formatShortDate } from "@/lib/format";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { defaultPermissionsForSegment, type ProjectPermissionFlags } from "@/lib/project-permissions";
import { buildPendingInvite } from "@/lib/people-invite";
import { InviteSentToast, type InviteToastPayload } from "@/components/invite-sent-toast";
import { PermissionsEditor } from "@/components/permissions-editor";
import { addInternalTeamMemberToProject } from "@/lib/internal-team-roster";
import { mergeProjectLists, readSessionProjects } from "@/lib/mock/project-session";
import { mockProjects } from "@/lib/mock/projects";
import type { Project } from "@/lib/types/project";

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

function AddTeamMemberToProjectRoster({ teamPeople }: { teamPeople: DirectoryPerson[] }) {
  const [projects, setProjects] = useState<Project[]>(() => mockProjects);

  useEffect(() => {
    setProjects(mergeProjectLists(mockProjects, readSessionProjects()));
  }, []);

  const projectsSorted = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const [personId, setPersonId] = useState("");
  const [projectIdStr, setProjectIdStr] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(
    null,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    if (!personId || !projectIdStr) {
      setFeedback({ tone: "err", text: "Choose a teammate and a project." });
      return;
    }
    const pid = Number(projectIdStr);
    const person = teamPeople.find((p) => p.id === personId);
    const proj = projects.find((p) => p.id === pid);
    if (!person || !proj) {
      setFeedback({ tone: "err", text: "Something went wrong — refresh and try again." });
      return;
    }
    const added = addInternalTeamMemberToProject(pid, person.name);
    setFeedback(
      added
        ? {
            tone: "ok",
            text: `${person.name} was added to the Internal roster for ${proj.name}. Open the project → Internal to assign them.`,
          }
        : {
            tone: "warn",
            text: `${person.name} is already on that project's Internal roster (or matches an existing name).`,
          },
    );
  }

  return (
    <div className="mt-8 rounded-2xl border border-border-light bg-surface-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-text-primary">Add teammate to a project</h3>
      <p className="mt-1 text-xs text-text-secondary">
        Pick someone from Team and a project — they appear in that project&apos;s Internal tab assignment dropdowns (browser-only mock).
      </p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={handleSubmit}>
        <label className="min-w-[11rem] flex-1">
          <span className="text-xs font-medium text-text-secondary">Teammate</span>
          <select
            value={personId}
            onChange={(ev) => {
              setPersonId(ev.target.value);
              setFeedback(null);
            }}
            className="mt-1 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Select teammate…</option>
            {teamPeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[11rem] flex-1">
          <span className="text-xs font-medium text-text-secondary">Project</span>
          <select
            value={projectIdStr}
            onChange={(ev) => {
              setProjectIdStr(ev.target.value);
              setFeedback(null);
            }}
            className="mt-1 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Select project…</option>
            {projectsSorted.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="shrink-0 rounded-xl border-2 border-dashed border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50"
        >
          + Add to project roster
        </button>
      </form>
      {feedback ? (
        <p
          className={`mt-3 text-sm font-medium ${
            feedback.tone === "ok"
              ? "text-emerald-700"
              : feedback.tone === "warn"
                ? "text-amber-800"
                : "text-red-600"
          }`}
          role={feedback.tone === "err" ? "alert" : "status"}
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}

export function PeopleView() {
  const searchParams = useSearchParams();
  const [segment, setSegment] = useState<PeopleSegment>(() => {
    const s = searchParams.get("segment");
    return s === "team" || s === "vendor" || s === "client" ? s : "team";
  });
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [detailPerson, setDetailPerson] = useState<ReturnType<typeof contactToDirectoryRow> | null>(null);
  const [pendingInviteDetail, setPendingInviteDetail] = useState<PendingInvite | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteInitialSegment, setInviteInitialSegment] = useState<PeopleSegment>("team");
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editClientContact, setEditClientContact] = useState<Contact | null>(null);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editTeamContact, setEditTeamContact] = useState<Contact | null>(null);
  const [inviteToast, setInviteToast] = useState<InviteToastPayload | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(() => [...MOCK_PENDING_INVITES]);
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts());
  const [contactsVersion, setContactsVersion] = useState(0);

  useEffect(() => {
    setContacts(loadContacts());
  }, [contactsVersion]);

  useEffect(() => {
    const saved = readMockLs<PendingInvite[]>(MOCK_LS.pendingInvites);
    if (saved !== null && Array.isArray(saved)) setPendingInvites(saved);
  }, []);

  useEffect(() => {
    if (!detailPerson && !inviteModalOpen && !pendingInviteDetail && !clientModalOpen && !vendorModalOpen && !teamModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (inviteModalOpen) setInviteModalOpen(false);
      else if (clientModalOpen) {
        setClientModalOpen(false);
        setEditClientContact(null);
      }
      else if (vendorModalOpen) setVendorModalOpen(false);
      else if (teamModalOpen) {
        setTeamModalOpen(false);
        setEditTeamContact(null);
      }
      else if (pendingInviteDetail) setPendingInviteDetail(null);
      else if (detailPerson) setDetailPerson(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailPerson, inviteModalOpen, pendingInviteDetail, clientModalOpen, vendorModalOpen, teamModalOpen]);

  const teamPeople = useMemo(
    () =>
      contacts
        .filter((c) => c.segment === "team")
        .map((c) => contactToDirectoryRow(c, contacts))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [contacts],
  );

  const filtered = useMemo(() => {
    const rows =
      segment === "client"
        ? clientListContacts(contacts, q)
        : searchContacts(contacts, q, segment);
    return rows.map((c) => contactToDirectoryRow(c, contacts));
  }, [contacts, segment, q]);

  function queueInvite(inv: PendingInvite) {
    setPendingInvites((prev) => {
      const next = [...prev, inv];
      writeMockLs(MOCK_LS.pendingInvites, next);
      return next;
    });
    setInviteToast({ email: inv.email, segment: inv.segment });
  }

  function openInviteModal(forSegment: "team" | "vendor") {
    setDetailPerson(null);
    setPendingInviteDetail(null);
    setInviteInitialSegment(forSegment);
    setInviteModalOpen(true);
  }

  const clientTable = segment === "client";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {pendingInviteDetail ? (
        <PendingInviteDetailModal
          invite={pendingInviteDetail}
          onClose={() => setPendingInviteDetail(null)}
          onDelete={(id) => {
            setPendingInvites((prev) => {
              const next = prev.filter((i) => i.id !== id);
              writeMockLs(MOCK_LS.pendingInvites, next);
              return next;
            });
            setPendingInviteDetail(null);
          }}
        />
      ) : null}
      {detailPerson ? (
        <PersonDetailModal
          person={detailPerson}
          contacts={contacts}
          onClose={() => setDetailPerson(null)}
          onContactsUpdated={() => setContactsVersion((v) => v + 1)}
          onEditClient={(contact) => {
            setDetailPerson(null);
            setEditClientContact(contact);
            setClientModalOpen(true);
          }}
        />
      ) : null}
      {inviteModalOpen ? (
        <InviteByEmailModal
          initialSegment={inviteInitialSegment}
          onClose={() => setInviteModalOpen(false)}
          onSent={queueInvite}
          onSaved={() => setContactsVersion((v) => v + 1)}
        />
      ) : null}
      {teamModalOpen ? (
        <AddTeamMemberModal
          existing={editTeamContact}
          onClose={() => {
            setTeamModalOpen(false);
            setEditTeamContact(null);
          }}
          onSaved={() => setContactsVersion((v) => v + 1)}
          onInviteSent={queueInvite}
        />
      ) : null}
      {clientModalOpen ? (
        <AddClientModal
          existing={editClientContact}
          onClose={() => {
            setClientModalOpen(false);
            setEditClientContact(null);
          }}
          onSaved={() => setContactsVersion((v) => v + 1)}
          onInviteSent={queueInvite}
        />
      ) : null}
      {vendorModalOpen ? (
        <AddVendorModal
          onClose={() => setVendorModalOpen(false)}
          onSaved={() => setContactsVersion((v) => v + 1)}
        />
      ) : null}

      <InviteSentToast payload={inviteToast} onDismiss={() => setInviteToast(null)} />

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-5">
        <div className="mx-auto max-w-[1600px] space-y-8">
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Pending invitations</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  Client and teammate contacts are added with Add client / Add teammate. Vendor invites save permissions on the contact profile.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDetailPerson(null);
                    setPendingInviteDetail(null);
                    setEditClientContact(null);
                    setClientModalOpen(true);
                  }}
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                >
                  + Add client
                </button>
              </div>
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
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setDetailPerson(null);
                        setInviteModalOpen(false);
                        setPendingInviteDetail(inv);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailPerson(null);
                          setInviteModalOpen(false);
                          setPendingInviteDetail(inv);
                        }
                      }}
                      className="flex w-[min(280px,calc(100vw-3rem))] shrink-0 snap-start cursor-pointer flex-col rounded-xl border border-border-light bg-surface-card px-4 py-3 shadow-sm transition hover:border-accent/35 hover:bg-violet-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                      aria-label={`Open pending invite for ${inv.email}`}
                    >
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(inv.segment)}`}
                      >
                        {segmentLabel(inv.segment)}
                      </span>
                      <p className="mt-1 font-medium text-accent underline-offset-2 hover:underline">{inv.email}</p>
                      <p className="mt-0.5 text-xs text-text-secondary">{inv.invited_label}</p>
                      <p className="mt-2 text-[11px] text-text-secondary">Sent {formatShortDate(`${inv.sent_at}T12:00:00`)}</p>
                      {inviteHasCustomPermissions(inv) ? (
                        <p className="mt-2 text-[11px] font-semibold text-violet-700">Custom permissions</p>
                      ) : null}
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                        Tap to manage
                      </p>
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:justify-end">
                {segment === "team" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailPerson(null);
                      setPendingInviteDetail(null);
                      setEditTeamContact(null);
                      setTeamModalOpen(true);
                    }}
                    className="shrink-0 rounded-xl border-2 border-dashed border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50"
                  >
                    + Add teammate
                  </button>
                ) : null}
                {segment === "vendor" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setVendorModalOpen(true)}
                      className="shrink-0 rounded-xl border-2 border-dashed border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50"
                    >
                      + Add vendor
                    </button>
                    <button
                      type="button"
                      onClick={() => openInviteModal("vendor")}
                      className="shrink-0 rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
                    >
                      + Invite by email
                    </button>
                  </>
                ) : null}
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={
                    segment === "client"
                      ? "Search client company, code, or contact…"
                      : "Search name, email, or company…"
                  }
                  className="h-11 w-full max-w-md rounded-xl border border-border-light bg-surface-card px-4 text-sm text-text-primary shadow-sm outline-none ring-accent/30 focus:ring-2"
                  aria-label="Search people"
                />
              </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-border-light shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-border-light bg-surface-body text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    <tr>
                      <th className="px-4 py-3">{clientTable ? "Company" : "Person"}</th>
                      <th className="hidden px-4 py-3 sm:table-cell">
                        {clientTable ? "People" : "Company"}
                      </th>
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
                        <PersonRow
                          key={p.id}
                          person={p}
                          clientTable={clientTable}
                          onOpen={() => {
                            setPendingInviteDetail(null);
                            setDetailPerson(p);
                          }}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {segment === "team" ? <AddTeamMemberToProjectRoster teamPeople={teamPeople} /> : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonRow({
  person: p,
  clientTable,
  onOpen,
}: {
  person: ReturnType<typeof contactToDirectoryRow>;
  clientTable?: boolean;
  onOpen: () => void;
}) {
  const n = projectsForPerson(p.id).length;
  const avatarUrl = p.contact.avatar_url;
  const companyLabel = p.clientCompanyName ?? (p.clientCompanyCode ? p.clientCompanyCode : "Individual");
  const avatarText = clientTable ? initials(companyLabel) : initials(p.name);

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
      aria-label={`Open ${clientTable ? companyLabel : p.name} — projects and permissions`}
    >
      <td className="px-4 py-3">
        {clientTable ? (
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-700">
              {avatarText}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-accent underline-offset-2 hover:underline">
                {p.clientCompanyName ?? "Individual client"}
              </p>
              {p.clientCompanyCode ? (
                <p className="mt-0.5 text-xs text-text-secondary">{p.clientCompanyCode}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-text-secondary sm:hidden">
                {p.clientPeople.length > 0 ? p.clientPeople.join(", ") : p.email}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-border-light"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-xs font-bold text-slate-700">
                {avatarText}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-medium text-accent underline-offset-2 hover:underline">{p.name}</p>
              {p.subtitle ? <p className="mt-0.5 text-xs text-text-secondary">{p.subtitle}</p> : null}
              <p className="mt-0.5 text-xs text-text-secondary sm:hidden">{p.email}</p>
            </div>
          </div>
        )}
      </td>
      <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
        {clientTable ? (
          p.clientPeople.length > 0 ? (
            <ul className="space-y-0.5">
              {p.clientPeople.map((person) => (
                <li key={person} className="text-text-primary">
                  {person}
                </li>
              ))}
            </ul>
          ) : (
            "—"
          )
        ) : (
          (p.company ?? "—")
        )}
      </td>
      <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{p.email}</td>
      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{p.phone ?? "—"}</td>
      <td className="px-4 py-3 text-right text-xs font-medium text-text-secondary">
        {n === 0 ? "—" : `${n} project${n === 1 ? "" : "s"}`}
      </td>
    </tr>
  );
}

function PendingInviteDetailModal({
  invite: inv,
  onClose,
  onDelete,
}: {
  invite: PendingInvite;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  function handleDelete() {
    if (!window.confirm(`Remove the pending invite for ${inv.email}?`)) return;
    onDelete(inv.id);
  }

  return (
    <div className="fixed inset-0 z-[223] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pending-invite-title"
        className="relative z-10 flex max-h-[min(720px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-border-light sm:max-w-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-light px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Pending invitation</p>
            <span
              className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(inv.segment)}`}
            >
              {segmentLabel(inv.segment)}
            </span>
            <h2 id="pending-invite-title" className="mt-2 break-all text-lg font-bold text-text-primary">
              {inv.email}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{inv.invited_label}</p>
            <p className="mt-2 text-xs text-text-secondary">
              Sent {formatShortDate(`${inv.sent_at}T12:00:00`)} · mock, stored in this browser
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Access after accept</p>
          <p className="mt-2 text-sm text-text-secondary">
            This email only tracks the invitation. Permissions come from the contact or company profile in People, and
            from each project&apos;s <span className="font-semibold text-text-primary">People &amp; access</span> tab.
          </p>
          <p className="mt-3 text-sm text-text-secondary">
            Company members inherit their company&apos;s permission profile automatically.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-border-light px-5 py-3 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            Delete invite
          </button>
        </div>
      </div>
    </div>
  );
}

const INVITE_SEGMENTS: PeopleSegment[] = ["team", "vendor"];

function InviteByEmailModal({
  onClose,
  onSent,
  onSaved,
  initialSegment = "team",
}: {
  onClose: () => void;
  onSent: (invite: PendingInvite) => void;
  onSaved: () => void;
  initialSegment?: PeopleSegment;
}) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [inviteSegment, setInviteSegment] = useState<PeopleSegment>(
    initialSegment === "client" ? "team" : initialSegment,
  );
  const [note, setNote] = useState("");
  const [teamRole, setTeamRole] = useState<TeamRole>("staff");
  const [teamRoleCustom, setTeamRoleCustom] = useState("");
  const [contactName, setContactName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [phone, setPhone] = useState("");
  const [permissions, setPermissions] = useState<ProjectPermissionFlags>(() =>
    defaultPermissionsForSegment(initialSegment === "client" ? "team" : initialSegment),
  );
  const [existingMatch, setExistingMatch] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPermissions(defaultPermissionsForSegment(inviteSegment));
  }, [inviteSegment]);

  useEffect(() => {
    requestAnimationFrame(() => emailRef.current?.focus());
  }, []);

  function validateEmail(value: string): boolean {
    const v = value.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function checkExistingEmail(value: string) {
    const trimmed = value.trim();
    if (!trimmed || !validateEmail(trimmed)) {
      setExistingMatch(null);
      return;
    }
    const match = findContactByEmail(loadContacts(), trimmed) ?? null;
    setExistingMatch(match);
    if (match?.permissions) setPermissions(match.permissions);
    if (match?.segment === "vendor" && match.kind === "company") {
      setVendorName(match.name);
      if (match.contact_name) setContactName(match.contact_name);
    } else if (match?.segment === "team") {
      setContactName(match.contact_name ?? match.name);
      if (match.team_role) setTeamRole(match.team_role);
      if (match.team_role_custom) setTeamRoleCustom(match.team_role_custom);
    }
    if (match?.phone) setPhone(match.phone);
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
    if (inviteSegment === "vendor" && !vendorName.trim() && !existingMatch) {
      setError("Vendor company name is required for new contacts.");
      return;
    }
    if (inviteSegment === "team" && !contactName.trim() && !existingMatch) {
      setError("Contact name is required for new teammates.");
      return;
    }
    setError(null);
    upsertInvitedContact({
      segment: inviteSegment,
      email: trimmed,
      permissions,
      name: inviteSegment === "vendor" ? vendorName.trim() : contactName.trim(),
      contactName: inviteSegment === "vendor" ? contactName.trim() || undefined : contactName.trim(),
      phone: phone.trim() || undefined,
      teamRole: inviteSegment === "team" ? teamRole : undefined,
      teamRoleCustom: inviteSegment === "team" ? teamRoleCustom : undefined,
    });
    onSaved();
    onSent(
      buildPendingInvite({
        email: trimmed,
        segment: inviteSegment,
        note,
        teamRole: inviteSegment === "team" ? teamRole : undefined,
        teamRoleCustom: inviteSegment === "team" ? teamRoleCustom : undefined,
        contactName: inviteSegment === "team" ? contactName : undefined,
        phone: inviteSegment === "team" ? phone : undefined,
      }),
    );
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
              Invite {inviteSegment === "team" ? "teammate" : "vendor"} by email
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              For clients, use Add client and optionally send an invite from there.
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
              checkExistingEmail(ev.target.value);
            }}
            onBlur={(ev) => checkExistingEmail(ev.target.value)}
            placeholder="name@company.com"
            className="mt-2 h-11 w-full rounded-xl border border-border-light bg-surface-card px-4 text-sm text-text-primary shadow-sm outline-none ring-accent/30 focus:ring-2"
          />
          {existingMatch ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-200">
              Will update existing contact
            </p>
          ) : null}

          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Segment</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INVITE_SEGMENTS.map((s) => (
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

          {inviteSegment === "team" ? (
            <div className="mt-5 space-y-4">
              <label htmlFor="invite-team-role" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Team role
              </label>
              <select
                id="invite-team-role"
                value={teamRole}
                onChange={(ev) => setTeamRole(ev.target.value as TeamRole)}
                className={fieldClass}
              >
                {TEAM_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {teamRole === "custom" ? (
                <label htmlFor="invite-team-role-custom" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Custom role label
                  <input
                    id="invite-team-role-custom"
                    type="text"
                    value={teamRoleCustom}
                    onChange={(ev) => setTeamRoleCustom(ev.target.value)}
                    placeholder="e.g. Project coordinator"
                    className={fieldClass}
                  />
                </label>
              ) : null}
              <label htmlFor="invite-contact-name" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Contact name
                <input
                  id="invite-contact-name"
                  type="text"
                  value={contactName}
                  onChange={(ev) => setContactName(ev.target.value)}
                  placeholder="Full name"
                  className={fieldClass}
                  required={!existingMatch}
                />
              </label>
              <label htmlFor="invite-phone" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Phone <span className="font-normal normal-case text-text-secondary">(optional)</span>
                <input
                  id="invite-phone"
                  type="tel"
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  placeholder="+1 555 0100"
                  className={fieldClass}
                />
              </label>
            </div>
          ) : null}

          {inviteSegment === "vendor" ? (
            <div className="mt-5 space-y-4">
              <label htmlFor="invite-vendor-name" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Vendor company name
                <input
                  id="invite-vendor-name"
                  type="text"
                  value={vendorName}
                  onChange={(ev) => setVendorName(ev.target.value)}
                  placeholder="Millworks Collective"
                  className={fieldClass}
                  required={!existingMatch}
                />
              </label>
              <label htmlFor="invite-vendor-contact" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Contact name <span className="font-normal normal-case text-text-secondary">(optional)</span>
                <input
                  id="invite-vendor-contact"
                  type="text"
                  value={contactName}
                  onChange={(ev) => setContactName(ev.target.value)}
                  placeholder="Primary contact"
                  className={fieldClass}
                />
              </label>
              <label htmlFor="invite-vendor-phone" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                Phone <span className="font-normal normal-case text-text-secondary">(optional)</span>
                <input
                  id="invite-vendor-phone"
                  type="tel"
                  value={phone}
                  onChange={(ev) => setPhone(ev.target.value)}
                  placeholder="+1 555 0100"
                  className={fieldClass}
                />
              </label>
            </div>
          ) : null}

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

          <fieldset className="mt-5 rounded-xl border border-border-light bg-surface-body/30 px-3 py-3">
            <p className="text-sm font-semibold text-text-primary">
              {inviteSegment === "vendor" ? "Company permissions" : "Contact permissions"}
            </p>
            <p className="mt-1 text-[11px] text-text-secondary">
              Saved on the contact profile when you send this invite. Per-project overrides are set under each
              project&apos;s <span className="font-semibold text-text-primary">People &amp; access</span> tab.
            </p>
            <div className="mt-3 max-h-[min(220px,32vh)] overflow-y-auto rounded-xl border border-border-light bg-white p-3">
              <PermissionsEditor segment={inviteSegment} flags={permissions} onChange={setPermissions} dense />
            </div>
          </fieldset>

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
              Save contact &amp; send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PersonDetailModal({
  person: p,
  contacts,
  onClose,
  onEditClient,
  onContactsUpdated,
}: {
  person: ReturnType<typeof contactToDirectoryRow>;
  contacts: Contact[];
  onClose: () => void;
  onEditClient: (contact: Contact) => void;
  onContactsUpdated: () => void;
}) {
  const access = projectsForPerson(p.id);
  const contact = p.contact;
  const effective = effectiveContactPermissions(contacts, contact);
  const [permDraft, setPermDraft] = useState<ProjectPermissionFlags>(effective.flags);
  const [permSaved, setPermSaved] = useState(false);
  const companyMembers =
    p.isCompany && contact.member_contact_ids?.length
      ? contacts.filter((c) => contact.member_contact_ids!.includes(c.id))
      : [];

  useEffect(() => {
    setPermDraft(effectiveContactPermissions(contacts, contact).flags);
  }, [contact, contacts]);

  function openEdit() {
    if (p.segment !== "client") return;
    if (p.isCompanyMember && contact.parent_company_id) {
      const parent = contacts.find((c) => c.id === contact.parent_company_id);
      if (parent) {
        onEditClient(parent);
        return;
      }
    }
    onEditClient(contact);
  }

  function savePermissions() {
    if (p.isCompanyMember) return;
    const targetId = p.isCompany ? contact.id : contact.id;
    const now = new Date().toISOString();
    const next = loadContacts().map((c) =>
      c.id === targetId ? { ...c, permissions: permDraft, updated_at: now } : c,
    );
    saveContacts(next);
    onContactsUpdated();
    setPermSaved(true);
    window.setTimeout(() => setPermSaved(false), 2000);
  }

  const canEditClient = p.segment === "client";
  const canEditPermissions = !p.isCompanyMember;

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
                {p.clientCompanyName ?? p.name}
              </h2>
              {p.clientCompanyCode ? (
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {p.clientCompanyCode}
                </p>
              ) : null}
              {p.clientPeople.length > 0 ? (
                <p className="truncate text-sm text-text-secondary">
                  People: {p.clientPeople.join(", ")}
                </p>
              ) : null}
              <p className="truncate text-sm text-text-secondary">{p.email}</p>
              {!p.isCompany && p.company ? (
                <p className="truncate text-xs text-text-secondary">{p.company}</p>
              ) : null}
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
          {companyMembers.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Company members</h3>
              <ul className="mt-2 space-y-1.5">
                {companyMembers.map((m) => (
                  <li key={m.id} className="text-sm text-text-primary">
                    {m.contact_name ?? m.name}
                    <span className="text-text-secondary"> · {m.email}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {p.isCompany ? "Company permissions" : "Workspace permissions"}
            </h3>
            <p className="mt-1 text-xs text-text-secondary">
              {permissionsLabel(effective.source, effective.company)}
              {p.isCompanyMember ? " — edit the company to change these for all members." : ""}
            </p>
            <div className="mt-3 max-h-[min(240px,34vh)] overflow-y-auto rounded-xl border border-border-light bg-surface-body/40 p-3">
              <PermissionsEditor
                dense
                readOnly={!canEditPermissions}
                segment={contact.segment}
                flags={permDraft}
                onChange={setPermDraft}
              />
            </div>
            {canEditPermissions ? (
              <button
                type="button"
                onClick={savePermissions}
                className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:opacity-95"
              >
                {permSaved ? "Saved" : "Save permissions"}
              </button>
            ) : (
              <button
                type="button"
                onClick={openEdit}
                className="mt-3 text-xs font-semibold text-accent hover:underline"
              >
                Edit company permissions →
              </button>
            )}
          </div>
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

        <div className="shrink-0 space-y-2 border-t border-border-light px-5 py-3">
          {canEditClient ? (
            <button
              type="button"
              onClick={openEdit}
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:opacity-95"
            >
              {p.isCompanyMember ? "Edit company" : p.isCompany ? "Edit client & members" : "Edit client"}
            </button>
          ) : null}
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
