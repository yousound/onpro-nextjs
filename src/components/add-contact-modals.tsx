"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/components/profile-provider";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  commitClientWithMembers,
  commitSingleContact,
} from "@/lib/data/commit-contacts";
import { useDeleteContact } from "@/lib/use-delete-contact";
import { InlineFieldMessage } from "@/components/inline-field-message";
import {
  clientContactFormCanSubmit,
  isClientEmailWarning,
  validateClientContactFields,
  validateDirectoryCompanyCode,
} from "@/lib/contact-field-validation";
import type { Contact, ContactKind, PeopleSegment, TeamRole } from "@/lib/types/contact";
import { BUSINESS_STRUCTURE_OPTIONS, deriveCompanyCode } from "@/lib/types/contact";
import type { PendingInvite } from "@/lib/mock/people";
import { buildPendingInvite } from "@/lib/people-invite";
import { defaultPermissionsForSegment, type ProjectPermissionFlags } from "@/lib/project-permissions";
import { PermissionsEditor } from "@/components/permissions-editor";
import {
  AddressFields,
  AvatarUpload,
  FileUploadList,
  KindToggle,
  OtherEmailsInput,
} from "@/components/contact-form-fields";
import {
  contactDisplayName,
  findContactByEmail,
  findContactByEmailInSegment,
  loadContacts,
  newContactId,
} from "@/lib/contacts-store";
import { memberDraftsFromCompany, type CompanyMemberDraft } from "@/lib/company-members";
import { CompanyMembersEditor } from "@/components/company-members-editor";
import {
  ModalSectionLayout,
  ModalSectionNavList,
  ModalSectionPanel,
  type ModalSectionItem,
} from "@/components/modal-section-layout";
import {
  CheckMini,
  ProjectModalAside,
  ProjectModalBadge,
  ProjectModalOverlay,
  ProjectModalPanelFooter,
  ProjectModalPanelHeader,
  UserIcon,
  projectModalFieldClass,
  projectModalLabelClass,
} from "@/components/project-modal-ui";

type ClientModalProps = {
  onClose: () => void;
  /** Receives the persisted row so callers can select it in dropdowns. */
  onSaved: (saved?: Contact) => void;
  existing?: Contact | null;
  onInviteSent?: (invite: PendingInvite, loginUrl?: string) => void;
};

async function dispatchWorkspaceInvite(params: {
  contactId: string;
  email: string;
  segment: PeopleSegment;
  note?: string;
  clientCompanyName?: string;
  permissions?: ProjectPermissionFlags;
  teamRole?: TeamRole;
  teamRoleCustom?: string;
  contactName?: string;
  phone?: string;
}): Promise<{ invite: PendingInvite; loginUrl?: string }> {
  if (isClientLiveBackend()) {
    const numericId = Number(params.contactId);
    if (!Number.isFinite(numericId)) {
      throw new Error("Save the contact before sending an invite.");
    }
    const redirectAfter = "/";
    const res = await fetch("/api/invites/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact_id: numericId,
        email: params.email,
        segment: params.segment,
        invited_label: params.note,
        permissions: params.permissions,
        redirect_after: redirectAfter,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      loginUrl?: string;
      invite?: { id: string; email: string; segment: PeopleSegment; invitedLabel?: string; createdAt?: string };
    };
    if (!res.ok) throw new Error(data.error ?? "Could not create invite");
    const inv = data.invite!;
    return {
      invite: {
        id: inv.id,
        email: inv.email,
        segment: inv.segment,
        invited_label: inv.invitedLabel ?? params.note ?? `${params.segment} invite`,
        sent_at: inv.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      },
      loginUrl: data.loginUrl,
    };
  }

  return {
    invite: buildPendingInvite({
      email: params.email,
      segment: params.segment,
      note: params.note,
      clientCompanyName: params.clientCompanyName,
      teamRole: params.teamRole,
      teamRoleCustom: params.teamRoleCustom,
      contactName: params.contactName,
      phone: params.phone,
    }),
  };
}

const CLIENT_MODAL_SECTIONS: ModalSectionItem[] = [
  { id: "profile", label: "Profile" },
  { id: "addresses", label: "Addresses & docs" },
  { id: "members", label: "Company members" },
  { id: "permissions", label: "Permissions" },
  { id: "invite", label: "Invite" },
];

const POLISHED_FIELD_CLASS = projectModalFieldClass;
const POLISHED_LABEL_CLASS = projectModalLabelClass;

const CLIENT_SECTION_SUBTITLES: Record<string, string> = {
  profile: "Company or individual — name, code, and contact details.",
  addresses: "Billing, shipping, and sell permits or certificates.",
  members: "People who belong to this client company.",
  permissions: "Default workspace access for this client.",
  invite: "Optionally queue a workspace invite email.",
};

const TEAM_SECTION_SUBTITLES: Record<string, string> = {
  profile: "Name, email, role, and avatar for your internal team.",
  permissions: "Default workspace access for this teammate.",
  invite: "Optionally queue a workspace invite email.",
};

const VENDOR_SECTION_SUBTITLES: Record<string, string> = {
  profile: "Vendor company and primary contact details.",
  documents: "Certificates, contracts, and other vendor files.",
  permissions: "Default workspace access for this vendor.",
  invite: "Optionally queue a workspace invite email.",
};

function VendorBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M3 10h18v10H3V10zm2 2v6h14v-6H5zm-1-4h16l2 4H2l2-4zm5 8h2v2H8v-2z" />
    </svg>
  );
}

export function AddClientModal({ onClose, onSaved, existing, onInviteSent }: ClientModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { deleting, deleteError, clearDeleteError, handleDelete } = useDeleteContact({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const [activeSection, setActiveSection] = useState("profile");
  const [allContacts, setAllContacts] = useState<Contact[]>(() => loadContacts());
  const [kind, setKind] = useState<ContactKind>(existing?.kind ?? "company");
  const [name, setName] = useState(existing?.name ?? "");
  const [contactName, setContactName] = useState(existing?.contact_name ?? "");
  const [companyCode, setCompanyCode] = useState(existing?.company_code ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [otherEmails, setOtherEmails] = useState<string[]>(existing?.other_emails ?? []);
  const [billing, setBilling] = useState(existing?.billing_address ?? {});
  const [shipping, setShipping] = useState(existing?.shipping_address ?? {});
  const [sellPermits, setSellPermits] = useState(existing?.sell_permits ?? []);
  const [sellCert, setSellCert] = useState(existing?.sell_certificate ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existing?.avatar_url ?? null);
  const [members, setMembers] = useState<CompanyMemberDraft[]>(() =>
    existing?.kind === "company" ? memberDraftsFromCompany(loadContacts(), existing) : [],
  );
  const [sendInvite, setSendInvite] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [permissions, setPermissions] = useState<ProjectPermissionFlags>(() =>
    existing?.permissions ?? defaultPermissionsForSegment("client"),
  );
  const [error, setError] = useState<string | null>(null);

  const visibleSections = useMemo(() => {
    let sections = CLIENT_MODAL_SECTIONS;
    if (kind !== "company") {
      sections = sections.filter((s) => s.id !== "members");
    }
    if (!onInviteSent) {
      sections = sections.filter((s) => s.id !== "invite");
    }
    return sections;
  }, [kind, onInviteSent]);

  useEffect(() => {
    if (!visibleSections.some((s) => s.id === activeSection)) {
      setActiveSection("profile");
    }
  }, [visibleSections, activeSection]);

  useEffect(() => {
    setAllContacts(loadContacts());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (kind === "individual" && !existing) {
      setCompanyCode(deriveCompanyCode(name || contactName || "XX"));
    }
  }, [kind, name, contactName, existing]);

  const clientFieldMessages = useMemo(
    () =>
      validateClientContactFields(loadContacts(), {
        kind,
        name,
        email,
        companyCode,
        excludeContactId: existing?.id,
      }),
    [kind, name, email, companyCode, existing?.id],
  );

  const canSaveClient = clientContactFormCanSubmit(clientFieldMessages, {
    name,
    email,
    companyCode,
  });

  const companyId = existing?.id ?? "draft-company";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contacts = loadContacts();
    const byEmail = findContactByEmail(contacts, email);
    const code = companyCode.trim().toUpperCase();
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    const fieldErrors = validateClientContactFields(contacts, {
      kind,
      name,
      email,
      companyCode: code,
      excludeContactId: existing?.id,
    });
    if (fieldErrors.companyCode) {
      setError(fieldErrors.companyCode);
      return;
    }
    if (fieldErrors.email?.includes("already used for")) {
      setError(fieldErrors.email);
      return;
    }
    const now = new Date().toISOString();
    const companyIdFinal = existing?.id ?? byEmail?.id ?? newContactId();
    const companyPayload: Contact = {
      id: companyIdFinal,
      segment: "client",
      kind,
      company_code: code,
      name: name.trim(),
      contact_name: kind === "company" ? contactName.trim() || undefined : undefined,
      email: email.trim(),
      phone: phone.trim() || undefined,
      other_emails: otherEmails,
      billing_address: billing,
      shipping_address: shipping,
      sell_permits: sellPermits,
      sell_certificate: sellCert,
      avatar_url: avatarUrl,
      member_contact_ids: [],
      permissions: kind === "company" || kind === "individual" ? permissions : undefined,
      created_at: existing?.created_at ?? byEmail?.created_at ?? now,
      updated_at: now,
    };

    setSaving(true);
    setError(null);
    try {
      let resolvedContactId = companyIdFinal;
      if (kind === "company") {
        await commitClientWithMembers(contacts, companyPayload, members);
        const nextContacts = loadContacts();
        const savedRow =
          nextContacts.find((c) => c.id === companyIdFinal) ??
          nextContacts.find(
            (c) =>
              c.segment === "client" &&
              c.email.trim().toLowerCase() === email.trim().toLowerCase(),
          );
        resolvedContactId = savedRow?.id ?? companyIdFinal;
      } else {
        const saved = await commitSingleContact(companyPayload);
        resolvedContactId = saved.id;
      }
      if (sendInvite && email.trim() && onInviteSent) {
        const { invite, loginUrl } = await dispatchWorkspaceInvite({
          contactId: resolvedContactId,
          email: email.trim(),
          segment: "client",
          note: inviteNote,
          clientCompanyName: name.trim(),
          permissions,
        });
        onInviteSent(invite, loginUrl);
      }
      onSaved();
      if (isClientLiveBackend()) router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save client");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProjectModalOverlay
      titleId="add-client-title"
      onClose={onClose}
      overlayClassName="z-[225]"
      size="wide"
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <UserIcon />
            </ProjectModalBadge>
          }
          title={
            existing ? (
              <>Update your<br />client profile.</>
            ) : (
              <>
                Add a client
                <br />
                to People.
              </>
            )
          }
          body="Save companies or individuals to your directory — set permissions per project under People & access."
          nav={
            <ModalSectionNavList
              sections={visibleSections}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              navLabel="Client sections"
              variant="polished"
              tone="aside"
            />
          }
        />
      }
    >
      <ProjectModalPanelHeader
        title={existing ? "Update client" : "Add client"}
        subtitle={CLIENT_SECTION_SUBTITLES[activeSection] ?? "Client directory profile."}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalSectionLayout
          sections={visibleSections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          navLabel="Client sections"
          variant="polished"
          sidebar="none"
        >
          <ModalSectionPanel sectionId="profile" activeSection={activeSection}>
            <KindToggle kind={kind} onChange={setKind} />
            <AvatarUpload
              avatarUrl={avatarUrl}
              onChange={setAvatarUrl}
              fallbackInitials={(name || contactName || "?").slice(0, 2).toUpperCase()}
            />
            <label className={POLISHED_LABEL_CLASS}>
              {kind === "company" ? "Company name" : "Name"}
              <input className={POLISHED_FIELD_CLASS} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            {kind === "company" ? (
              <label className={POLISHED_LABEL_CLASS}>
                Contact name
                <input className={POLISHED_FIELD_CLASS} value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </label>
            ) : null}
            <label className={POLISHED_LABEL_CLASS}>
              Company code (2–3 chars)
              <input
                className={POLISHED_FIELD_CLASS}
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
                required
                aria-invalid={Boolean(clientFieldMessages.companyCode)}
              />
              <InlineFieldMessage message={clientFieldMessages.companyCode} />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Email
              <input
                type="email"
                className={POLISHED_FIELD_CLASS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-invalid={Boolean(
                  clientFieldMessages.email?.includes("already used for"),
                )}
              />
              <InlineFieldMessage
                message={clientFieldMessages.email}
                tone={isClientEmailWarning(clientFieldMessages) ? "warning" : "error"}
              />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Phone
              <input className={POLISHED_FIELD_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <OtherEmailsInput emails={otherEmails} onChange={setOtherEmails} />
          </ModalSectionPanel>

          <ModalSectionPanel sectionId="addresses" activeSection={activeSection}>
            <AddressFields title="Billing address" value={billing} onChange={setBilling} />
            <AddressFields title="Shipping address" value={shipping} onChange={setShipping} />
            <FileUploadList label="Sell permits" files={sellPermits} onChange={setSellPermits} />
            <FileUploadList label="Sell certificate" files={sellCert} onChange={setSellCert} />
          </ModalSectionPanel>

          {kind === "company" ? (
            <ModalSectionPanel sectionId="members" activeSection={activeSection}>
              <CompanyMembersEditor
                contacts={allContacts}
                companyId={companyId === "draft-company" ? undefined : companyId}
                members={members}
                onChange={setMembers}
              />
            </ModalSectionPanel>
          ) : null}

          <ModalSectionPanel sectionId="permissions" activeSection={activeSection}>
            <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">
                {kind === "company" ? "Company permissions" : "Contact permissions"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {kind === "company"
                  ? "All people at this company inherit these permissions. Adjust per project under each project's People & access tab."
                  : "Workspace permissions for this contact. Per-project access is set on each project."}
              </p>
              <div className="mt-3 max-h-[min(360px,50vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                <PermissionsEditor segment="client" flags={permissions} onChange={setPermissions} dense />
              </div>
            </fieldset>
          </ModalSectionPanel>

          {onInviteSent ? (
            <ModalSectionPanel sectionId="invite" activeSection={activeSection}>
              <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-[#7c3aed] focus:ring-[#7c3aed]"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-semibold text-slate-900">Send workspace invite email</span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Optional — queues an invitation email. Set their access on each project under People &amp; access.
                    </span>
                  </span>
                </label>
                {sendInvite ? (
                  <label className={`${POLISHED_LABEL_CLASS} mt-4 block border-t border-slate-200 pt-4`}>
                    Invite label <span className="font-normal normal-case text-slate-500">(optional)</span>
                    <input
                      className={POLISHED_FIELD_CLASS}
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      placeholder={`Client · ${name.trim() || "Company name"}`}
                    />
                  </label>
                ) : null}
              </fieldset>
            </ModalSectionPanel>
          ) : null}

          {error || deleteError ? (
            <p className="text-sm font-semibold text-red-600">{error ?? deleteError}</p>
          ) : null}
        </ModalSectionLayout>
        <ProjectModalPanelFooter
          deleteLabel={existing ? "Delete client" : undefined}
          onDelete={
            existing
              ? () => {
                  clearDeleteError();
                  void handleDelete(existing);
                }
              : undefined
          }
          deleteDisabled={saving || deleting}
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel={
            saving
              ? "Saving…"
              : deleting
                ? "Deleting…"
                : sendInvite && onInviteSent
                  ? "Save & send invite"
                  : existing
                    ? "Update client"
                    : "Save client"
          }
          primaryIcon={saving || deleting ? undefined : <CheckMini />}
          primaryDisabled={saving || deleting || !canSaveClient}
        />
      </form>
    </ProjectModalOverlay>
  );
}

type TeamModalProps = {
  onClose: () => void;
  onSaved: (saved?: Contact) => void;
  existing?: Contact | null;
  onInviteSent?: (invite: PendingInvite, loginUrl?: string) => void;
};

const TEAM_MODAL_SECTIONS: ModalSectionItem[] = [
  { id: "profile", label: "Profile" },
  { id: "permissions", label: "Permissions" },
  { id: "invite", label: "Invite" },
];

export function AddTeamMemberModal({ onClose, onSaved, existing, onInviteSent }: TeamModalProps) {
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();
  const operatorCompany = currentUser?.companyName?.trim() || undefined;
  const [saving, setSaving] = useState(false);
  const { deleting, deleteError, clearDeleteError, handleDelete } = useDeleteContact({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const [activeSection, setActiveSection] = useState("profile");
  const [name, setName] = useState(existing?.contact_name ?? existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [teamRole, setTeamRole] = useState<TeamRole>(existing?.team_role ?? "staff");
  const [teamRoleCustom, setTeamRoleCustom] = useState(existing?.team_role_custom ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existing?.avatar_url ?? null);
  const [permissions, setPermissions] = useState<ProjectPermissionFlags>(() =>
    existing?.permissions ?? defaultPermissionsForSegment("team"),
  );
  const [sendInvite, setSendInvite] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visibleSections = onInviteSent
    ? TEAM_MODAL_SECTIONS
    : TEAM_MODAL_SECTIONS.filter((s) => s.id !== "invite");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contacts = loadContacts();
    const emailNorm = email.trim().toLowerCase();
    const otherSegment = contacts.find(
      (c) =>
        c.email.toLowerCase() === emailNorm &&
        c.segment !== "team" &&
        c.id !== existing?.id,
    );
    if (otherSegment) {
      setError(
        `This email is already used as a ${otherSegment.segment} contact. Use a different email or edit that contact.`,
      );
      return;
    }
    const byEmail = existing
      ? undefined
      : findContactByEmailInSegment(contacts, email, "team");
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    const now = new Date().toISOString();
    const payload: Contact = {
      id: existing?.id ?? byEmail?.id ?? newContactId(),
      segment: "team",
      kind: "individual",
      company_code: existing?.company_code ?? deriveCompanyCode(name),
      name: name.trim(),
      contact_name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      team_role: teamRole,
      team_role_custom: teamRole === "custom" ? teamRoleCustom.trim() || undefined : undefined,
      company_name: existing?.company_name ?? operatorCompany,
      avatar_url: avatarUrl,
      permissions,
      member_contact_ids: [],
      created_at: existing?.created_at ?? byEmail?.created_at ?? now,
      updated_at: now,
    };

    setSaving(true);
    setError(null);
    try {
      const saved = await commitSingleContact(payload);
      if (sendInvite && email.trim() && onInviteSent) {
        const { invite, loginUrl } = await dispatchWorkspaceInvite({
          contactId: saved.id,
          email: email.trim(),
          segment: "team",
          note: inviteNote,
          permissions,
          teamRole,
          teamRoleCustom,
          contactName: name.trim(),
          phone: phone.trim() || undefined,
        });
        onInviteSent(invite, loginUrl);
      }
      onSaved(saved);
      if (isClientLiveBackend()) router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save teammate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProjectModalOverlay
      titleId="add-teammate-title"
      onClose={onClose}
      overlayClassName="z-[225]"
      size="wide"
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <UserIcon />
            </ProjectModalBadge>
          }
          title={
            existing ? (
              <>
                Update your
                <br />
                teammate.
              </>
            ) : (
              <>
                Add a teammate
                <br />
                to Contacts.
              </>
            )
          }
          body="Internal operators with roles and permissions — assign them to projects from each project's Internal tab."
          nav={
            <ModalSectionNavList
              sections={visibleSections}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              navLabel="Teammate sections"
              variant="polished"
              tone="aside"
            />
          }
        />
      }
    >
      <ProjectModalPanelHeader
        title={existing ? "Update teammate" : "Add teammate"}
        subtitle={TEAM_SECTION_SUBTITLES[activeSection] ?? "Team directory profile."}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalSectionLayout
          sections={visibleSections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          navLabel="Teammate sections"
          variant="polished"
          sidebar="none"
        >
          <ModalSectionPanel sectionId="profile" activeSection={activeSection}>
            <AvatarUpload avatarUrl={avatarUrl} onChange={setAvatarUrl} fallbackInitials={name.slice(0, 2).toUpperCase() || "T"} />
            <label className={POLISHED_LABEL_CLASS}>
              Name
              <input className={POLISHED_FIELD_CLASS} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Email
              <input type="email" className={POLISHED_FIELD_CLASS} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Phone
              <input className={POLISHED_FIELD_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Team role
              <select className={POLISHED_FIELD_CLASS} value={teamRole} onChange={(e) => setTeamRole(e.target.value as TeamRole)}>
                {TEAM_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            {teamRole === "custom" ? (
              <label className={POLISHED_LABEL_CLASS}>
                Custom role label
                <input className={POLISHED_FIELD_CLASS} value={teamRoleCustom} onChange={(e) => setTeamRoleCustom(e.target.value)} />
              </label>
            ) : null}
          </ModalSectionPanel>

          <ModalSectionPanel sectionId="permissions" activeSection={activeSection}>
            <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Contact permissions</p>
              <p className="mt-1 text-xs text-slate-500">
                Workspace permissions for this teammate. Per-project access is set on each project.
              </p>
              <div className="mt-3 max-h-[min(360px,50vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                <PermissionsEditor segment="team" flags={permissions} onChange={setPermissions} dense />
              </div>
            </fieldset>
          </ModalSectionPanel>

          {onInviteSent ? (
            <ModalSectionPanel sectionId="invite" activeSection={activeSection}>
              <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-[#7c3aed] focus:ring-[#7c3aed]"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-semibold text-slate-900">Send workspace invite email</span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Optional — queues an invitation email. Permissions are saved on this contact profile.
                    </span>
                  </span>
                </label>
                {sendInvite ? (
                  <label className={`${POLISHED_LABEL_CLASS} mt-4 block border-t border-slate-200 pt-4`}>
                    Invite label <span className="font-normal normal-case text-slate-500">(optional)</span>
                    <input
                      className={POLISHED_FIELD_CLASS}
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      placeholder={`Team · ${name.trim() || "Name"}`}
                    />
                  </label>
                ) : null}
              </fieldset>
            </ModalSectionPanel>
          ) : null}

          {error || deleteError ? (
            <p className="text-sm font-semibold text-red-600">{error ?? deleteError}</p>
          ) : null}
        </ModalSectionLayout>
        <ProjectModalPanelFooter
          deleteLabel={existing ? "Delete teammate" : undefined}
          onDelete={
            existing
              ? () => {
                  clearDeleteError();
                  void handleDelete(existing);
                }
              : undefined
          }
          deleteDisabled={saving || deleting}
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel={
            saving
              ? "Saving…"
              : deleting
                ? "Deleting…"
                : sendInvite && onInviteSent
                  ? "Save & send invite"
                  : existing
                    ? "Update teammate"
                    : "Save teammate"
          }
          primaryIcon={saving || deleting ? undefined : <CheckMini />}
          primaryDisabled={saving || deleting}
        />
      </form>
    </ProjectModalOverlay>
  );
}

const VENDOR_MODAL_SECTIONS: ModalSectionItem[] = [
  { id: "profile", label: "Profile" },
  { id: "documents", label: "Documents" },
  { id: "permissions", label: "Permissions" },
  { id: "invite", label: "Invite" },
];

export function AddVendorModal({ onClose, onSaved, existing, onInviteSent }: ClientModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { deleting, deleteError, clearDeleteError, handleDelete } = useDeleteContact({
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const [activeSection, setActiveSection] = useState("profile");
  const [name, setName] = useState(existing?.name ?? "");
  const [contactName, setContactName] = useState(existing?.contact_name ?? "");
  const [companyCode, setCompanyCode] = useState(
    existing?.company_code ?? deriveCompanyCode(existing?.name ?? ""),
  );
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [businessStructure, setBusinessStructure] = useState(existing?.business_structure ?? "");
  const [documents, setDocuments] = useState(existing?.documents ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existing?.avatar_url ?? null);
  const [permissions, setPermissions] = useState<ProjectPermissionFlags>(() =>
    existing?.permissions ?? defaultPermissionsForSegment("vendor"),
  );
  const [sendInvite, setSendInvite] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visibleSections = onInviteSent
    ? VENDOR_MODAL_SECTIONS
    : VENDOR_MODAL_SECTIONS.filter((s) => s.id !== "invite");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!existing) {
      setCompanyCode(deriveCompanyCode(name || "XX"));
    }
  }, [name, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contacts = loadContacts();
    const byEmail = findContactByEmail(contacts, email);
    if (!name.trim() || !email.trim()) {
      setError("Vendor name and email are required.");
      return;
    }
    const code = companyCode.trim().toUpperCase();
    const codeErr = validateDirectoryCompanyCode(contacts, code, existing?.id);
    if (codeErr) {
      setError(codeErr);
      return;
    }
    const now = new Date().toISOString();
    const payload: Contact = {
      id: existing?.id ?? byEmail?.id ?? newContactId(),
      segment: "vendor",
      kind: "company",
      company_code: code,
      name: name.trim(),
      contact_name: contactName.trim() || undefined,
      email: email.trim(),
      phone: phone.trim() || undefined,
      business_structure: businessStructure || undefined,
      documents,
      avatar_url: avatarUrl,
      permissions,
      created_at: existing?.created_at ?? byEmail?.created_at ?? now,
      updated_at: now,
    };

    setSaving(true);
    setError(null);
    try {
      const saved = await commitSingleContact(payload);
      if (sendInvite && email.trim() && onInviteSent) {
        const { invite, loginUrl } = await dispatchWorkspaceInvite({
          contactId: saved.id,
          email: email.trim(),
          segment: "vendor",
          note: inviteNote,
          clientCompanyName: name.trim(),
          permissions,
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        onInviteSent(invite, loginUrl);
      }
      onSaved(saved);
      if (isClientLiveBackend()) router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save vendor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProjectModalOverlay
      titleId="add-vendor-title"
      onClose={onClose}
      overlayClassName="z-[225]"
      size="wide"
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <VendorBadgeIcon />
            </ProjectModalBadge>
          }
          title={
            existing ? (
              <>
                Update your
                <br />
                vendor profile.
              </>
            ) : (
              <>
                Add a vendor
                <br />
                to People.
              </>
            )
          }
          body="Factories, decorators, and suppliers — store contacts, documents, and permissions in one place."
          nav={
            <ModalSectionNavList
              sections={visibleSections}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              navLabel="Vendor sections"
              variant="polished"
              tone="aside"
            />
          }
        />
      }
    >
      <ProjectModalPanelHeader
        title={existing ? "Update vendor" : "Add vendor"}
        subtitle={VENDOR_SECTION_SUBTITLES[activeSection] ?? "Vendor directory profile."}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalSectionLayout
          sections={visibleSections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          navLabel="Vendor sections"
          variant="polished"
          sidebar="none"
        >
          <ModalSectionPanel sectionId="profile" activeSection={activeSection}>
            <AvatarUpload avatarUrl={avatarUrl} onChange={setAvatarUrl} fallbackInitials={name.slice(0, 2).toUpperCase() || "V"} />
            <label className={POLISHED_LABEL_CLASS}>
              Vendor name
              <input className={POLISHED_FIELD_CLASS} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Contact name
              <input className={POLISHED_FIELD_CLASS} value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Company code (2–3 chars)
              <input
                className={POLISHED_FIELD_CLASS}
                value={companyCode}
                onChange={(e) => setCompanyCode(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
                required
              />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Business structure
              <select className={POLISHED_FIELD_CLASS} value={businessStructure} onChange={(e) => setBusinessStructure(e.target.value)}>
                <option value="">Select…</option>
                {BUSINESS_STRUCTURE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Email
              <input type="email" className={POLISHED_FIELD_CLASS} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className={POLISHED_LABEL_CLASS}>
              Phone
              <input className={POLISHED_FIELD_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </ModalSectionPanel>

          <ModalSectionPanel sectionId="documents" activeSection={activeSection}>
            <FileUploadList label="Documents" files={documents} onChange={setDocuments} />
          </ModalSectionPanel>

          <ModalSectionPanel sectionId="permissions" activeSection={activeSection}>
            <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Company permissions</p>
              <p className="mt-1 text-xs text-slate-500">
                People at this vendor inherit these permissions. Per-project access is set on each project.
              </p>
              <div className="mt-3 max-h-[min(360px,50vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                <PermissionsEditor segment="vendor" flags={permissions} onChange={setPermissions} dense />
              </div>
            </fieldset>
          </ModalSectionPanel>

          {onInviteSent ? (
            <ModalSectionPanel sectionId="invite" activeSection={activeSection}>
              <fieldset className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-[#7c3aed] focus:ring-[#7c3aed]"
                    checked={sendInvite}
                    onChange={(e) => setSendInvite(e.target.checked)}
                  />
                  <span>
                    <span className="text-sm font-semibold text-slate-900">Send workspace invite email</span>
                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                      Optional — queues an invitation email. Permissions are saved on this vendor profile.
                    </span>
                  </span>
                </label>
                {sendInvite ? (
                  <label className={`${POLISHED_LABEL_CLASS} mt-4 block border-t border-slate-200 pt-4`}>
                    Invite label <span className="font-normal normal-case text-slate-500">(optional)</span>
                    <input
                      className={POLISHED_FIELD_CLASS}
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      placeholder={`Vendor · ${name.trim() || "Company name"}`}
                    />
                  </label>
                ) : null}
              </fieldset>
            </ModalSectionPanel>
          ) : null}

          {error || deleteError ? (
            <p className="text-sm font-semibold text-red-600">{error ?? deleteError}</p>
          ) : null}
        </ModalSectionLayout>
        <ProjectModalPanelFooter
          deleteLabel={existing ? "Delete vendor" : undefined}
          onDelete={
            existing
              ? () => {
                  clearDeleteError();
                  void handleDelete(existing);
                }
              : undefined
          }
          deleteDisabled={saving || deleting}
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel={
            saving
              ? "Saving…"
              : deleting
                ? "Deleting…"
                : sendInvite && onInviteSent
                  ? "Save & send invite"
                  : existing
                    ? "Update vendor"
                    : "Save vendor"
          }
          primaryIcon={saving || deleting ? undefined : <CheckMini />}
          primaryDisabled={saving || deleting}
        />
      </form>
    </ProjectModalOverlay>
  );
}

export const TEAM_ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
  { value: "temp", label: "Temp" },
  { value: "custom", label: "Custom" },
];

function peopleForClientCompany(c: Contact, contacts: Contact[]): string[] {
  const names: string[] = [];
  if (c.contact_name?.trim()) names.push(c.contact_name.trim());
  for (const id of c.member_contact_ids ?? []) {
    const m = contacts.find((x) => x.id === id);
    if (!m) continue;
    const n = m.contact_name ?? m.name;
    if (!names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  }
  return names;
}

export function contactToDirectoryRow(c: Contact, contacts: Contact[] = []) {
  const parentCompany = c.parent_company_id
    ? contacts.find((x) => x.id === c.parent_company_id)
    : undefined;
  const isClientCompany = c.segment === "client" && c.kind === "company";
  const isClientIndividual = c.segment === "client" && c.kind === "individual" && !c.parent_company_id;
  const isClientMember = c.segment === "client" && Boolean(c.parent_company_id);

  const clientPeople = isClientCompany
    ? peopleForClientCompany(c, contacts)
    : isClientIndividual
      ? [c.contact_name ?? c.name]
      : isClientMember
        ? [c.contact_name ?? c.name]
        : [];

  const clientCompanyName = isClientCompany
    ? c.name
    : isClientIndividual
      ? null
      : isClientMember
        ? (parentCompany?.name ?? null)
        : null;

  const clientCompanyCode = isClientCompany || isClientIndividual ? c.company_code : parentCompany?.company_code;

  const displayName = isClientCompany
    ? c.name
    : isClientMember
      ? (parentCompany?.name ?? c.name)
      : c.kind === "company"
        ? c.name
        : (c.contact_name ?? c.name);

  const subtitle =
    !isClientCompany && !isClientIndividual && c.contact_name?.trim() ? c.contact_name.trim() : undefined;

  const memberCount = c.member_contact_ids?.length ?? 0;
  const companyLabel = isClientCompany || isClientIndividual
    ? null
    : c.segment === "team"
      ? (c.company_name?.trim() || null)
      : c.kind === "company"
        ? `${c.company_code}${memberCount > 0 ? ` · ${memberCount} members` : ""}`
        : (c.company_name?.trim() || parentCompany?.name || null);

  return {
    id: c.id,
    segment: c.segment as PeopleSegment,
    name: displayName,
    subtitle,
    clientCompanyName,
    clientCompanyCode,
    clientPeople,
    email: c.email,
    company: companyLabel,
    phone: c.phone,
    notes: c.notes,
    contact: c,
    isCompany: c.kind === "company",
    isCompanyMember: Boolean(c.parent_company_id),
  };
}
