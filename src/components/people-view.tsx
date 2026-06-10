"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import type { Contact } from "@/lib/types/contact";
import { loadContacts, clientListContacts, searchContacts } from "@/lib/contacts-store";
import { mergeSeedLiveContacts } from "@/lib/data/live-cache";
import { commitContactPermissions, commitSingleContact } from "@/lib/data/commit-contacts";
import {
  convertContactToSegment,
  validateSegmentConversion,
  type ConvertibleSegment,
} from "@/lib/contact-segment-convert";
import { workspaceDisplayName } from "@/lib/workspace-display-name";
import { useWorkspace } from "@/components/workspace-provider";
import { useDeleteContact } from "@/lib/use-delete-contact";
import { isClientLiveBackend, isClientMockBackend } from "@/lib/config/backend-mode";
import { effectiveContactPermissions, permissionsLabel } from "@/lib/contact-permissions";
import {
  AddClientModal,
  AddTeamMemberModal,
  AddVendorModal,
  contactToDirectoryRow,
} from "@/components/add-contact-modals";
import { formatShortDate } from "@/lib/format";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { defaultPermissionsForSegment, type ProjectPermissionFlags } from "@/lib/project-permissions";
import { InviteSentToast, type InviteToastPayload } from "@/components/invite-sent-toast";
import { PendingInviteDetailModal } from "@/components/pending-invite-detail-modal";
import { PermissionsEditor } from "@/components/permissions-editor";
import {
  ModalSectionMobileNav,
  ModalSectionNavList,
  type ModalSectionItem,
} from "@/components/modal-section-layout";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { addInternalTeamMemberToProject } from "@/lib/internal-team-roster";
import { resolveClientProjectList } from "@/lib/mock/project-session";
import type { Project } from "@/lib/types/project";
import { YourTeamsSection } from "@/components/your-teams-section";

function inviteHasCustomPermissions(inv: PendingInvite): boolean {
  if (!inv.permissions) return false;
  return JSON.stringify(inv.permissions) !== JSON.stringify(defaultPermissionsForSegment(inv.segment));
}

const SEGMENTS: PeopleSegment[] = ["team", "vendor", "client"];

export type PeopleAddSignal = {
  kind: "client" | "team" | "vendor";
  tick: number;
};

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

function AddTeamMemberToProjectRoster({
  teamPeople,
  initialProjects,
}: {
  teamPeople: DirectoryPerson[];
  initialProjects?: Project[];
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects ?? []);

  useEffect(() => {
    setProjects(resolveClientProjectList(initialProjects ?? []));
  }, [initialProjects]);

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

export function PeopleView({
  initialContacts,
  initialProjects,
  addSignal,
  onContactsChange,
}: {
  initialContacts?: Contact[];
  initialProjects?: Project[];
  addSignal?: PeopleAddSignal | null;
  onContactsChange?: (count: number) => void;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [segment, setSegment] = useState<PeopleSegment>(() => {
    const s = searchParams.get("segment");
    return s === "team" || s === "vendor" || s === "client" ? s : "team";
  });
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [detailPerson, setDetailPerson] = useState<ReturnType<typeof contactToDirectoryRow> | null>(null);
  const [pendingInviteDetail, setPendingInviteDetail] = useState<PendingInvite | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editClientContact, setEditClientContact] = useState<Contact | null>(null);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [editVendorContact, setEditVendorContact] = useState<Contact | null>(null);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [editTeamContact, setEditTeamContact] = useState<Contact | null>(null);
  const [inviteToast, setInviteToast] = useState<InviteToastPayload | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(() =>
    isClientMockBackend() ? [...MOCK_PENDING_INVITES] : [],
  );
  const [contacts, setContacts] = useState<Contact[]>(() =>
    initialContacts?.length ? initialContacts : loadContacts(),
  );
  const [contactsVersion, setContactsVersion] = useState(0);

  async function refreshContacts() {
    setContactsVersion((v) => v + 1);
    if (isClientLiveBackend()) {
      try {
        const res = await fetch("/api/contacts", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { contacts?: Contact[] };
          if (Array.isArray(data.contacts)) {
            const { mergeSeedLiveContacts } = await import("@/lib/data/live-cache");
            mergeSeedLiveContacts(data.contacts);
            setContacts(loadContacts());
          }
        }
      } catch {
        /* router.refresh still re-seeds from RSC */
      }
      router.refresh();
      return;
    }
    setContacts(loadContacts());
  }

  useEffect(() => {
    if (initialContacts == null) return;
    if (isClientLiveBackend()) {
      mergeSeedLiveContacts(initialContacts);
      setContacts(loadContacts());
      return;
    }
    setContacts(initialContacts);
  }, [initialContacts]);

  useEffect(() => {
    onContactsChange?.(contacts.length);
  }, [contacts.length, onContactsChange]);

  useEffect(() => {
    if (!addSignal?.tick) return;
    setDetailPerson(null);
    setPendingInviteDetail(null);
    if (addSignal.kind === "client") {
      setEditClientContact(null);
      setClientModalOpen(true);
    } else if (addSignal.kind === "team") {
      setEditTeamContact(null);
      setTeamModalOpen(true);
    } else {
      setVendorModalOpen(true);
    }
  }, [addSignal?.tick, addSignal?.kind]);

  useEffect(() => {
    if (!isClientMockBackend()) return;
    setContacts(loadContacts());
  }, [contactsVersion]);

  useEffect(() => {
    function onContactsChanged() {
      if (isClientLiveBackend()) {
        void (async () => {
          try {
            const res = await fetch("/api/contacts", { cache: "no-store" });
            if (res.ok) {
              const data = (await res.json()) as { contacts?: Contact[] };
              if (Array.isArray(data.contacts)) {
                mergeSeedLiveContacts(data.contacts);
              }
            }
          } catch {
            /* keep cached list */
          }
          setContacts(loadContacts());
          setContactsVersion((v) => v + 1);
          void fetch("/api/invites")
            .then((r) => r.json())
            .then((data: { invites?: PendingInvite[] }) => {
              if (Array.isArray(data.invites)) setPendingInvites(data.invites);
            })
            .catch(() => {});
        })();
        return;
      }
      setContacts(loadContacts());
      setContactsVersion((v) => v + 1);
    }
    window.addEventListener("onpro-contacts-changed", onContactsChanged);
    return () => window.removeEventListener("onpro-contacts-changed", onContactsChanged);
  }, []);

  useEffect(() => {
    if (isClientMockBackend()) {
      const saved = readMockLs<PendingInvite[]>(MOCK_LS.pendingInvites);
      if (saved !== null && Array.isArray(saved)) setPendingInvites(saved);
      return;
    }
    if (!isClientLiveBackend()) return;
    void fetch("/api/invites")
      .then((r) => r.json())
      .then((data: { invites?: PendingInvite[] }) => {
        if (Array.isArray(data.invites)) setPendingInvites(data.invites);
      })
      .catch(() => {});
  }, [contactsVersion]);

  useEffect(() => {
    if (!detailPerson && !pendingInviteDetail && !clientModalOpen && !vendorModalOpen && !teamModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (clientModalOpen) {
        setClientModalOpen(false);
        setEditClientContact(null);
      }
      else if (vendorModalOpen) {
        setVendorModalOpen(false);
        setEditVendorContact(null);
      }
      else if (teamModalOpen) {
        setTeamModalOpen(false);
        setEditTeamContact(null);
      }
      else if (pendingInviteDetail) setPendingInviteDetail(null);
      else if (detailPerson) setDetailPerson(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailPerson, pendingInviteDetail, clientModalOpen, vendorModalOpen, teamModalOpen]);

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

  async function copyPendingInviteLink(inviteId: string): Promise<void> {
    const res = await fetch("/api/invites/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invite_id: inviteId, refresh_expiry: true }),
    });
    const data = (await res.json()) as { loginUrl?: string; error?: string };
    if (!res.ok || !data.loginUrl) {
      throw new Error(data.error ?? "Could not get invite link");
    }
    await navigator.clipboard.writeText(data.loginUrl);
    setInviteToast({
      email: pendingInvites.find((i) => i.id === inviteId)?.email ?? "Invitee",
      segment: pendingInvites.find((i) => i.id === inviteId)?.segment ?? "client",
      loginUrl: data.loginUrl,
    });
  }

  function queueInvite(inv: PendingInvite, loginUrl?: string) {
    if (isClientLiveBackend()) {
      setPendingInvites((prev) => {
        const exists = prev.some((p) => p.id === inv.id);
        return exists ? prev : [...prev, inv];
      });
      setInviteToast({ email: inv.email, segment: inv.segment, loginUrl });
      return;
    }
    setPendingInvites((prev) => {
      const next = [...prev, inv];
      writeMockLs(MOCK_LS.pendingInvites, next);
      return next;
    });
    setInviteToast({ email: inv.email, segment: inv.segment, loginUrl });
  }

  const clientTable = segment === "client";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {pendingInviteDetail ? (
        <PendingInviteDetailModal
          invite={pendingInviteDetail}
          onClose={() => setPendingInviteDetail(null)}
          onCopyInviteLink={isClientLiveBackend() ? copyPendingInviteLink : undefined}
          onDelete={(id) => {
            if (isClientLiveBackend()) {
              void fetch(`/api/invites?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => {
                setPendingInvites((prev) => prev.filter((i) => i.id !== id));
              });
            } else {
              setPendingInvites((prev) => {
                const next = prev.filter((i) => i.id !== id);
                writeMockLs(MOCK_LS.pendingInvites, next);
                return next;
              });
            }
            setPendingInviteDetail(null);
          }}
        />
      ) : null}
      {detailPerson ? (
        <PersonDetailModal
          person={detailPerson}
          contacts={contacts}
          onClose={() => setDetailPerson(null)}
          onContactsUpdated={refreshContacts}
          onDeleted={refreshContacts}
          onEditClient={(contact) => {
            setDetailPerson(null);
            setEditClientContact(contact);
            setClientModalOpen(true);
          }}
          onEditTeam={(contact) => {
            setDetailPerson(null);
            setEditTeamContact(contact);
            setTeamModalOpen(true);
          }}
          onEditVendor={(contact) => {
            setDetailPerson(null);
            setEditVendorContact(contact);
            setVendorModalOpen(true);
          }}
        />
      ) : null}
      {teamModalOpen ? (
        <AddTeamMemberModal
          existing={editTeamContact}
          onClose={() => {
            setTeamModalOpen(false);
            setEditTeamContact(null);
          }}
          onSaved={refreshContacts}
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
          onSaved={refreshContacts}
          onInviteSent={queueInvite}
        />
      ) : null}
      {vendorModalOpen ? (
        <AddVendorModal
          existing={editVendorContact}
          onClose={() => {
            setVendorModalOpen(false);
            setEditVendorContact(null);
          }}
          onSaved={refreshContacts}
          onInviteSent={queueInvite}
        />
      ) : null}

      <InviteSentToast payload={inviteToast} onDismiss={() => setInviteToast(null)} />

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pb-10 pt-5">
        <div className="mx-auto max-w-[1600px] space-y-8">
          <section>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Pending invitations</h2>
              <p className="mt-1 text-xs text-text-secondary">
                Copy invite links from each card or open to resend. Links expire after 14 days.
              </p>
            </div>
            {pendingInvites.length === 0 ? (
              <p className="mt-4 text-sm text-text-secondary">No pending invites.</p>
            ) : (
              <div className="relative mt-4">
                <ul
                  className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1"
                >
                  {pendingInvites.map((inv) => (
                    <li
                      key={inv.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setDetailPerson(null);
                        setPendingInviteDetail(inv);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailPerson(null);
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
                      {isClientLiveBackend() ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyPendingInviteLink(inv.id).catch((err) => {
                              window.alert(err instanceof Error ? err.message : "Could not copy link");
                            });
                          }}
                          className="mt-3 text-left text-[11px] font-semibold text-[#7c3aed] hover:underline"
                        >
                          Resend invite link
                        </button>
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
                  <button
                    type="button"
                    onClick={() => {
                      setDetailPerson(null);
                      setPendingInviteDetail(null);
                      setEditVendorContact(null);
                      setVendorModalOpen(true);
                    }}
                    className="shrink-0 rounded-xl border-2 border-dashed border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50"
                  >
                    + Add vendor
                  </button>
                ) : null}
                {segment === "client" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDetailPerson(null);
                      setPendingInviteDetail(null);
                      setEditClientContact(null);
                      setClientModalOpen(true);
                    }}
                    className="shrink-0 rounded-xl border-2 border-dashed border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50"
                  >
                    + Add client
                  </button>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light bg-white">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-text-secondary">
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

              {segment === "team" ? (
                <>
                  <AddTeamMemberToProjectRoster
                    teamPeople={teamPeople}
                    initialProjects={initialProjects}
                  />
                  <YourTeamsSection variant="contacts" />
                </>
              ) : null}
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
  const avatarUrl = p.contact.avatar_url ?? null;
  const companyLabel = p.clientCompanyName ?? (p.clientCompanyCode ? p.clientCompanyCode : "Individual");
  const displayName = clientTable ? (p.clientCompanyName ?? "Individual client") : p.name;

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
        <div className="flex items-center gap-3">
          <DirectoryAvatar name={displayName} avatarUrl={avatarUrl} size="sm" />
          <div className="min-w-0">
            {clientTable ? (
              <>
                <p className="font-medium text-accent underline-offset-2 hover:underline">
                  {p.clientCompanyName ?? "Individual client"}
                </p>
                {p.clientCompanyCode ? (
                  <p className="mt-0.5 text-xs text-text-secondary">{p.clientCompanyCode}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-text-secondary sm:hidden">
                  {p.clientPeople.length > 0 ? p.clientPeople.join(", ") : p.email}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-accent underline-offset-2 hover:underline">{p.name}</p>
                {p.subtitle ? <p className="mt-0.5 text-xs text-text-secondary">{p.subtitle}</p> : null}
                <p className="mt-0.5 text-xs text-text-secondary sm:hidden">{p.email}</p>
              </>
            )}
          </div>
        </div>
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
    </tr>
  );
}

function PersonDetailModal({
  person: p,
  contacts,
  onClose,
  onEditClient,
  onEditTeam,
  onEditVendor,
  onContactsUpdated,
  onDeleted,
}: {
  person: ReturnType<typeof contactToDirectoryRow>;
  contacts: Contact[];
  onClose: () => void;
  onEditClient: (contact: Contact) => void;
  onEditTeam: (contact: Contact) => void;
  onEditVendor: (contact: Contact) => void;
  onContactsUpdated: () => void | Promise<void>;
  onDeleted: () => void;
}) {
  const { isTeamView, active, switchWorkspace, refresh: refreshWorkspace, joinedTeams } = useWorkspace();
  const access = projectsForPerson(p.id);
  const contact = p.contact;
  const effective = effectiveContactPermissions(contacts, contact);
  const [permDraft, setPermDraft] = useState<ProjectPermissionFlags>(effective.flags);
  const [permSaved, setPermSaved] = useState(false);
  const [membershipId, setMembershipId] = useState<number | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [convertingSegment, setConvertingSegment] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  const { deleting, deleteError, clearDeleteError, handleDelete } = useDeleteContact({
    onSuccess: () => {
      onDeleted();
      onClose();
    },
  });
  const companyMembers =
    p.isCompany && contact.member_contact_ids?.length
      ? contacts.filter((c) => contact.member_contact_ids!.includes(c.id))
      : [];

  useEffect(() => {
    setPermDraft(effectiveContactPermissions(contacts, contact).flags);
  }, [contact, contacts]);

  useEffect(() => {
    if (
      !isClientLiveBackend() ||
      p.isCompanyMember ||
      (p.segment !== "client" && p.segment !== "team" && p.segment !== "vendor")
    ) {
      setMembershipId(null);
      return;
    }
    void fetch(`/api/workspace/memberships?contact_id=${encodeURIComponent(contact.id)}`)
      .then((r) => r.json())
      .then((data: { membership?: { id: number } | null }) => {
        setMembershipId(data.membership?.id ?? null);
      })
      .catch(() => setMembershipId(null));
  }, [contact.id, p.segment, p.isCompanyMember]);

  async function savePermissions() {
    if (p.isCompanyMember) return;
    const targetId = contact.id;
    try {
      await commitContactPermissions(targetId, permDraft);
      onContactsUpdated();
      setPermSaved(true);
      window.setTimeout(() => setPermSaved(false), 2000);
    } catch {
      setPermSaved(false);
    }
  }

  async function revokeLinkedAccess() {
    if (membershipId == null) return;
    setRevoking(true);
    try {
      await fetch("/api/workspace/memberships/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: Number(contact.id) }),
      });
      setMembershipId(null);
      onContactsUpdated();
    } finally {
      setRevoking(false);
    }
  }

  const canEditPermissions = !p.isCompanyMember;
  const canMoveSegment =
    !p.isCompanyMember && (p.segment === "vendor" || p.segment === "client");
  const moveSegmentTarget: ConvertibleSegment | null =
    p.segment === "vendor" ? "client" : p.segment === "client" ? "vendor" : null;

  const viewedWorkspaceName = useMemo(() => {
    if (!isTeamView) return active.workspaceName;
    const team = joinedTeams.find((t) => t.operatorUserId === active.operatorUserId);
    return workspaceDisplayName({
      workspaceName: team?.workspaceName ?? active.workspaceName,
      contactCompanyName: team?.contactDisplayName,
      fallback: active.workspaceName,
    });
  }, [isTeamView, active, joinedTeams]);

  async function handleMoveSegment(target: ConvertibleSegment) {
    setConvertingSegment(true);
    setSegmentError(null);
    let switchedFromTeam = false;
    try {
      if (isClientLiveBackend() && isTeamView) {
        switchedFromTeam = true;
        await switchWorkspace(null);
        await refreshWorkspace();
        await Promise.resolve(onContactsUpdated());
      }

      const list = loadContacts();
      const targetContact =
        list.find((c) => c.id === contact.id) ??
        list.find(
          (c) => c.email.trim().toLowerCase() === contact.email.trim().toLowerCase(),
        );

      if (!targetContact) {
        setSegmentError(
          switchedFromTeam
            ? "Switched to your workspace. This contact isn’t in your directory yet — add them under Clients or Vendors, or they may only exist on the other team’s workspace."
            : "Contact not found in your directory. Try refreshing the page.",
        );
        return;
      }

      const err = validateSegmentConversion(list, targetContact, target);
      if (err) {
        setSegmentError(err);
        return;
      }

      const converted = convertContactToSegment(targetContact, target);
      await commitSingleContact(converted);
      await Promise.resolve(onContactsUpdated());
      onClose();
    } catch (e) {
      setSegmentError(e instanceof Error ? e.message : "Could not move contact");
    } finally {
      setConvertingSegment(false);
    }
  }

  function openEdit() {
    if (p.segment === "client") {
      if (p.isCompanyMember && contact.parent_company_id) {
        const parent = contacts.find((c) => c.id === contact.parent_company_id);
        if (parent) {
          onEditClient(parent);
          return;
        }
      }
      onEditClient(contact);
      return;
    }
    if (p.segment === "team") {
      onEditTeam(contact);
      return;
    }
    if (p.segment === "vendor") {
      onEditVendor(contact);
    }
  }

  const editLabel =
    p.segment === "client"
      ? p.isCompanyMember
        ? "Edit company"
        : p.isCompany
          ? "Edit client & members"
          : "Edit client"
      : p.segment === "team"
        ? "Edit teammate"
        : "Edit vendor";

  const deleteLabel =
    p.segment === "client"
      ? p.isCompany
        ? "Delete client"
        : "Remove contact"
      : p.segment === "team"
        ? "Delete teammate"
        : "Delete vendor";

  const [activeSection, setActiveSection] = useState("overview");

  const detailSections = useMemo(() => {
    const items: ModalSectionItem[] = [
      { id: "overview", label: "Overview" },
      { id: "permissions", label: "Permissions" },
      { id: "projects", label: "Projects" },
    ];
    if (canMoveSegment || membershipId != null) {
      items.push({ id: "workspace", label: "Directory" });
    }
    return items;
  }, [canMoveSegment, membershipId]);

  useEffect(() => {
    if (!detailSections.some((s) => s.id === activeSection)) {
      setActiveSection("overview");
    }
  }, [detailSections, activeSection]);

  const sectionTitle =
    detailSections.find((s) => s.id === activeSection)?.label ?? "Overview";

  const sectionSubtitle: Record<string, string> = {
    overview: "Profile, contact details, and company members.",
    permissions: p.isCompany ? "Company-wide access defaults." : "Workspace access for this contact.",
    projects: "Project roles and permission summaries.",
    workspace: "Directory segment and linked app account.",
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-detail-title"
        className="relative z-10 flex max-h-[min(720px,92vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-border-light"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Left: identity + section nav */}
          <aside className="flex shrink-0 flex-col border-b border-violet-200/60 bg-gradient-to-b from-violet-100/90 to-violet-50/80 sm:w-[min(100%,15rem)] sm:border-b-0 sm:border-r">
            <div className="px-4 pb-3 pt-4">
              <div className="flex items-start gap-3">
                <DirectoryAvatar name={p.clientCompanyName ?? p.name} avatarUrl={contact.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(p.segment)}`}
                  >
                    {segmentLabel(p.segment)}
                  </span>
                  <h2 id="people-detail-title" className="mt-1.5 truncate text-base font-bold text-violet-950">
                    {p.clientCompanyName ?? p.name}
                  </h2>
                  {p.clientCompanyCode ? (
                    <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-violet-800/80">
                      {p.clientCompanyCode}
                    </p>
                  ) : null}
                  <p className="mt-0.5 truncate text-xs text-violet-900/75">{p.email}</p>
                </div>
              </div>
            </div>
            <nav className="hidden flex-1 overflow-y-auto px-3 pb-4 sm:block" aria-label="Contact sections">
              <ModalSectionNavList
                sections={detailSections}
                activeSection={activeSection}
                onSectionChange={setActiveSection}
                navLabel="Contact sections"
                variant="polished"
                tone="aside"
              />
            </nav>
          </aside>

          {/* Right: section content */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-light px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Contact</p>
                <h3 className="text-lg font-semibold text-text-primary">{sectionTitle}</h3>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {sectionSubtitle[activeSection] ?? ""}
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

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="sm:hidden">
                <ModalSectionMobileNav
                  sections={detailSections}
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
                  navLabel="Contact sections"
                  variant="polished"
                />
              </div>
              {activeSection === "overview" ? (
                <div className="space-y-5">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border-light bg-surface-body/40 px-3 py-2.5">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Email</dt>
                      <dd className="mt-0.5 text-sm font-medium text-text-primary">{p.email}</dd>
                    </div>
                    <div className="rounded-xl border border-border-light bg-surface-body/40 px-3 py-2.5">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Phone</dt>
                      <dd className="mt-0.5 text-sm font-medium text-text-primary">{p.phone?.trim() || "—"}</dd>
                    </div>
                    {p.clientCompanyCode ? (
                      <div className="rounded-xl border border-border-light bg-surface-body/40 px-3 py-2.5">
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Code</dt>
                        <dd className="mt-0.5 text-sm font-medium uppercase text-text-primary">{p.clientCompanyCode}</dd>
                      </div>
                    ) : null}
                    {!p.isCompany && p.company ? (
                      <div className="rounded-xl border border-border-light bg-surface-body/40 px-3 py-2.5">
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Company</dt>
                        <dd className="mt-0.5 text-sm font-medium text-text-primary">{p.company}</dd>
                      </div>
                    ) : null}
                    {p.subtitle ? (
                      <div className="rounded-xl border border-border-light bg-surface-body/40 px-3 py-2.5 sm:col-span-2">
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-text-secondary">Contact name</dt>
                        <dd className="mt-0.5 text-sm font-medium text-text-primary">{p.subtitle}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {companyMembers.length > 0 ? (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Company members</h4>
                      <ul className="mt-2 space-y-1.5 rounded-xl border border-border-light bg-white p-3">
                        {companyMembers.map((m) => (
                          <li key={m.id} className="text-sm text-text-primary">
                            {m.contact_name ?? m.name}
                            <span className="text-text-secondary"> · {m.email}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeSection === "permissions" ? (
                <div>
                  <p className="text-xs text-text-secondary">
                    {permissionsLabel(effective.source, effective.company)}
                    {p.isCompanyMember ? " — edit the company to change these for all members." : ""}
                  </p>
                  <div className="mt-3 rounded-xl border border-border-light bg-surface-body/40 p-3">
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
                      onClick={() => void savePermissions()}
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
              ) : null}

              {activeSection === "projects" ? (
                access.length === 0 ? (
                  <p className="text-sm text-text-secondary">No project access listed for this contact yet.</p>
                ) : (
                  <ul className="space-y-4">
                    {access.map((row) => {
                      const roleSeg = segmentFromRoleLabel(row.role_on_project);
                      return (
                        <li
                          key={`${p.id}-${row.project_id}`}
                          className="rounded-xl border border-border-light bg-surface-card p-4 shadow-sm"
                        >
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
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                                  {g.title}
                                </p>
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
                )
              ) : null}

              {activeSection === "workspace" ? (
                <div className="space-y-4">
                  {canMoveSegment && moveSegmentTarget ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
                      <p className="text-sm font-semibold text-amber-950">Wrong directory tab?</p>
                      {isTeamView ? (
                        <p className="mt-1 text-xs text-amber-900/90">
                          You&apos;re viewing{" "}
                          <span className="font-semibold">{viewedWorkspaceName}</span>. This will
                          switch to your workspace and move the matching contact by email.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-amber-900/90">
                          Move from{" "}
                          <span className="font-semibold">{segmentLabel(p.segment)}</span> to{" "}
                          <span className="font-semibold">{segmentLabel(moveSegmentTarget)}</span>{" "}
                          — email and details are kept.
                        </p>
                      )}
                      {segmentError ? (
                        <p className="mt-2 text-xs font-medium text-red-600" role="alert">
                          {segmentError}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={convertingSegment}
                        onClick={() => void handleMoveSegment(moveSegmentTarget)}
                        className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-accent shadow-sm ring-1 ring-amber-200 hover:bg-amber-50 disabled:opacity-50"
                      >
                        {convertingSegment
                          ? "Moving…"
                          : isTeamView
                            ? `Switch to my workspace & move to ${segmentLabel(moveSegmentTarget)}`
                            : moveSegmentTarget === "client"
                              ? "Move to Clients"
                              : "Move to Vendors"}
                      </button>
                    </div>
                  ) : null}
                  {membershipId != null && isClientLiveBackend() ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3">
                      <p className="text-sm font-semibold text-emerald-900">App account linked</p>
                      <p className="mt-1 text-xs text-emerald-800">
                        This contact joined your workspace with the email above. Revoke if the wrong person claimed
                        the profile.
                      </p>
                      <button
                        type="button"
                        disabled={revoking}
                        onClick={() => void revokeLinkedAccess()}
                        className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {revoking ? "Revoking…" : "Revoke access"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {deleteError ? (
              <p className="shrink-0 border-t border-border-light px-5 py-2 text-sm font-semibold text-red-600">
                {deleteError}
              </p>
            ) : null}
            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border-light px-5 py-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  clearDeleteError();
                  void handleDelete(contact);
                }}
                className="rounded-xl px-2 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : deleteLabel}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={openEdit}
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
                >
                  {editLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
