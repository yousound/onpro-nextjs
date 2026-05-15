"use client";

import type { PeopleSegment } from "@/lib/mock/people";
import {
  permissionKeyApplies,
  type ProjectPermissionFlags,
} from "@/lib/project-permissions";

function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className={`text-sm ${disabled ? "text-text-secondary" : "text-text-primary"}`}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        } ${checked ? "bg-accent" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

type RowDef = { key: keyof ProjectPermissionFlags; label: string };

const GENERAL: RowDef[] = [
  { key: "acceptMessagesFromTeam", label: "Accept messages from team" },
  { key: "acceptMessagesFromVendors", label: "Accept messages from vendors" },
  { key: "acceptMessagesFromClients", label: "Accept messages from clients" },
];

const PROJECT_ROWS: RowDef[] = [
  { key: "canUploadMedia", label: "Can upload images & video" },
  { key: "canSendLinks", label: "Can send links" },
  { key: "canCreateEditProjects", label: "Can create & edit projects" },
  { key: "canApproveTasks", label: "Can approve / deny / edit tasks" },
  { key: "canSendQuotes", label: "Can send quotes" },
  { key: "canSendEstimates", label: "Can send estimates" },
];

const INVOICE_ROWS: RowDef[] = [
  { key: "canSendInvoices", label: "Can send invoices" },
  { key: "canReceiveInvoices", label: "Can receive invoices" },
];

const CAL_ROWS: RowDef[] = [
  { key: "canViewCalendar", label: "Can view calendar" },
  { key: "canCreateEditEvents", label: "Can create / delete / edit events" },
];

const GRANT_ROWS: RowDef[] = [{ key: "canGrantPermissions", label: "Can grant permissions for team" }];

export function PermissionsEditor({
  segment,
  flags,
  onChange,
  dense,
}: {
  segment: PeopleSegment;
  flags: ProjectPermissionFlags;
  onChange: (next: ProjectPermissionFlags) => void;
  dense?: boolean;
}) {
  function patch(key: keyof ProjectPermissionFlags, value: boolean) {
    onChange({ ...flags, [key]: value });
  }

  function renderRows(rows: RowDef[]) {
    return rows.map(({ key, label }) => {
      const applies = permissionKeyApplies(segment, key);
      const checked = flags[key];
      const disabled = !applies;
      return (
        <ToggleRow
          key={key}
          label={label}
          checked={checked}
          disabled={disabled}
          onChange={(v) => patch(key, v)}
        />
      );
    });
  }

  const gap = dense ? "space-y-0" : "space-y-1";

  return (
    <div className={dense ? "space-y-4" : "space-y-5"}>
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">General messages</p>
        <div className={`mt-2 divide-y divide-border-light rounded-xl border border-border-light bg-surface-card px-3 ${gap}`}>
          {renderRows(GENERAL)}
        </div>
      </section>
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Project</p>
        <div className={`mt-2 divide-y divide-border-light rounded-xl border border-border-light bg-surface-card px-3 ${gap}`}>
          {renderRows(PROJECT_ROWS)}
        </div>
      </section>
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Invoices</p>
        <div className={`mt-2 divide-y divide-border-light rounded-xl border border-border-light bg-surface-card px-3 ${gap}`}>
          {renderRows(INVOICE_ROWS)}
        </div>
      </section>
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Calendar</p>
        <div className={`mt-2 divide-y divide-border-light rounded-xl border border-border-light bg-surface-card px-3 ${gap}`}>
          {renderRows(CAL_ROWS)}
        </div>
      </section>
      {segment === "team" ? (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Grant rights</p>
          <div className={`mt-2 divide-y divide-border-light rounded-xl border border-border-light bg-surface-card px-3 ${gap}`}>
            {renderRows(GRANT_ROWS)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
