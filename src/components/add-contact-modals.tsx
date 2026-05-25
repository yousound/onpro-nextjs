"use client";

import { useEffect, useState } from "react";
import type { Contact, ContactKind, PeopleSegment, TeamRole } from "@/lib/types/contact";
import { BUSINESS_STRUCTURE_OPTIONS, deriveCompanyCode } from "@/lib/types/contact";
import type { PendingInvite } from "@/lib/mock/people";
import { buildPendingInvite } from "@/lib/people-invite";
import { defaultPermissionsForSegment, type ProjectPermissionFlags } from "@/lib/project-permissions";
import { PermissionsEditor } from "@/components/permissions-editor";
import {
  AddressFields,
  AvatarUpload,
  fieldClass,
  FileUploadList,
  KindToggle,
  labelClass,
  OtherEmailsInput,
} from "@/components/contact-form-fields";
import {
  contactDisplayName,
  findContactByEmail,
  isCompanyCodeTaken,
  loadContacts,
  newContactId,
  persistCompanyWithMembers,
  saveContacts,
} from "@/lib/contacts-store";
import { memberDraftsFromCompany, type CompanyMemberDraft } from "@/lib/company-members";
import { CompanyMembersEditor } from "@/components/company-members-editor";

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[225] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[2px] sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex max-h-[min(720px,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-border-light"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-light px-5 py-4">
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-secondary hover:bg-surface-body">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type ClientModalProps = {
  onClose: () => void;
  onSaved: () => void;
  existing?: Contact | null;
  onInviteSent?: (invite: PendingInvite) => void;
};

export function AddClientModal({ onClose, onSaved, existing, onInviteSent }: ClientModalProps) {
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

  useEffect(() => {
    setAllContacts(loadContacts());
  }, []);

  useEffect(() => {
    if (kind === "individual" && !existing) {
      setCompanyCode(deriveCompanyCode(name || contactName || "XX"));
    }
  }, [kind, name, contactName, existing]);

  const companyId = existing?.id ?? "draft-company";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contacts = loadContacts();
    const byEmail = findContactByEmail(contacts, email);
    const code = companyCode.trim().toUpperCase();
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (code.length < 2 || code.length > 3) {
      setError("Company code must be 2–3 characters.");
      return;
    }
    if (isCompanyCodeTaken(contacts, code, existing?.id ?? byEmail?.id)) {
      setError("That company code is already in use.");
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

    let next: Contact[];
    if (kind === "company") {
      next = persistCompanyWithMembers(contacts, companyPayload, members);
    } else {
      next =
        byEmail || existing
          ? contacts.map((c) => (c.id === companyPayload.id ? companyPayload : c))
          : [...contacts, companyPayload];
    }
    saveContacts(next);
    if (sendInvite && email.trim() && onInviteSent) {
      onInviteSent(
        buildPendingInvite({
          email: email.trim(),
          segment: "client",
          note: inviteNote,
          clientCompanyName: name.trim(),
        }),
      );
    }
    onSaved();
    onClose();
  }

  return (
    <ModalShell title={existing ? "Update client" : "Add client"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <KindToggle kind={kind} onChange={setKind} />
          <AvatarUpload
            avatarUrl={avatarUrl}
            onChange={setAvatarUrl}
            fallbackInitials={(name || contactName || "?").slice(0, 2).toUpperCase()}
          />
          <label className={labelClass}>
            {kind === "company" ? "Company name" : "Name"}
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {kind === "company" ? (
            <label className={labelClass}>
              Contact name
              <input className={fieldClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
          ) : null}
          <label className={labelClass}>
            Company code (2–3 chars)
            <input
              className={fieldClass}
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
              required
            />
          </label>
          <label className={labelClass}>
            Email
            <input type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className={labelClass}>
            Phone
            <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <OtherEmailsInput emails={otherEmails} onChange={setOtherEmails} />
          <AddressFields title="Billing address" value={billing} onChange={setBilling} />
          <AddressFields title="Shipping address" value={shipping} onChange={setShipping} />
          <FileUploadList label="Sell permits" files={sellPermits} onChange={setSellPermits} />
          <FileUploadList label="Sell certificate" files={sellCert} onChange={setSellCert} />
          {kind === "company" ? (
            <CompanyMembersEditor
              contacts={allContacts}
              companyId={companyId === "draft-company" ? undefined : companyId}
              members={members}
              onChange={setMembers}
            />
          ) : null}

          <fieldset className="rounded-xl border border-border-light bg-surface-body/30 px-3 py-3">
            <p className="text-sm font-semibold text-text-primary">
              {kind === "company" ? "Company permissions" : "Contact permissions"}
            </p>
            <p className="mt-1 text-[11px] text-text-secondary">
              {kind === "company"
                ? "All people at this company inherit these permissions. Adjust per project under each project's People & access tab."
                : "Workspace permissions for this contact. Per-project access is set on each project."}
            </p>
            <div className="mt-3 max-h-[min(240px,34vh)] overflow-y-auto rounded-xl border border-border-light bg-white p-3">
              <PermissionsEditor segment="client" flags={permissions} onChange={setPermissions} dense />
            </div>
          </fieldset>

          {onInviteSent ? (
            <fieldset className="rounded-xl border border-border-light bg-surface-body/30 px-3 py-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-border-light text-accent focus:ring-accent"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                />
                <span>
                  <span className="text-sm font-semibold text-text-primary">Send workspace invite email</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-text-secondary">
                    Optional — queues an invitation email. Set their access on each project under People &amp; access.
                  </span>
                </span>
              </label>
              {sendInvite ? (
                <label className={`${labelClass} mt-4 block border-t border-border-light pt-3`}>
                  Invite label <span className="font-normal normal-case text-text-secondary">(optional)</span>
                  <input
                    className={fieldClass}
                    value={inviteNote}
                    onChange={(e) => setInviteNote(e.target.value)}
                    placeholder={`Client · ${name.trim() || "Company name"}`}
                  />
                </label>
              ) : null}
            </fieldset>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            {sendInvite && onInviteSent ? "Save & send invite" : existing ? "Update client" : "Save client"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

type TeamModalProps = {
  onClose: () => void;
  onSaved: () => void;
  existing?: Contact | null;
  onInviteSent?: (invite: PendingInvite) => void;
};

export function AddTeamMemberModal({ onClose, onSaved, existing, onInviteSent }: TeamModalProps) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contacts = loadContacts();
    const byEmail = findContactByEmail(contacts, email);
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
      avatar_url: avatarUrl,
      permissions,
      member_contact_ids: [],
      created_at: existing?.created_at ?? byEmail?.created_at ?? now,
      updated_at: now,
    };
    const next =
      byEmail || existing ? contacts.map((c) => (c.id === payload.id ? payload : c)) : [...contacts, payload];
    saveContacts(next);
    if (sendInvite && email.trim() && onInviteSent) {
      onInviteSent(
        buildPendingInvite({
          email: email.trim(),
          segment: "team",
          note: inviteNote,
          teamRole,
          teamRoleCustom,
          contactName: name.trim(),
          phone: phone.trim() || undefined,
        }),
      );
    }
    onSaved();
    onClose();
  }

  return (
    <ModalShell title={existing ? "Update teammate" : "Add teammate"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <AvatarUpload avatarUrl={avatarUrl} onChange={setAvatarUrl} fallbackInitials={name.slice(0, 2).toUpperCase() || "T"} />
          <label className={labelClass}>
            Name
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className={labelClass}>
            Email
            <input type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className={labelClass}>
            Phone
            <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className={labelClass}>
            Team role
            <select className={fieldClass} value={teamRole} onChange={(e) => setTeamRole(e.target.value as TeamRole)}>
              {TEAM_ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {teamRole === "custom" ? (
            <label className={labelClass}>
              Custom role label
              <input className={fieldClass} value={teamRoleCustom} onChange={(e) => setTeamRoleCustom(e.target.value)} />
            </label>
          ) : null}
          <fieldset className="rounded-xl border border-border-light bg-surface-body/30 px-3 py-3">
            <p className="text-sm font-semibold text-text-primary">Contact permissions</p>
            <p className="mt-1 text-[11px] text-text-secondary">
              Workspace permissions for this teammate. Per-project access is set on each project.
            </p>
            <div className="mt-3 max-h-[min(240px,34vh)] overflow-y-auto rounded-xl border border-border-light bg-white p-3">
              <PermissionsEditor segment="team" flags={permissions} onChange={setPermissions} dense />
            </div>
          </fieldset>
          {onInviteSent ? (
            <fieldset className="rounded-xl border border-border-light bg-surface-body/30 px-3 py-3">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-border-light text-accent focus:ring-accent"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                />
                <span>
                  <span className="text-sm font-semibold text-text-primary">Send workspace invite email</span>
                  <span className="mt-0.5 block text-[11px] font-normal text-text-secondary">
                    Optional — queues an invitation email. Permissions are saved on this contact profile.
                  </span>
                </span>
              </label>
              {sendInvite ? (
                <label className={`${labelClass} mt-4 block border-t border-border-light pt-3`}>
                  Invite label <span className="font-normal normal-case text-text-secondary">(optional)</span>
                  <input
                    className={fieldClass}
                    value={inviteNote}
                    onChange={(e) => setInviteNote(e.target.value)}
                    placeholder={`Team · ${name.trim() || "Name"}`}
                  />
                </label>
              ) : null}
            </fieldset>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            {sendInvite && onInviteSent ? "Save & send invite" : existing ? "Update teammate" : "Save teammate"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

export function AddVendorModal({ onClose, onSaved, existing }: ClientModalProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [contactName, setContactName] = useState(existing?.contact_name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [businessStructure, setBusinessStructure] = useState(existing?.business_structure ?? "");
  const [documents, setDocuments] = useState(existing?.documents ?? []);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(existing?.avatar_url ?? null);
  const [permissions, setPermissions] = useState<ProjectPermissionFlags>(() =>
    existing?.permissions ?? defaultPermissionsForSegment("vendor"),
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const contacts = loadContacts();
    const byEmail = findContactByEmail(contacts, email);
    if (!name.trim() || !email.trim()) {
      setError("Vendor name and email are required.");
      return;
    }
    const now = new Date().toISOString();
    const payload: Contact = {
      id: existing?.id ?? byEmail?.id ?? newContactId(),
      segment: "vendor",
      kind: "company",
      company_code: existing?.company_code ?? deriveCompanyCode(name),
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
    const next =
      byEmail || existing ? contacts.map((c) => (c.id === payload.id ? payload : c)) : [...contacts, payload];
    saveContacts(next);
    onSaved();
    onClose();
  }

  return (
    <ModalShell title={existing ? "Update vendor" : "Add vendor"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <AvatarUpload avatarUrl={avatarUrl} onChange={setAvatarUrl} fallbackInitials={name.slice(0, 2).toUpperCase() || "V"} />
          <label className={labelClass}>
            Vendor name
            <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className={labelClass}>
            Contact name
            <input className={fieldClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </label>
          <label className={labelClass}>
            Business structure
            <select className={fieldClass} value={businessStructure} onChange={(e) => setBusinessStructure(e.target.value)}>
              <option value="">Select…</option>
              {BUSINESS_STRUCTURE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Email
            <input type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className={labelClass}>
            Phone
            <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <FileUploadList label="Documents" files={documents} onChange={setDocuments} />
          <fieldset className="rounded-xl border border-border-light bg-surface-body/30 px-3 py-3">
            <p className="text-sm font-semibold text-text-primary">Company permissions</p>
            <p className="mt-1 text-[11px] text-text-secondary">
              People at this vendor inherit these permissions. Per-project access is set on each project.
            </p>
            <div className="mt-3 max-h-[min(240px,34vh)] overflow-y-auto rounded-xl border border-border-light bg-white p-3">
              <PermissionsEditor segment="vendor" flags={permissions} onChange={setPermissions} dense />
            </div>
          </fieldset>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border-light px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
            Save vendor
          </button>
        </div>
      </form>
    </ModalShell>
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
    : c.kind === "company"
      ? `${c.company_code}${memberCount > 0 ? ` · ${memberCount} members` : ""}`
      : (parentCompany?.name ?? null);

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
