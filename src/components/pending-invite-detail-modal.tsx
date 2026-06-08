"use client";

import { useEffect, useMemo, useState } from "react";
import {
  segmentBadgeSoftClass,
  segmentLabel,
  type PendingInvite,
  type PeopleSegment,
} from "@/lib/mock/people";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import { formatShortDate } from "@/lib/format";
import { teamRoleLabel } from "@/lib/types/contact";
import { PermissionsEditor } from "@/components/permissions-editor";
import {
  ModalSectionLayout,
  ModalSectionNavList,
  ModalSectionPanel,
  type ModalSectionItem,
} from "@/components/modal-section-layout";
import {
  ProjectModalAside,
  ProjectModalBadge,
  ProjectModalOverlay,
  ProjectModalPanelFooter,
  ProjectModalPanelHeader,
  UserIcon,
  projectModalFieldClass,
  projectModalLabelClass,
} from "@/components/project-modal-ui";

const INVITE_SECTIONS: ModalSectionItem[] = [
  { id: "overview", label: "Overview" },
  { id: "permissions", label: "Permissions" },
  { id: "next", label: "After accept" },
];

const SECTION_SUBTITLES: Record<string, string> = {
  overview: "Who was invited, when, and how they’re labeled in the queue.",
  permissions: "Workspace access they’ll receive when the invite is accepted.",
  next: "What happens in People and on each project after they join.",
};

function segmentAsideBody(segment: PeopleSegment): string {
  switch (segment) {
    case "team":
      return "Workspace invite queued — role and permissions apply when they accept and sign in.";
    case "vendor":
      return "Vendor invite — profile, documents, and access are managed under People after accept.";
    default:
      return "Client invite — directory profile first; per-project access is set under People & access.";
  }
}

function VendorBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M3 10h18v10H3V10zm2 2v6h14v-6H5zm-1-4h16l2 4H2l2-4zm5 8h2v2H8v-2z" />
    </svg>
  );
}

function InviteBadgeIcon({ segment }: { segment: PeopleSegment }) {
  if (segment === "vendor") return <VendorBadgeIcon />;
  return <UserIcon />;
}

type Props = {
  invite: PendingInvite;
  onClose: () => void;
  onDelete: (id: string) => void;
  onCopyInviteLink?: (inviteId: string) => Promise<void>;
};

export function PendingInviteDetailModal({ invite: inv, onClose, onDelete, onCopyInviteLink }: Props) {
  const [activeSection, setActiveSection] = useState("overview");
  const [copyingLink, setCopyingLink] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const permissionFlags = useMemo(
    () => inv.permissions ?? defaultPermissionsForSegment(inv.segment),
    [inv.permissions, inv.segment],
  );

  const sentDisplay = formatShortDate(`${inv.sent_at}T12:00:00`);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleDelete() {
    if (!window.confirm(`Remove the pending invite for ${inv.email}?`)) return;
    onDelete(inv.id);
  }

  return (
    <ProjectModalOverlay
      titleId="pending-invite-title"
      onClose={onClose}
      overlayClassName="z-[223]"
      size="wide"
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <InviteBadgeIcon segment={inv.segment} />
            </ProjectModalBadge>
          }
          title={
            <>
              Pending
              <br />
              invitation.
            </>
          }
          body={segmentAsideBody(inv.segment)}
          nav={
            <ModalSectionNavList
              sections={INVITE_SECTIONS}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              navLabel="Invite sections"
              variant="polished"
              tone="aside"
            />
          }
        />
      }
    >
      <ProjectModalPanelHeader
        title="Manage invite"
        subtitle={SECTION_SUBTITLES[activeSection] ?? inv.invited_label}
        onClose={onClose}
      />

      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <ModalSectionLayout
          sections={INVITE_SECTIONS}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          navLabel="Invite sections"
          variant="polished"
          sidebar="none"
        >
          <ModalSectionPanel sectionId="overview" activeSection={activeSection}>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(inv.segment)}`}
              >
                {segmentLabel(inv.segment)}
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200">
                Queued
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p className={projectModalLabelClass}>Email</p>
              <p className="mt-1 break-all text-base font-semibold text-slate-900">{inv.email}</p>
            </div>

            <label className={projectModalLabelClass}>
              Invite label
              <input
                className={projectModalFieldClass}
                value={inv.invited_label}
                readOnly
                aria-readonly
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={projectModalLabelClass}>
                Sent
                <input className={projectModalFieldClass} value={sentDisplay} readOnly aria-readonly />
              </label>
              <label className={projectModalLabelClass}>
                Storage
                <input
                  className={projectModalFieldClass}
                  value={isClientLiveBackend() ? "Supabase (Live workspace)" : "This browser (mock queue)"}
                  readOnly
                  aria-readonly
                />
              </label>
            </div>

            {inv.segment === "team" && inv.team_role ? (
              <label className={projectModalLabelClass}>
                Team role
                <input
                  className={projectModalFieldClass}
                  value={teamRoleLabel(inv.team_role, inv.team_role_custom)}
                  readOnly
                  aria-readonly
                />
              </label>
            ) : null}

            {inv.contact_name ? (
              <label className={projectModalLabelClass}>
                Contact name
                <input className={projectModalFieldClass} value={inv.contact_name} readOnly aria-readonly />
              </label>
            ) : null}

            {inv.phone ? (
              <label className={projectModalLabelClass}>
                Phone
                <input className={projectModalFieldClass} value={inv.phone} readOnly aria-readonly />
              </label>
            ) : null}
          </ModalSectionPanel>

          <ModalSectionPanel sectionId="permissions" activeSection={activeSection}>
            <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Planned workspace permissions</p>
              <p className="mt-1 text-xs text-slate-500">
                {inv.permissions
                  ? "Custom profile saved with this invite."
                  : `Default ${segmentLabel(inv.segment).toLowerCase()} permissions until a contact profile is created.`}
              </p>
              <div className="mt-3 max-h-[min(360px,50vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                <PermissionsEditor
                  segment={inv.segment}
                  flags={permissionFlags}
                  onChange={() => {}}
                  dense
                  readOnly
                />
              </div>
            </fieldset>
          </ModalSectionPanel>

          <ModalSectionPanel sectionId="next" activeSection={activeSection}>
            <div className="space-y-3 text-sm text-slate-600">
              {isClientLiveBackend() ? (
                <>
                  <p>
                    Copy the invite link and send it by email or Slack. Links expire after 14 days — use{" "}
                    <span className="font-semibold text-slate-900">Resend invite link</span> to refresh expiry.
                  </p>
                  {onCopyInviteLink ? (
                    <button
                      type="button"
                      disabled={copyingLink}
                      onClick={() => {
                        setCopyError(null);
                        setCopyingLink(true);
                        void onCopyInviteLink(inv.id)
                          .catch((e) => {
                            setCopyError(e instanceof Error ? e.message : "Could not copy link");
                          })
                          .finally(() => setCopyingLink(false));
                      }}
                      className="rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-50"
                    >
                      {copyingLink ? "Copying…" : "Resend invite link"}
                    </button>
                  ) : null}
                  {copyError ? <p className="text-sm font-medium text-red-600">{copyError}</p> : null}
                </>
              ) : (
                <p>
                  In mock mode, invites are queued locally. Switch to Live to generate shareable signup links.
                </p>
              )}
              <p>
                When they accept, permissions come from the{" "}
                <span className="font-semibold text-slate-900">contact profile</span> in People, plus each
                project&apos;s <span className="font-semibold text-slate-900">People &amp; access</span> tab.
              </p>
            </div>
          </ModalSectionPanel>
        </ModalSectionLayout>

        <ProjectModalPanelFooter
          deleteLabel="Delete invite"
          onDelete={handleDelete}
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel="Done"
        />
      </form>
    </ProjectModalOverlay>
  );
}
