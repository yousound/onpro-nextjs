"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { KindToggle } from "@/components/contact-form-fields";
import { InlineFieldMessage } from "@/components/inline-field-message";
import {
  clientContactFormCanSubmit,
  isClientEmailWarning,
  validateClientContactFields,
} from "@/lib/contact-field-validation";
import { loadContacts } from "@/lib/contacts-store";
import { deriveCompanyCode, type ContactKind } from "@/lib/types/contact";
import { resolveClientCode } from "@/lib/reference/client-codes";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export type NewClientDraft = {
  kind: ContactKind;
  /** Company name, or individual's full name when kind is individual */
  companyName: string;
  contactName: string;
  companyCode: string;
  email: string;
  phone: string;
};

export type SavedNewClient = {
  id: string;
  name: string;
  code: string;
};

type Props = {
  open: boolean;
  titleId?: string;
  name: string;
  onNameChange: (v: string) => void;
  clientSelect: string;
  onClientSelectChange: (v: string) => void;
  clientsSorted: readonly (readonly [string, string, string])[];
  poNumber: string;
  onPoNumberChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  statusOptions: readonly string[];
  dueDate: string;
  onDueDateChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  onSaveNewClient: (draft: NewClientDraft) => Promise<SavedNewClient | { error: string }>;
  clientCodeNotice?: string | null;
  onUseResolvedClientCode?: () => void | Promise<void>;
  submitError?: string | null;
  submitting?: boolean;
};

export function NewProjectModal({
  open,
  titleId = "new-project-title",
  name,
  onNameChange,
  clientSelect,
  onClientSelectChange,
  clientsSorted,
  poNumber,
  onPoNumberChange,
  status,
  onStatusChange,
  statusOptions,
  dueDate,
  onDueDateChange,
  description,
  onDescriptionChange,
  onClose,
  onSubmit,
  onSaveNewClient,
  clientCodeNotice,
  onUseResolvedClientCode,
  submitError,
  submitting = false,
}: Props) {
  type ModalView = "project" | "addClient";
  const [view, setView] = useState<ModalView>("project");
  const [clientDraft, setClientDraft] = useState<NewClientDraft>({
    kind: "company",
    companyName: "",
    contactName: "",
    companyCode: "",
    email: "",
    phone: "",
  });
  const [clientError, setClientError] = useState<string | null>(null);
  const [savingClient, setSavingClient] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view === "project") onClose();
        else setView("project");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, view]);

  useEffect(() => {
    if (!open) {
      setView("project");
      setClientError(null);
    }
  }, [open]);

  useEffect(() => {
    setClientDraft((d) => {
      const label = d.companyName.trim();
      if (!label || d.companyCode.trim()) return d;
      return { ...d, companyCode: resolveClientCode(label) };
    });
  }, [clientDraft.kind, clientDraft.companyName]);

  const canCreateProject = Boolean(clientSelect.trim() && name.trim());

  const clientFieldMessages = validateClientContactFields(loadContacts(), {
    kind: clientDraft.kind,
    name: clientDraft.companyName.trim(),
    email: clientDraft.email,
    companyCode: clientDraft.companyCode,
  });

  const canSaveClient = clientContactFormCanSubmit(clientFieldMessages, {
    name: clientDraft.companyName,
    email: clientDraft.email,
    companyCode: clientDraft.companyCode,
  });

  function handleClientSelectChange(value: string) {
    if (value === "__new__") {
      setClientError(null);
      setView("addClient");
      return;
    }
    onClientSelectChange(value);
  }

  function backToProject() {
    setView("project");
    setClientError(null);
  }

  async function handleSaveClient(e: FormEvent) {
    e.preventDefault();
    if (!canSaveClient) {
      setClientError(
        clientFieldMessages.companyCode ??
          clientFieldMessages.email ??
          "Fix the highlighted fields before saving.",
      );
      return;
    }
    setClientError(null);
    setSavingClient(true);
    try {
      const result = await onSaveNewClient({
        kind: clientDraft.kind,
        companyName: clientDraft.companyName.trim(),
        contactName: clientDraft.contactName.trim(),
        companyCode: clientDraft.companyCode.trim().toUpperCase(),
        email: clientDraft.email.trim(),
        phone: clientDraft.phone.trim(),
      });
      if ("error" in result) {
        setClientError(result.error);
        return;
      }
      onClientSelectChange(result.id);
      setClientDraft({
        kind: "company",
        companyName: "",
        contactName: "",
        companyCode: "",
        email: "",
        phone: "",
      });
      setView("project");
    } finally {
      setSavingClient(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(640px,92vh)] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/90"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:flex-row">
          <aside className="hidden shrink-0 flex-col justify-between bg-gradient-to-br from-[#f5f3ff] to-violet-100 px-8 py-10 sm:flex sm:w-[38%]">
            <div>
              <RocketBadge />
              <h2 className="mt-8 text-2xl font-bold leading-tight text-[#5b21b6]">
                Let&apos;s build
                <br />
                something great.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-violet-900/70">
                {view === "addClient"
                  ? "Add your client here — they’ll show up on this project and in People."
                  : "Create your project and get everything moving in one place."}
              </p>
            </div>
          </aside>

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {view === "project" ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <PanelHeader
                  title="New project"
                  subtitle="Set up the basics to get your project off the ground."
                  onClose={onClose}
                />
                <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                    <Field label="Project name" icon={<FolderIcon />}>
                      <input
                        className={fieldClass}
                        value={name}
                        onChange={(e) => onNameChange(e.target.value)}
                        placeholder="e.g. Spring capsule"
                        required
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Client" icon={<UserIcon />}>
                      <select
                        className={fieldClass}
                        value={clientSelect || ""}
                        onChange={(e) => handleClientSelectChange(e.target.value)}
                        required
                      >
                        <option value="" disabled>
                          Select a client
                        </option>
                        {clientsSorted.map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                        <option value="__new__">+ Add new client</option>
                      </select>
                    </Field>
                    {clientCodeNotice ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                        <p>{clientCodeNotice}</p>
                        {onUseResolvedClientCode ? (
                          <button
                            type="button"
                            className="mt-2 font-semibold text-accent hover:underline"
                            onClick={() => void onUseResolvedClientCode()}
                          >
                            Update client to master list code
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <Field label="PO number" icon={<HashIcon />}>
                      <input
                        className={`${fieldClass} font-semibold text-slate-800`}
                        value={poNumber}
                        onChange={(e) => onPoNumberChange(e.target.value.toUpperCase())}
                        placeholder="Select a client to preview PO"
                        autoComplete="off"
                      />
                      <p className="mt-1.5 text-xs font-normal normal-case text-slate-400">
                        Auto-filled as ClientCode+YYMM+Seq (e.g. DW260601). Edit anytime — a new
                        number is assigned when the month changes.
                      </p>
                    </Field>
                    <Field label="Status" icon={<StatusDot />}>
                      <select
                        className={fieldClass}
                        value={status}
                        onChange={(e) => onStatusChange(e.target.value)}
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Due date (optional)" icon={<CalendarIcon />}>
                      <input
                        type="date"
                        className={fieldClass}
                        value={dueDate}
                        onChange={(e) => onDueDateChange(e.target.value)}
                      />
                    </Field>
                    <Field label="Notes (optional)">
                      <textarea
                        className={fieldClass}
                        rows={3}
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder="Short description for the team"
                      />
                    </Field>
                  </div>
                  {submitError ? (
                    <p className="px-5 pb-2 text-sm font-medium text-red-600 sm:px-6">{submitError}</p>
                  ) : null}
                  <PanelFooter
                    secondaryLabel="Cancel"
                    onSecondary={onClose}
                    primaryLabel={submitting ? "Creating…" : "Create project"}
                    primaryIcon={<RocketMini />}
                    primaryDisabled={!canCreateProject || submitting}
                  />
                </form>
              </div>
            ) : null}

            {view === "addClient" ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <PanelHeader
                  title="Add client"
                  subtitle="Save the client to your directory, then finish the project."
                  onClose={onClose}
                  onBack={backToProject}
                />
                <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSaveClient}>
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                    <div>
                      <p className={labelClass}>Client type</p>
                      <div className="mt-2">
                        <KindToggle
                          kind={clientDraft.kind}
                          onChange={(kind) =>
                            setClientDraft((d) => ({
                              ...d,
                              kind,
                              companyName: "",
                              contactName: "",
                              companyCode: "",
                            }))
                          }
                        />
                      </div>
                    </div>
                    {clientDraft.kind === "company" ? (
                      <>
                        <Field label="Company name" icon={<UserIcon />}>
                          <input
                            className={fieldClass}
                            value={clientDraft.companyName}
                            onChange={(e) =>
                              setClientDraft((d) => ({ ...d, companyName: e.target.value }))
                            }
                            placeholder="e.g. Acme Design Co."
                            required
                            autoComplete="organization"
                          />
                        </Field>
                        <Field label="Primary contact name (optional)">
                          <input
                            className={fieldClass}
                            value={clientDraft.contactName}
                            onChange={(e) =>
                              setClientDraft((d) => ({ ...d, contactName: e.target.value }))
                            }
                            placeholder="e.g. Jordan Lee"
                            autoComplete="name"
                          />
                        </Field>
                      </>
                    ) : (
                      <Field label="Name" icon={<UserIcon />}>
                        <input
                          className={fieldClass}
                          value={clientDraft.companyName}
                          onChange={(e) =>
                            setClientDraft((d) => ({ ...d, companyName: e.target.value }))
                          }
                          placeholder="e.g. Jordan Lee"
                          required
                          autoComplete="name"
                        />
                      </Field>
                    )}
                    <Field
                      label={
                        clientDraft.kind === "company" ? "Company code (2–3 letters)" : "Client code (2–3 letters)"
                      }
                    >
                      <input
                        className={`${fieldClass}${clientFieldMessages.companyCode ? " border-red-400 focus:border-red-500 focus:ring-red-500/15" : ""}`}
                        value={clientDraft.companyCode}
                        onChange={(e) =>
                          setClientDraft((d) => ({
                            ...d,
                            companyCode: e.target.value.toUpperCase().slice(0, 3),
                          }))
                        }
                        placeholder="e.g. AD"
                        maxLength={3}
                        required
                        aria-invalid={Boolean(clientFieldMessages.companyCode)}
                      />
                      <InlineFieldMessage message={clientFieldMessages.companyCode} />
                      <p className="mt-1 text-xs font-normal normal-case text-slate-400">
                        Used in PO numbers (e.g. AD260601).
                      </p>
                    </Field>
                    <Field label="Email">
                      <input
                        type="email"
                        className={`${fieldClass}${clientFieldMessages.email?.includes("already used for") ? " border-red-400 focus:border-red-500 focus:ring-red-500/15" : ""}`}
                        value={clientDraft.email}
                        onChange={(e) => setClientDraft((d) => ({ ...d, email: e.target.value }))}
                        placeholder="client@company.com"
                        required
                        autoComplete="email"
                        aria-invalid={Boolean(
                          clientFieldMessages.email?.includes("already used for"),
                        )}
                      />
                      <InlineFieldMessage
                        message={clientFieldMessages.email}
                        tone={isClientEmailWarning(clientFieldMessages) ? "warning" : "error"}
                      />
                    </Field>
                    <Field label="Phone (optional)">
                      <input
                        type="tel"
                        className={fieldClass}
                        value={clientDraft.phone}
                        onChange={(e) => setClientDraft((d) => ({ ...d, phone: e.target.value }))}
                        placeholder="+1 …"
                        autoComplete="tel"
                      />
                    </Field>
                    {clientError ? (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {clientError}
                      </p>
                    ) : null}
                  </div>
                  <PanelFooter
                    secondaryLabel="Back"
                    onSecondary={backToProject}
                    primaryLabel={savingClient ? "Saving…" : "Save client"}
                    primaryDisabled={savingClient || !canSaveClient}
                  />
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  onClose,
  onBack,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-sm font-semibold text-[#7c3aed] hover:underline"
          >
            ← Back to project
          </button>
        ) : null}
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

function PanelFooter({
  secondaryLabel,
  onSecondary,
  primaryLabel,
  primaryIcon,
  primaryDisabled,
}: {
  secondaryLabel: string;
  onSecondary: () => void;
  primaryLabel: string;
  primaryIcon?: ReactNode;
  primaryDisabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4 sm:px-6">
      <button
        type="button"
        onClick={onSecondary}
        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
      >
        {secondaryLabel}
      </button>
      <button
        type="submit"
        disabled={primaryDisabled}
        className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/25 hover:bg-[#6d28d9] disabled:opacity-50"
      >
        {primaryLabel}
        {primaryIcon}
      </button>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className={labelClass}>
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function RocketBadge() {
  return (
    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#7c3aed] text-white shadow-md">
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
        <path d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2z" />
      </svg>
    </span>
  );
}

function RocketMini() {
  return <span aria-hidden>🚀</span>;
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <path d="M3 7h5l2 2h11v10H3V7z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3 3-5 7-5s7 2 7 5" />
    </svg>
  );
}

function HashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <path d="M10 3 8 21M16 3l-2 18M3 9h18M3 15h18" />
    </svg>
  );
}

function StatusDot() {
  return <span className="size-2.5 rounded-full bg-amber-400" aria-hidden />;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}
