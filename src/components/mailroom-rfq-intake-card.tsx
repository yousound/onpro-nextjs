"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ProjectModalPanelHeader } from "@/components/project-modal-ui";
import type { EmailThread, MailroomRfqIntake, MailroomWorkflow } from "@/lib/types/agent";
import type { Contact } from "@/lib/types/contact";
import {
  buildRfqIntakeDraft,
  isRfqIntakeConfirmed,
  validateRfqIntakeDraft,
} from "@/lib/mailroom/rfq-intake";
import { MAILROOM_Z_RFQ_OVER_WORKFLOW } from "@/lib/mailroom/modal-layers";
import {
  contactDisplayName,
  loadContacts,
  vendorDisplayName,
} from "@/lib/contacts-store";
import { useCurrentUser } from "@/components/profile-provider";
import {
  TeamFieldSelect,
  VendorFieldSelect,
  ownerTeamContactDefaults,
  teamContactsWithSelf,
  useProjectTeam,
  useProjectVendors,
} from "@/components/vendor-select";
import { AddTeamMemberModal, AddVendorModal } from "@/components/add-contact-modals";

const fieldClass =
  "mt-1 h-10 w-full rounded-lg border border-border-light bg-white px-3 text-sm text-text-primary shadow-sm outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/15";

const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-text-secondary";

type ProviderProps = {
  thread: EmailThread;
  workflow: MailroomWorkflow;
  intake: MailroomRfqIntake | null;
  onSaveDraft: (draft: MailroomRfqIntake) => void;
  onConfirm: (draft: MailroomRfqIntake) => void;
  onEdit: () => void;
  onDismissPanel?: () => void;
  children: ReactNode;
};

type RfqIntakeContextValue = {
  thread: EmailThread;
  draft: MailroomRfqIntake;
  intake: MailroomRfqIntake | null;
  error: string | null;
  team: ReturnType<typeof useProjectTeam>;
  vendors: ReturnType<typeof useProjectVendors>;
  patch: (partial: Partial<MailroomRfqIntake>) => void;
  setTeamContactName: (name: string | null) => void;
  handleConfirm: () => void;
  dismissPanel: () => void;
  openAddTeam: () => void;
  openAddVendor: () => void;
};

const RfqIntakeContext = createContext<RfqIntakeContextValue | null>(null);

function useRfqIntakeContext(): RfqIntakeContextValue {
  const ctx = useContext(RfqIntakeContext);
  if (!ctx) throw new Error("MailroomRfqIntake components must be inside MailroomRfqIntakeProvider");
  return ctx;
}

export function MailroomRfqIntakeProvider({
  thread,
  workflow,
  intake,
  onSaveDraft,
  onConfirm,
  onEdit: _onEdit,
  onDismissPanel,
  children,
}: ProviderProps) {
  const { user } = useCurrentUser();
  const vendors = useProjectVendors();
  const teamRaw = useProjectTeam();
  const team = useMemo(() => teamContactsWithSelf(teamRaw, user), [teamRaw, user]);
  const [draft, setDraft] = useState<MailroomRfqIntake>(() =>
    buildRfqIntakeDraft(thread, workflow, intake),
  );
  const [error, setError] = useState<string | null>(null);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [addVendorOpen, setAddVendorOpen] = useState(false);

  const onSaveDraftRef = useRef(onSaveDraft);
  onSaveDraftRef.current = onSaveDraft;
  const skipPersistRef = useRef(true);
  const teamContactAutoSetRef = useRef<string | null>(null);

  useEffect(() => {
    const next = buildRfqIntakeDraft(thread, workflow, intake);
    setDraft(next);
    setError(null);
    skipPersistRef.current = true;
    teamContactAutoSetRef.current = null;
    if (!intake?.confirmed_at) {
      onSaveDraftRef.current(next);
    }
  }, [thread.id, workflow.thread_id, workflow.created_at, intake?.confirmed_at]);

  useEffect(() => {
    if (intake?.confirmed_at) return;
    if (teamContactAutoSetRef.current === thread.id) return;
    const owner = ownerTeamContactDefaults(user, team);
    if (!owner) return;

    setDraft((prev) => ({
      ...prev,
      team_contact_name: owner.name,
      team_contact_email: owner.email,
    }));
    teamContactAutoSetRef.current = thread.id;
  }, [thread.id, intake?.confirmed_at, user, team]);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    if (intake?.confirmed_at) return;
    onSaveDraftRef.current(draft);
  }, [draft, intake?.confirmed_at]);

  function patch(partial: Partial<MailroomRfqIntake>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function setTeamContactName(name: string | null) {
    const trimmed = name?.trim() || null;
    const match = trimmed
      ? team.find((c) => contactDisplayName(c).toLowerCase() === trimmed.toLowerCase())
      : undefined;
    patch({
      team_contact_name: trimmed,
      team_contact_email: match?.email?.trim() || draft.team_contact_email,
    });
  }

  function applySavedContactRow(c: Contact) {
    if (c.segment === "team") {
      patch({
        team_contact_name: contactDisplayName(c),
        team_contact_email: c.email.trim(),
      });
    } else if (c.segment === "vendor") {
      patch({ vendor_name: vendorDisplayName(c) });
    }
  }

  function handleContactSavedFromModal(saved: Contact | undefined, segment: "team" | "vendor") {
    if (saved?.email?.trim()) {
      applySavedContactRow(saved);
      return;
    }
    const contacts = loadContacts();
    const picked = contacts
      .filter((c) => c.segment === segment)
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
    if (picked) applySavedContactRow(picked);
  }

  function handleConfirm() {
    const check = validateRfqIntakeDraft(draft);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    onConfirm(draft);
  }

  const value: RfqIntakeContextValue = {
    thread,
    draft,
    intake,
    error,
    team,
    vendors,
    patch,
    setTeamContactName,
    handleConfirm,
    dismissPanel: () => onDismissPanel?.(),
    openAddTeam: () => setAddTeamOpen(true),
    openAddVendor: () => setAddVendorOpen(true),
  };

  return (
    <RfqIntakeContext.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
      {addTeamOpen ? (
        <AddTeamMemberModal
          onClose={() => setAddTeamOpen(false)}
          onSaved={(saved) => {
            handleContactSavedFromModal(saved, "team");
            setAddTeamOpen(false);
          }}
        />
      ) : null}
      {addVendorOpen ? (
        <AddVendorModal
          onClose={() => setAddVendorOpen(false)}
          onSaved={(saved) => {
            handleContactSavedFromModal(saved, "vendor");
            setAddVendorOpen(false);
          }}
        />
      ) : null}
    </RfqIntakeContext.Provider>
  );
}

export function MailroomRfqIntakeConfirmedBanner({
  intake,
  onEdit,
}: {
  intake: MailroomRfqIntake;
  onEdit: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-white px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">RFQ confirmed</p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {intake.client_name}
            {!intake.client_po_tbd && intake.client_po ? (
              <span className="font-mono text-text-secondary"> · PO {intake.client_po}</span>
            ) : (
              <span className="text-text-secondary"> · PO TBD</span>
            )}
          </p>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            {intake.project_name}
            {intake.due_date ? ` · Due ${intake.due_date}` : ""}
            {intake.team_contact_name ? ` · Team ${intake.team_contact_name}` : ""}
            {intake.vendor_name ? ` · Vendor ${intake.vendor_name}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 rounded-lg border border-border-light bg-white px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-slate-50"
        >
          Edit details
        </button>
      </div>
    </div>
  );
}

type ReviewModalProps = Omit<ProviderProps, "children"> & {
  open: boolean;
  /** When true, stacks above the workflow plan modal (edit confirmed RFQ). */
  stackedOverWorkflow?: boolean;
};

/** RFQ confirm in a modal so chat and original emails stay full height. */
export function MailroomRfqReviewModal({
  open,
  stackedOverWorkflow = false,
  onDismissPanel,
  ...providerProps
}: ReviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismissPanel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismissPanel]);

  if (!open || !mounted) return null;

  const editingConfirmed = isRfqIntakeConfirmed(providerProps.intake);
  const overlayZ = stackedOverWorkflow ? MAILROOM_Z_RFQ_OVER_WORKFLOW : 225;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      style={{ zIndex: overlayZ }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDismissPanel?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mailroom-rfq-review-title"
        className="flex max-h-[min(720px,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/90"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <MailroomRfqIntakeProvider
          {...providerProps}
          onDismissPanel={onDismissPanel}
        >
          <ProjectModalPanelHeader
            title={editingConfirmed ? "Edit RFQ details" : "Review and Run Plan"}
            subtitle={
              editingConfirmed
                ? "Update brand, PO, team, or vendor. Cancel returns to the workflow plan."
                : "Confirm the brand, PO, team, and vendor before running workflow steps."
            }
            onClose={() => onDismissPanel?.()}
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <MailroomRfqIntakeForm />
          </div>
          <MailroomRfqIntakeFooter className="shrink-0 border-t border-slate-100" />
        </MailroomRfqIntakeProvider>
      </div>
    </div>,
    document.body,
  );
}

export function MailroomRfqIntakeForm() {
  const {
    draft,
    team,
    vendors,
    patch,
    setTeamContactName,
    openAddTeam,
    openAddVendor,
  } = useRfqIntakeContext();

  return (
    <div className="border-b border-violet-300 bg-gradient-to-b from-violet-100/80 to-white px-5 py-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-accent">
          Confirm before building
        </p>
        <p className="mt-0.5 max-w-xl text-[12px] text-text-secondary">
          Set the end client and project details, then pick your team contact and vendor below.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={labelClass}>End client (brand)</span>
          <input
            className={fieldClass}
            value={draft.client_name}
            onChange={(e) => patch({ client_name: e.target.value })}
            placeholder="e.g. ZOE Conference"
          />
        </label>
        <label>
          <span className={labelClass}>Client PO</span>
          <input
            className={fieldClass}
            value={draft.client_po}
            disabled={draft.client_po_tbd}
            onChange={(e) => patch({ client_po: e.target.value })}
            placeholder="e.g. ZOE260104"
          />
          <label className="mt-2 flex items-center gap-2 text-[11px] text-text-secondary">
            <input
              type="checkbox"
              checked={draft.client_po_tbd}
              onChange={(e) => patch({ client_po_tbd: e.target.checked })}
              className="rounded border-border-light"
            />
            No PO yet (TBD)
          </label>
        </label>
        <label>
          <span className={labelClass}>Due date</span>
          <input
            type="date"
            className={fieldClass}
            value={draft.due_date ?? ""}
            onChange={(e) => patch({ due_date: e.target.value.trim() || null })}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={labelClass}>Project name</span>
          <input
            className={fieldClass}
            value={draft.project_name}
            onChange={(e) => patch({ project_name: e.target.value })}
          />
        </label>
        <div className="sm:col-span-2">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <TeamFieldSelect
                label="Team contact on thread"
                team={team}
                value={draft.team_contact_name}
                onChange={setTeamContactName}
                emptyLabel="Select team member…"
                labelClassName={labelClass}
              />
            </div>
            <button
              type="button"
              onClick={openAddTeam}
              className="mb-0.5 shrink-0 rounded-lg border border-accent/40 bg-white px-3 py-2 text-[11px] font-semibold text-accent hover:bg-violet-50"
            >
              + Add
            </button>
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <VendorFieldSelect
                label="Vendor on thread"
                vendors={vendors}
                value={draft.vendor_name}
                onChange={(name) => patch({ vendor_name: name })}
                emptyLabel="Select vendor…"
                labelClassName={labelClass}
              />
            </div>
            <button
              type="button"
              onClick={openAddVendor}
              className="mb-0.5 shrink-0 rounded-lg border border-accent/40 bg-white px-3 py-2 text-[11px] font-semibold text-accent hover:bg-violet-50"
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[12px] font-medium text-text-primary">
        <input
          type="checkbox"
          checked={draft.create_order}
          onChange={(e) => patch({ create_order: e.target.checked })}
          className="rounded border-border-light"
        />
        Create one production order for this RFQ
      </label>
    </div>
  );
}

export function MailroomRfqIntakeFooter({ className }: { className?: string }) {
  const { error, handleConfirm, dismissPanel, intake } = useRfqIntakeContext();
  const editingConfirmed = isRfqIntakeConfirmed(intake);
  return (
    <div
      className={`border-t border-violet-200 bg-white px-5 py-3 ${className ?? ""}`}
    >
      {error ? <p className="mb-2 text-[12px] font-medium text-red-600">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={dismissPanel}
          className="rounded-lg border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-slate-50"
        >
          {editingConfirmed ? "Back to workflow plan" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
        >
          {editingConfirmed ? "Save changes" : "Run plan"}
        </button>
      </div>
    </div>
  );
}
