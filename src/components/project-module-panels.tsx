"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApprovalStatus,
  Project,
  Sample,
  SampleStatus,
} from "@/lib/types/project";
import { PermissionsEditor } from "@/components/permissions-editor";
import { clientInitials, dateInputToIso, formatShortDate, isoToDateInput } from "@/lib/format";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import {
  addInternalTeamMemberToProject,
  mergedInternalTeamRoster,
} from "@/lib/internal-team-roster";
import type { PeopleSegment } from "@/lib/mock/people";
import { segmentBadgeSoftClass, segmentLabel, segmentPillSelectedClass } from "@/lib/mock/people";
import { ProjectFinancialsPanel } from "@/components/project-financials-panel";
import { PackingSlipSection } from "@/components/packing-slip-section";
import { loadContacts } from "@/lib/contacts-store";
import { DirectoryAvatar } from "@/components/directory-avatar";
import { useCurrentUser } from "@/components/profile-provider";
import { useWorkspace } from "@/components/workspace-provider";
import { canManageWorkspacePermissions } from "@/lib/workspace-permissions-admin";
import { peopleForProject, type ProjectPersonRow } from "@/lib/project-people";
import {
  mergeRoleDrafts,
  personListPermissionSummary,
} from "@/lib/project-person-permissions";
import { ProjectPersonPermissionsModal } from "@/components/project-person-permissions-modal";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import type { ProjectModuleId } from "@/lib/project-modules";
import { defaultPermissionsForSegment, type ProjectPermissionFlags } from "@/lib/project-permissions";
import {
  defaultBulkProductionTrack,
  defaultCostingExtraTrack,
  defaultDyeCostingTrack,
  defaultPrintEmbroideryTrack,
  resolveBulkProductionTracks,
  resolveCostingExtraTracks,
  resolveDyeCostingTracks,
  resolvePrintEmbroideryTracks,
  updateBulkTrack,
  updateCostingExtraTrack,
  updateDyeTrack,
  updatePrintEmbTrack,
} from "@/lib/project-repeatable-tracks";
import type { Contact } from "@/lib/types/contact";
import { VendorStealthSelect, useProjectVendors } from "@/components/vendor-select";

/** Shared chrome for stealth controls (width varies by control type — wide date inputs break native picker anchoring). */
const stealthControlBase =
  "min-h-[1.75rem] rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-text-primary outline-none transition hover:bg-white/75 hover:shadow-sm focus:border-accent focus:bg-white focus:shadow-sm focus:ring-2 focus:ring-accent/20";

/** Full-width value column (text fields). */
const stealthValueClass =
  `${stealthControlBase} min-w-0 w-full flex-1 text-right placeholder-shown:font-normal placeholder:text-text-secondary/55 sm:min-w-[10rem]`;

/** Narrow date field so the calendar popup stays beside the control you clicked (not far left). */
const stealthDateInputClass =
  `${stealthControlBase} w-[10.75rem] max-w-full shrink-0 text-right tabular-nums [color-scheme:light]`;

const stealthSelectClass = `${stealthControlBase} w-auto min-w-[9rem] max-w-[13rem] shrink-0 cursor-pointer pr-6 text-right`;

const stealthTextareaClass =
  "mt-1 min-h-[4rem] w-full rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm font-medium text-text-primary outline-none transition placeholder:text-text-secondary/55 hover:bg-white/75 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/20";

function PanelShell({
  children,
  className = "",
  hint,
}: {
  children: React.ReactNode;
  className?: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1600px] space-y-5 pb-8 ${className}`}>
      {hint}
      {children}
    </div>
  );
}

function EditPersistHint() {
  return (
    <p className="text-[11px] leading-snug text-text-secondary">
      Tap or focus a value to edit. Changes save when project sync to your workspace is wired.
    </p>
  );
}

function PoInvoiceBanner({ poNumber }: { poNumber: string }) {
  return (
    <p className="mb-4 rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950">
      PO <span className="font-bold">{poNumber}</span> is this project&apos;s purchase order reference for
      invoices you create here.
    </p>
  );
}

function SectionCard({
  title,
  headerExtra,
  children,
}: {
  title: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{title}</h3>
        {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function GrayRow({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-slate-50 px-4 py-3">{children}</div>;
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <GrayRow>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <span className="text-sm font-semibold text-text-primary">{value}</span>
      </div>
    </GrayRow>
  );
}

function VendorRow({ label, name }: { label: string; name: string }) {
  return (
    <GrayRow>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-base font-semibold text-text-primary">{name}</p>
    </GrayRow>
  );
}

/** iOS CostingModule empty-state parity — hook up when vendor CRUD exists. */
function AddVendorPlaceholder() {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200/90 bg-blue-50 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/80"
    >
      <span className="text-lg leading-none" aria-hidden>
        +
      </span>
      Add vendor
    </button>
  );
}

function approvalPill(status: ApprovalStatus | null) {
  const s = status ?? "PENDING";
  const cls =
    s === "APPROVED"
      ? "bg-emerald-600"
      : s === "REJECTED"
        ? "bg-red-600"
        : "bg-amber-500";
  return (
    <span className={`rounded-lg px-3 py-1 text-xs font-bold text-white ${cls}`}>{s}</span>
  );
}

function costingToggleRow(approved: boolean | null) {
  return (
    <GrayRow>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">Costing approved</span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            approved === null
              ? "bg-slate-100 text-slate-600"
              : approved
                ? "bg-emerald-100 text-emerald-800"
                : "bg-slate-200 text-slate-600"
          }`}
        >
          {approved === null ? "Not set" : approved ? "Yes" : "No"}
        </span>
      </div>
    </GrayRow>
  );
}

function StealthDateRow({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string | null;
  onCommit: (iso: string | null) => void;
}) {
  return (
    <GrayRow>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm font-medium text-text-secondary">{label}</span>
        <input
          type="date"
          value={isoToDateInput(value)}
          onChange={(e) => {
            const ymd = e.target.value;
            onCommit(ymd ? dateInputToIso(ymd) : null);
          }}
          className={stealthDateInputClass}
        />
      </div>
    </GrayRow>
  );
}

function StealthTextRow({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onCommit: (next: string | null) => void;
}) {
  return (
    <GrayRow>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm font-medium text-text-secondary">{label}</span>
        <input
          type="text"
          value={value ?? ""}
          placeholder={placeholder ?? "—"}
          onChange={(e) => {
            const v = e.target.value;
            onCommit(v === "" ? null : v);
          }}
          className={stealthValueClass}
        />
      </div>
    </GrayRow>
  );
}

function StealthMetaField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onCommit: (next: string | null) => void;
}) {
  return (
    <GrayRow>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder ?? "—"}
        onChange={(e) => {
          const v = e.target.value;
          onCommit(v === "" ? null : v);
        }}
        className={`mt-1 w-full text-left ${stealthValueClass}`}
      />
    </GrayRow>
  );
}

function StealthApprovalSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ApprovalStatus | null;
  onChange: (next: ApprovalStatus) => void;
}) {
  const sel = value ?? "PENDING";
  return (
    <GrayRow>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm font-medium text-text-primary">{label}</span>
        <select
          value={sel}
          onChange={(e) => onChange(e.target.value as ApprovalStatus)}
          className={stealthSelectClass}
        >
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </GrayRow>
  );
}

function StealthCostingApprovedRow({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (next: boolean | null) => void;
}) {
  return (
    <GrayRow>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm font-medium text-text-primary">Costing approved</span>
        <select
          value={value === null ? "unset" : value ? "yes" : "no"}
          onChange={(e) => {
            const x = e.target.value;
            onChange(x === "unset" ? null : x === "yes");
          }}
          className={stealthSelectClass}
        >
          <option value="unset">Not set</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
    </GrayRow>
  );
}

function useInternalTeamRoster(projectId: number): {
  roster: string[];
  addMember: (rawName: string) => void;
} {
  const [bump, setBump] = useState(0);

  const roster = useMemo(() => mergedInternalTeamRoster(projectId), [projectId, bump]);

  const addMember = useCallback(
    (rawName: string) => {
      if (!addInternalTeamMemberToProject(projectId, rawName)) return;
      setBump((b) => b + 1);
    },
    [projectId],
  );

  return { roster, addMember };
}

function TeamMemberStealthSelect({
  label,
  value,
  onCommit,
  roster,
}: {
  label: string;
  value: string | null;
  onCommit: (next: string | null) => void;
  roster: string[];
}) {
  const current = value ?? "";
  const match = roster.find((r) => r.toLowerCase() === current.toLowerCase());
  const inRoster = Boolean(match);
  const selectValue = inRoster ? match! : current ? `__saved:${current}` : "";

  return (
    <GrayRow>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm font-medium text-text-secondary">{label}</span>
        <select
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") {
              onCommit(null);
              return;
            }
            if (v.startsWith("__saved:")) return;
            onCommit(v);
          }}
          className={stealthSelectClass}
        >
          <option value="">Unassigned</option>
          {roster.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {!inRoster && current ? (
            <option value={`__saved:${current}`}>{current} (saved)</option>
          ) : null}
        </select>
      </div>
    </GrayRow>
  );
}

function patchSampleOnProject(
  project: Project,
  colorwayId: number,
  sampleId: number,
  partial: Partial<Sample>,
): Partial<Project> {
  return {
    colorways: project.colorways.map((cw) =>
      cw.id !== colorwayId
        ? cw
        : {
            ...cw,
            samples: cw.samples.map((s) => (s.id === sampleId ? { ...s, ...partial } : s)),
          },
    ),
  };
}

const SAMPLE_STATUS_OPTIONS: SampleStatus[] = [
  "PENDING",
  "RECEIVED",
  "APPROVED",
  "REJECTED",
  "IN REVIEW",
];

export type ProjectPatchFn = (patch: Partial<Project>) => void;

function CostingOverviewSection({
  title,
  project,
  patch,
}: {
  title: string;
  project: Project;
  patch?: ProjectPatchFn;
}) {
  if (!patch) {
    return (
      <SectionCard title={title}>
        <DateRow label="Quote requested" value={formatShortDate(project.quote_requested_date)} />
        <DateRow label="Vendor costing received" value={formatShortDate(project.vendor_costing_received_date)} />
        <DateRow label="Cost sheet prepared" value={formatShortDate(project.cost_sheet_prepared_date)} />
        <DateRow label="Estimate sent" value={formatShortDate(project.estimate_sent_date)} />
        {costingToggleRow(project.costing_approved)}
      </SectionCard>
    );
  }
  const save = patch;
  return (
    <SectionCard title={title}>
      <StealthDateRow
        label="Quote requested"
        value={project.quote_requested_date}
        onCommit={(iso) => save({ quote_requested_date: iso })}
      />
      <StealthDateRow
        label="Vendor costing received"
        value={project.vendor_costing_received_date}
        onCommit={(iso) => save({ vendor_costing_received_date: iso })}
      />
      <StealthDateRow
        label="Cost sheet prepared"
        value={project.cost_sheet_prepared_date}
        onCommit={(iso) => save({ cost_sheet_prepared_date: iso })}
      />
      <StealthDateRow
        label="Estimate sent"
        value={project.estimate_sent_date}
        onCommit={(iso) => save({ estimate_sent_date: iso })}
      />
      <StealthCostingApprovedRow value={project.costing_approved} onChange={(v) => save({ costing_approved: v })} />
    </SectionCard>
  );
}

function AddRepeatSectionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-dashed border-accent/45 bg-white py-2.5 text-sm font-semibold text-accent hover:bg-violet-50/90"
    >
      {children}
    </button>
  );
}

function RepeatableDyeCostingSections({
  headingBase,
  project,
  patch,
  vendors,
}: {
  headingBase: string;
  project: Project;
  patch?: ProjectPatchFn;
  vendors: Contact[];
}) {
  const tracks = resolveDyeCostingTracks(project);
  const save = patch;

  if (!save) {
    return (
      <>
        {tracks.map((t, i) => (
          <SectionCard key={t.id} title={tracks.length > 1 ? `${headingBase} · Line ${i + 1}` : headingBase}>
            {t.dye_vendor ? <VendorRow label="Vendor" name={t.dye_vendor} /> : <AddVendorPlaceholder />}
            <DateRow label="Lab dip requested" value={formatShortDate(t.lab_dip_request_date)} />
            <DateRow label="Lab dip due" value={formatShortDate(t.lab_dip_due_date)} />
            <DateRow label="Lab dip received" value={formatShortDate(t.lab_dip_received_date)} />
            <GrayRow>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-primary">Lab dip status</span>
                {approvalPill(t.lab_dip_approval_status)}
              </div>
            </GrayRow>
          </SectionCard>
        ))}
      </>
    );
  }

  return (
    <>
      {tracks.map((t, i) => (
        <SectionCard
          key={t.id}
          title={tracks.length > 1 ? `${headingBase} · Line ${i + 1}` : headingBase}
          headerExtra={
            tracks.length > 1 ? (
              <button
                type="button"
                onClick={() => save({ dye_costing_tracks: tracks.filter((x) => x.id !== t.id) })}
                className="text-[11px] font-semibold text-red-600 hover:underline"
              >
                Remove
              </button>
            ) : undefined
          }
        >
          <VendorStealthSelect
            label="Vendor"
            vendors={vendors}
            value={t.dye_vendor}
            onCommit={(v) => save({ dye_costing_tracks: updateDyeTrack(tracks, t.id, { dye_vendor: v }) })}
          />
          <StealthDateRow
            label="Lab dip requested"
            value={t.lab_dip_request_date}
            onCommit={(iso) =>
              save({ dye_costing_tracks: updateDyeTrack(tracks, t.id, { lab_dip_request_date: iso }) })
            }
          />
          <StealthDateRow
            label="Lab dip due"
            value={t.lab_dip_due_date}
            onCommit={(iso) => save({ dye_costing_tracks: updateDyeTrack(tracks, t.id, { lab_dip_due_date: iso }) })}
          />
          <StealthDateRow
            label="Lab dip received"
            value={t.lab_dip_received_date}
            onCommit={(iso) =>
              save({ dye_costing_tracks: updateDyeTrack(tracks, t.id, { lab_dip_received_date: iso }) })
            }
          />
          <StealthApprovalSelect
            label="Lab dip status"
            value={t.lab_dip_approval_status}
            onChange={(next) =>
              save({ dye_costing_tracks: updateDyeTrack(tracks, t.id, { lab_dip_approval_status: next }) })
            }
          />
        </SectionCard>
      ))}
      <AddRepeatSectionButton onClick={() => save({ dye_costing_tracks: [...tracks, defaultDyeCostingTrack()] })}>
        + Add dye line
      </AddRepeatSectionButton>
    </>
  );
}

function RepeatablePrintEmbroiderySections({
  headingBase,
  project,
  patch,
  vendors,
}: {
  headingBase: string;
  project: Project;
  patch?: ProjectPatchFn;
  vendors: Contact[];
}) {
  const tracks = resolvePrintEmbroideryTracks(project);
  const save = patch;

  if (!save) {
    return (
      <>
        {tracks.map((t, i) => (
          <SectionCard key={t.id} title={tracks.length > 1 ? `${headingBase} · Line ${i + 1}` : headingBase}>
            {t.print_embroidery_vendor ? (
              <VendorRow label="Vendor" name={t.print_embroidery_vendor} />
            ) : (
              <AddVendorPlaceholder />
            )}
            <DateRow label="Strike off requested" value={formatShortDate(t.strike_off_request_date)} />
            <DateRow label="Strike off due" value={formatShortDate(t.strike_off_due_date)} />
            <DateRow label="Strike off received" value={formatShortDate(t.strike_off_received_date)} />
            <GrayRow>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-primary">Strike off status</span>
                {approvalPill(t.strike_off_approval_status)}
              </div>
            </GrayRow>
          </SectionCard>
        ))}
      </>
    );
  }

  return (
    <>
      {tracks.map((t, i) => (
        <SectionCard
          key={t.id}
          title={tracks.length > 1 ? `${headingBase} · Line ${i + 1}` : headingBase}
          headerExtra={
            tracks.length > 1 ? (
              <button
                type="button"
                onClick={() =>
                  save({ print_embroidery_costing_tracks: tracks.filter((x) => x.id !== t.id) })
                }
                className="text-[11px] font-semibold text-red-600 hover:underline"
              >
                Remove
              </button>
            ) : undefined
          }
        >
          <VendorStealthSelect
            label="Vendor"
            vendors={vendors}
            value={t.print_embroidery_vendor}
            onCommit={(v) =>
              save({
                print_embroidery_costing_tracks: updatePrintEmbTrack(tracks, t.id, {
                  print_embroidery_vendor: v,
                }),
              })
            }
          />
          <StealthDateRow
            label="Strike off requested"
            value={t.strike_off_request_date}
            onCommit={(iso) =>
              save({
                print_embroidery_costing_tracks: updatePrintEmbTrack(tracks, t.id, {
                  strike_off_request_date: iso,
                }),
              })
            }
          />
          <StealthDateRow
            label="Strike off due"
            value={t.strike_off_due_date}
            onCommit={(iso) =>
              save({
                print_embroidery_costing_tracks: updatePrintEmbTrack(tracks, t.id, { strike_off_due_date: iso }),
              })
            }
          />
          <StealthDateRow
            label="Strike off received"
            value={t.strike_off_received_date}
            onCommit={(iso) =>
              save({
                print_embroidery_costing_tracks: updatePrintEmbTrack(tracks, t.id, {
                  strike_off_received_date: iso,
                }),
              })
            }
          />
          <StealthApprovalSelect
            label="Strike off status"
            value={t.strike_off_approval_status}
            onChange={(next) =>
              save({
                print_embroidery_costing_tracks: updatePrintEmbTrack(tracks, t.id, {
                  strike_off_approval_status: next,
                }),
              })
            }
          />
        </SectionCard>
      ))}
      <AddRepeatSectionButton
        onClick={() =>
          save({ print_embroidery_costing_tracks: [...tracks, defaultPrintEmbroideryTrack()] })
        }
      >
        + Add print / embroidery line
      </AddRepeatSectionButton>
    </>
  );
}

function RepeatableCostingExtraSections({
  project,
  patch,
  vendors,
}: {
  project: Project;
  patch?: ProjectPatchFn;
  vendors: Contact[];
}) {
  const tracks = resolveCostingExtraTracks(project);
  const save = patch;

  if (!save && tracks.length === 0) return null;

  if (!save) {
    return (
      <>
        {tracks.map((t) => (
          <SectionCard key={t.id} title={t.section_title}>
            {t.vendor_name ? <VendorRow label="Vendor" name={t.vendor_name} /> : null}
            <DateRow label="Milestone 1" value={formatShortDate(t.milestone_1_date)} />
            <DateRow label="Milestone 2" value={formatShortDate(t.milestone_2_date)} />
            <DateRow label="Milestone 3" value={formatShortDate(t.milestone_3_date)} />
            <GrayRow>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-text-primary">Approval</span>
                {approvalPill(t.approval_status)}
              </div>
            </GrayRow>
          </SectionCard>
        ))}
      </>
    );
  }

  return (
    <>
      {tracks.map((t, i) => (
        <SectionCard
          key={t.id}
          title={tracks.length > 1 ? `Extra costing · ${i + 1}` : "Extra costing"}
          headerExtra={
            <button
              type="button"
              onClick={() => save({ costing_extra_tracks: tracks.filter((x) => x.id !== t.id) })}
              className="text-[11px] font-semibold text-red-600 hover:underline"
            >
              Remove
            </button>
          }
        >
          <StealthMetaField
            label="Section heading"
            value={t.section_title}
            placeholder="e.g. Trims / Freight quote"
            onCommit={(v) =>
              save({
                costing_extra_tracks: updateCostingExtraTrack(tracks, t.id, {
                  section_title: v?.trim() ? v.trim() : "Additional costing",
                }),
              })
            }
          />
          <VendorStealthSelect
            label="Vendor"
            vendors={vendors}
            value={t.vendor_name}
            onCommit={(v) =>
              save({ costing_extra_tracks: updateCostingExtraTrack(tracks, t.id, { vendor_name: v }) })
            }
          />
          <StealthDateRow
            label="Milestone 1"
            value={t.milestone_1_date}
            onCommit={(iso) =>
              save({ costing_extra_tracks: updateCostingExtraTrack(tracks, t.id, { milestone_1_date: iso }) })
            }
          />
          <StealthDateRow
            label="Milestone 2"
            value={t.milestone_2_date}
            onCommit={(iso) =>
              save({ costing_extra_tracks: updateCostingExtraTrack(tracks, t.id, { milestone_2_date: iso }) })
            }
          />
          <StealthDateRow
            label="Milestone 3"
            value={t.milestone_3_date}
            onCommit={(iso) =>
              save({ costing_extra_tracks: updateCostingExtraTrack(tracks, t.id, { milestone_3_date: iso }) })
            }
          />
          <StealthApprovalSelect
            label="Approval"
            value={t.approval_status}
            onChange={(next) =>
              save({ costing_extra_tracks: updateCostingExtraTrack(tracks, t.id, { approval_status: next }) })
            }
          />
        </SectionCard>
      ))}
      <AddRepeatSectionButton
        onClick={() => save({ costing_extra_tracks: [...tracks, defaultCostingExtraTrack()] })}
      >
        + Add costing section
      </AddRepeatSectionButton>
    </>
  );
}

function RepeatableBulkApprovalSections({
  title,
  project,
  patch,
}: {
  title: string;
  project: Project;
  patch?: ProjectPatchFn;
}) {
  const tracks = resolveBulkProductionTracks(project);
  const save = patch;

  if (!save) {
    return (
      <>
        {tracks.map((t, i) => (
          <SectionCard key={t.id} title={tracks.length > 1 ? `${title} · ${t.title}` : title}>
            <DateRow label="Bulk fabric approved" value={formatShortDate(t.bulk_fabric_approval_date)} />
            <DateRow label="Bulk trim approved" value={formatShortDate(t.bulk_trim_approval_date)} />
            <DateRow label="TOP due" value={formatShortDate(t.top_due_date)} />
            <DateRow label="TOP approved" value={formatShortDate(t.top_approved_date)} />
          </SectionCard>
        ))}
      </>
    );
  }

  return (
    <>
      {tracks.map((t, i) => (
        <SectionCard
          key={t.id}
          title={tracks.length > 1 ? `${title} · ${t.title}` : title}
          headerExtra={
            tracks.length > 1 ? (
              <button
                type="button"
                onClick={() => save({ bulk_production_tracks: tracks.filter((x) => x.id !== t.id) })}
                className="text-[11px] font-semibold text-red-600 hover:underline"
              >
                Remove schedule
              </button>
            ) : undefined
          }
        >
          <StealthMetaField
            label="Schedule name"
            value={t.title}
            placeholder="e.g. Bulk drop 2"
            onCommit={(v) =>
              save({
                bulk_production_tracks: updateBulkTrack(tracks, t.id, {
                  title: v?.trim() ? v.trim() : `Schedule ${i + 1}`,
                }),
              })
            }
          />
          <StealthDateRow
            label="Bulk fabric approved"
            value={t.bulk_fabric_approval_date}
            onCommit={(iso) =>
              save({
                bulk_production_tracks: updateBulkTrack(tracks, t.id, { bulk_fabric_approval_date: iso }),
              })
            }
          />
          <StealthDateRow
            label="Bulk trim approved"
            value={t.bulk_trim_approval_date}
            onCommit={(iso) =>
              save({
                bulk_production_tracks: updateBulkTrack(tracks, t.id, { bulk_trim_approval_date: iso }),
              })
            }
          />
          <StealthDateRow
            label="TOP due"
            value={t.top_due_date}
            onCommit={(iso) =>
              save({
                bulk_production_tracks: updateBulkTrack(tracks, t.id, { top_due_date: iso }),
              })
            }
          />
          <StealthDateRow
            label="TOP approved"
            value={t.top_approved_date}
            onCommit={(iso) =>
              save({
                bulk_production_tracks: updateBulkTrack(tracks, t.id, { top_approved_date: iso }),
              })
            }
          />
        </SectionCard>
      ))}
      <AddRepeatSectionButton
        onClick={() => {
          const n = tracks.length + 1;
          save({
            bulk_production_tracks: [...tracks, defaultBulkProductionTrack(`Production schedule ${n}`)],
          });
        }}
      >
        + Add bulk approval schedule
      </AddRepeatSectionButton>
    </>
  );
}

export function ProjectDetailsClientCard({
  project,
  onPatchProject,
}: {
  project: Project;
  onPatchProject?: (patch: Partial<Project>) => void;
}) {
  const initials = clientInitials(project.client.name);
  const pn = project.project_number?.trim();
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">Client</p>
      <div className="mt-4 flex flex-wrap items-start gap-4">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-accent text-lg font-bold text-white shadow-inner"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-primary md:text-2xl">{project.client.name}</h2>
            {pn ? <p className="mt-1 text-sm font-medium text-text-secondary">{pn}</p> : null}
          </div>
          <dl className="grid max-w-lg gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,7.5rem)_1fr]">
            <dt className="text-text-secondary">Hand off</dt>
            <dd className="font-medium text-text-primary">{formatShortDate(project.project_hand_off_date)}</dd>
            <dt className="text-text-secondary">Due date</dt>
            <dd className="font-medium text-text-primary">{formatShortDate(project.due_date)}</dd>
            <dt className="text-text-secondary">Status overview</dt>
            <dd className="font-medium text-text-primary">{project.status_overview ?? "—"}</dd>
            <dt className="text-text-secondary">Status update</dt>
            <dd className="font-medium text-text-primary">{formatShortDate(project.status_update_date)}</dd>
            <dt className="text-text-secondary">Scope</dt>
            <dd className="font-medium text-text-primary">
              {onPatchProject ? (
                <select
                  className="rounded-lg border border-border-light bg-white px-2 py-1 text-sm font-semibold"
                  value={project.scope_kind ?? "original"}
                  onChange={(e) =>
                    onPatchProject({
                      scope_kind: e.target.value as "original" | "addon",
                    })
                  }
                >
                  <option value="original">Original deliverable</option>
                  <option value="addon">Reorder</option>
                </select>
              ) : project.scope_kind === "addon" ? (
                "Reorder"
              ) : (
                "Original deliverable"
              )}
            </dd>
          </dl>
          {onPatchProject && project.scope_kind === "addon" ? (
            <label className="mt-4 block text-sm">
              <span className="font-medium text-text-secondary">Scope note</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm"
                rows={2}
                value={project.scope_note ?? ""}
                onChange={(e) => onPatchProject({ scope_note: e.target.value || null })}
                placeholder="Reorder details"
              />
            </label>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function InternalTeamRosterEditor({ onAdd }: { onAdd: (name: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <SectionCard title="Team roster">
      <p className="text-xs text-text-secondary">
        Add teammates for this project — they appear in every Internal assignment menu below. You can also add people from{" "}
        <strong className="font-semibold text-text-primary">People → Team</strong>.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(draft);
          setDraft("");
        }}
      >
        <label className="min-w-[12rem] flex-1">
          <span className="text-xs font-medium text-text-secondary">New team member</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Jamie Chen"
            className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
        <button
          type="submit"
          className="shrink-0 rounded-xl border-2 border-dashed border-accent/40 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50"
        >
          Add to roster
        </button>
      </form>
    </SectionCard>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <GrayRow>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <span className="text-sm font-semibold text-text-primary">{value}</span>
      </div>
    </GrayRow>
  );
}

export function InternalDevelopmentPanel({
  project,
  onPatchProject,
}: {
  project: Project;
  onPatchProject?: ProjectPatchFn;
}) {
  const p = onPatchProject;
  const { roster, addMember } = useInternalTeamRoster(project.id);
  return (
    <PanelShell hint={p ? <EditPersistHint /> : undefined}>
      {p ? <InternalTeamRosterEditor onAdd={addMember} /> : null}
      <SectionCard title="Team assignments">
        {!p ? (
          <>
            <MetaRow label="Lead team member" value={project.lead_team_member ?? "—"} />
            <MetaRow label="Dev & prod assigned" value={project.dev_prod_assigned_team_member ?? "—"} />
          </>
        ) : (
          <>
            <TeamMemberStealthSelect
              roster={roster}
              label="Lead team member"
              value={project.lead_team_member}
              onCommit={(v) => p({ lead_team_member: v })}
            />
            <TeamMemberStealthSelect
              roster={roster}
              label="Dev & prod assigned"
              value={project.dev_prod_assigned_team_member}
              onCommit={(v) => p({ dev_prod_assigned_team_member: v })}
            />
          </>
        )}
      </SectionCard>
      <SectionCard title="Project timeline">
        {!p ? (
          <>
            <DateRow label="Client meeting / handover" value={formatShortDate(project.client_meeting_date)} />
            <DateRow label="Client assets received" value={formatShortDate(project.client_assets_received_date)} />
            <DateRow label="TP sent to factory" value={formatShortDate(project.tp_sent_date)} />
            <DateRow label="References sent to factory" value={formatShortDate(project.references_sent_date)} />
          </>
        ) : (
          <>
            <StealthDateRow
              label="Client meeting / handover"
              value={project.client_meeting_date}
              onCommit={(iso) => p({ client_meeting_date: iso })}
            />
            <StealthDateRow
              label="Client assets received"
              value={project.client_assets_received_date}
              onCommit={(iso) => p({ client_assets_received_date: iso })}
            />
            <StealthDateRow
              label="TP sent to factory"
              value={project.tp_sent_date}
              onCommit={(iso) => p({ tp_sent_date: iso })}
            />
            <StealthDateRow
              label="References sent to factory"
              value={project.references_sent_date}
              onCommit={(iso) => p({ references_sent_date: iso })}
            />
          </>
        )}
      </SectionCard>
      <SectionCard title="C&S tech pack">
        {!p ? (
          <>
            <MetaRow label="Assigned to" value={project.cs_tech_pack_assigned_member ?? "—"} />
            <DateRow label="Request date" value={formatShortDate(project.cs_tech_pack_request_date)} />
            <DateRow label="Due date" value={formatShortDate(project.cs_tech_pack_due_date)} />
            <DateRow label="Complete date" value={formatShortDate(project.cs_tech_pack_complete_date)} />
          </>
        ) : (
          <>
            <TeamMemberStealthSelect
              roster={roster}
              label="Assigned to"
              value={project.cs_tech_pack_assigned_member}
              onCommit={(v) => p({ cs_tech_pack_assigned_member: v })}
            />
            <StealthDateRow
              label="Request date"
              value={project.cs_tech_pack_request_date}
              onCommit={(iso) => p({ cs_tech_pack_request_date: iso })}
            />
            <StealthDateRow
              label="Due date"
              value={project.cs_tech_pack_due_date}
              onCommit={(iso) => p({ cs_tech_pack_due_date: iso })}
            />
            <StealthDateRow
              label="Complete date"
              value={project.cs_tech_pack_complete_date}
              onCommit={(iso) => p({ cs_tech_pack_complete_date: iso })}
            />
          </>
        )}
      </SectionCard>
      <SectionCard title="Artwork tech pack">
        {!p ? (
          <>
            <MetaRow label="Assigned to" value={project.artwork_tech_pack_assigned_member ?? "—"} />
            <DateRow label="Request date" value={formatShortDate(project.artwork_tech_pack_request_date)} />
            <DateRow label="Due date" value={formatShortDate(project.artwork_tech_pack_due_date)} />
            <DateRow label="Complete date" value={formatShortDate(project.artwork_tech_pack_complete_date)} />
            <DateRow label="Client approval" value={formatShortDate(project.artwork_design_client_approval_date)} />
          </>
        ) : (
          <>
            <TeamMemberStealthSelect
              roster={roster}
              label="Assigned to"
              value={project.artwork_tech_pack_assigned_member}
              onCommit={(v) => p({ artwork_tech_pack_assigned_member: v })}
            />
            <StealthDateRow
              label="Request date"
              value={project.artwork_tech_pack_request_date}
              onCommit={(iso) => p({ artwork_tech_pack_request_date: iso })}
            />
            <StealthDateRow
              label="Due date"
              value={project.artwork_tech_pack_due_date}
              onCommit={(iso) => p({ artwork_tech_pack_due_date: iso })}
            />
            <StealthDateRow
              label="Complete date"
              value={project.artwork_tech_pack_complete_date}
              onCommit={(iso) => p({ artwork_tech_pack_complete_date: iso })}
            />
            <StealthDateRow
              label="Client approval"
              value={project.artwork_design_client_approval_date}
              onCommit={(iso) => p({ artwork_design_client_approval_date: iso })}
            />
          </>
        )}
      </SectionCard>
    </PanelShell>
  );
}

function PaymentsPanel({ project }: { project: Project }) {
  return (
    <PanelShell>
      <SectionCard title="Payment processors">
        <p className="text-sm text-text-secondary">
          Connect a processor to send payment links and record deposits against this project.
        </p>
        <GrayRow>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-text-primary">Stripe</span>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600">
              Not connected
            </span>
          </div>
        </GrayRow>
        <GrayRow>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-text-primary">PayPal</span>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600">
              Not connected
            </span>
          </div>
        </GrayRow>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-semibold text-slate-400"
        >
          Connect payment processor — coming soon
        </button>
      </SectionCard>
      <SectionCard title="Payment history">
        <p className="text-xs text-text-secondary">Project: {project.name}</p>
        <div className="flex flex-col items-center py-8 text-center">
          <p className="text-lg font-semibold text-text-primary">No payments yet</p>
          <p className="mt-2 max-w-sm text-sm text-text-secondary">
            When a processor is connected, client payments for this project will show here.
          </p>
          <p className="mt-4 text-sm font-semibold text-text-secondary">$0.00 collected</p>
        </div>
      </SectionCard>
    </PanelShell>
  );
}

function InvoicesPanel({ project }: { project: Project }) {
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const peopleOptions = useMemo(() => {
    const names = new Set<string>();
    if (project.lead_team_member) names.add(project.lead_team_member);
    if (project.lead_vendor) names.add(project.lead_vendor);
    return ["all", ...Array.from(names)];
  }, [project.lead_team_member, project.lead_vendor]);

  const invoiceSections = ["Bulk invoices", "Sample invoices", "Tech pack / artwork"] as const;
  const filteredSections =
    typeFilter === "all"
      ? invoiceSections
      : invoiceSections.filter((t) => t.toLowerCase().includes(typeFilter.replace("_", " ")));

  return (
    <PanelShell>
      {project.po_number ? <PoInvoiceBanner poNumber={project.po_number} /> : null}
      <SectionCard title="Filters">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-text-secondary">
            People
            <select
              className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm"
              value={peopleFilter}
              onChange={(e) => setPeopleFilter(e.target.value)}
            >
              {peopleOptions.map((p) => (
                <option key={p} value={p}>
                  {p === "all" ? "All people" : p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-text-secondary">
            Invoice type
            <select
              className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              <option value="bulk">Bulk</option>
              <option value="sample">Sample</option>
              <option value="tech">Tech pack / artwork</option>
            </select>
          </label>
        </div>
      </SectionCard>
      <SectionCard title="Invoice summary">
        <div className="grid gap-3 sm:grid-cols-3">
          <GrayRow>
            <p className="text-xs text-text-secondary">Total</p>
            <p className="text-2xl font-bold text-text-primary">0</p>
          </GrayRow>
          <GrayRow>
            <p className="text-xs text-text-secondary">Paid</p>
            <p className="text-2xl font-bold text-emerald-700">0</p>
          </GrayRow>
          <GrayRow>
            <p className="text-xs text-text-secondary">Open</p>
            <p className="text-2xl font-bold text-amber-700">0</p>
          </GrayRow>
        </div>
      </SectionCard>
      {filteredSections.map((title) => (
        <SectionCard key={title} title={title}>
          <p className="text-sm text-text-secondary">
            No invoices yet for {project.name}
            {peopleFilter !== "all" ? ` · filtered to ${peopleFilter}` : ""}.
          </p>
          <button
            type="button"
            className="mt-4 w-full rounded-xl border-2 border-dashed border-accent/40 py-3 text-sm font-semibold text-accent hover:bg-violet-50"
          >
            + Create invoice
          </button>
        </SectionCard>
      ))}
    </PanelShell>
  );
}

function ApprovalsPanel({ project, onPatchProject }: { project: Project; onPatchProject?: ProjectPatchFn }) {
  const p = onPatchProject;
  const vendors = useProjectVendors();
  return (
    <PanelShell hint={p ? <EditPersistHint /> : undefined}>
      <CostingOverviewSection title="Costing approvals" project={project} patch={p} />
      <RepeatableDyeCostingSections headingBase="Dye approvals" project={project} patch={p} vendors={vendors} />
      <RepeatablePrintEmbroiderySections
        headingBase="Print / embroidery / decoration"
        project={project}
        patch={p}
        vendors={vendors}
      />
      <RepeatableBulkApprovalSections title="Bulk production approvals" project={project} patch={p} />
    </PanelShell>
  );
}

function CostingPanel({ project, onPatchProject }: { project: Project; onPatchProject?: ProjectPatchFn }) {
  const p = onPatchProject;
  const vendors = useProjectVendors();
  return (
    <PanelShell hint={p ? <EditPersistHint /> : undefined}>
      <CostingOverviewSection title="Costing overview" project={project} patch={p} />
      <RepeatableDyeCostingSections headingBase="Dyes" project={project} patch={p} vendors={vendors} />
      <RepeatablePrintEmbroiderySections
        headingBase="Print / embroidery / decoration"
        project={project}
        patch={p}
        vendors={vendors}
      />
      <RepeatableCostingExtraSections project={project} patch={p} vendors={vendors} />
    </PanelShell>
  );
}

function sampleSummary(s: Sample) {
  return `${s.type} · ${s.status}`;
}

function CsPanel({ project, onPatchProject }: { project: Project; onPatchProject?: ProjectPatchFn }) {
  const p = onPatchProject;
  const [selectedId, setSelectedId] = useState<number | "all">(
    project.colorways[0]?.id ?? "all",
  );

  if (project.colorways.length === 0) {
    return (
      <PanelShell hint={p ? <EditPersistHint /> : undefined}>
        <p className="text-sm text-text-secondary">No colorways on this project yet.</p>
        {p ? (
          <AddRepeatSectionButton
            onClick={() => {
              p({ colorways: [{ id: 1, name: "Colorway 1", samples: [] }] });
              setSelectedId(1);
            }}
          >
            + Add another
          </AddRepeatSectionButton>
        ) : null}
      </PanelShell>
    );
  }

  const visible =
    selectedId === "all" ? project.colorways : project.colorways.filter((c) => c.id === selectedId);

  return (
    <PanelShell hint={p ? <EditPersistHint /> : undefined}>
      {p ? (
        <AddRepeatSectionButton
          onClick={() => {
            const maxId = project.colorways.reduce((m, c) => Math.max(m, c.id), 0);
            const next = {
              id: maxId + 1,
              name: `Colorway ${project.colorways.length + 1}`,
              samples: [] as Sample[],
            };
            p({ colorways: [...project.colorways, next] });
            setSelectedId(next.id);
          }}
        >
          + Add another
        </AddRepeatSectionButton>
      ) : null}
      <SectionCard title="Select colorway">
        <select
          className="w-full rounded-lg border border-border-light px-3 py-2.5 text-sm font-semibold text-text-primary"
          value={selectedId === "all" ? "all" : String(selectedId)}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedId(v === "all" ? "all" : Number(v));
          }}
        >
          <option value="all">All colorways</option>
          {project.colorways.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </SectionCard>
      {visible.map((cw) => (
        <SectionCard
          key={cw.id}
          title={cw.name}
          headerExtra={
            p && project.colorways.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  const nextCw = project.colorways.filter((c) => c.id !== cw.id);
                  p({ colorways: nextCw });
                  setSelectedId((prev) => {
                    if (prev !== cw.id) return prev;
                    return nextCw[0]?.id ?? "all";
                  });
                }}
                className="text-[11px] font-semibold text-red-600 hover:underline"
              >
                Remove
              </button>
            ) : undefined
          }
        >
          {p ? (
            <StealthMetaField
              label="Colorway name"
              value={cw.name}
              placeholder="Name"
              onCommit={(v) => {
                const name = v?.trim() || cw.name;
                p({
                  colorways: project.colorways.map((c) => (c.id === cw.id ? { ...c, name } : c)),
                });
              }}
            />
          ) : null}
          {cw.samples.length === 0 ? (
            <p className="text-sm text-text-secondary">No samples tracked for this colorway.</p>
          ) : (
            cw.samples.map((s) => (
              <GrayRow key={s.id}>
                <p className="text-sm font-semibold text-text-primary">{sampleSummary(s)}</p>
                {!p ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    Received: {formatShortDate(s.received_date)}
                  </p>
                ) : (
                  <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="min-w-0 flex-1 text-xs font-medium text-text-secondary">Received</span>
                      <input
                        type="date"
                        value={isoToDateInput(s.received_date)}
                        onChange={(e) => {
                          const ymd = e.target.value;
                          p(
                            patchSampleOnProject(project, cw.id, s.id, {
                              received_date: ymd ? dateInputToIso(ymd) : null,
                            }),
                          );
                        }}
                        className={stealthDateInputClass}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="min-w-0 flex-1 text-xs font-medium text-text-secondary">Comments sent</span>
                      <input
                        type="date"
                        value={isoToDateInput(s.comments_sent_date)}
                        onChange={(e) => {
                          const ymd = e.target.value;
                          p(
                            patchSampleOnProject(project, cw.id, s.id, {
                              comments_sent_date: ymd ? dateInputToIso(ymd) : null,
                            }),
                          );
                        }}
                        className={stealthDateInputClass}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="min-w-0 flex-1 text-xs font-medium text-text-secondary">Status</span>
                      <select
                        value={s.status}
                        onChange={(e) =>
                          p(
                            patchSampleOnProject(project, cw.id, s.id, {
                              status: e.target.value as SampleStatus,
                            }),
                          )
                        }
                        className={stealthSelectClass}
                      >
                        {SAMPLE_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="block">
                      <span className="text-xs font-medium text-text-secondary">Comments</span>
                      <textarea
                        value={s.comments ?? ""}
                        placeholder="Notes…"
                        onChange={(e) =>
                          p(
                            patchSampleOnProject(project, cw.id, s.id, {
                              comments: e.target.value === "" ? null : e.target.value,
                            }),
                          )
                        }
                        className={stealthTextareaClass}
                        rows={3}
                      />
                    </label>
                  </div>
                )}
              </GrayRow>
            ))
          )}
        </SectionCard>
      ))}
    </PanelShell>
  );
}

function BulkProductionPanel({ project, onPatchProject }: { project: Project; onPatchProject?: ProjectPatchFn }) {
  const p = onPatchProject;
  const tracks = resolveBulkProductionTracks(project);

  function packingHintFromExFactory(iso: string | null): string | null {
    const ex = iso ? new Date(iso).getTime() : null;
    if (ex == null || Number.isNaN(ex)) return null;
    return new Date(ex - 7 * 86400000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (!p) {
    return (
      <PanelShell>
        {tracks.map((t) => {
          const hint = packingHintFromExFactory(t.ex_factory_date);
          return (
            <div key={t.id} className="space-y-5">
              <SectionCard title={tracks.length > 1 ? t.title : "Bulk production"}>
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Production approvals
                  </p>
                  <DateRow label="Bulk fabric approval" value={formatShortDate(t.bulk_fabric_approval_date)} />
                  <DateRow label="Bulk trim approval" value={formatShortDate(t.bulk_trim_approval_date)} />
                  <DateRow label="New product request" value={formatShortDate(t.new_product_request_date)} />
                  <DateRow label="Barcodes sent to vendor" value={formatShortDate(t.barcodes_sent_to_vendor_date)} />
                </div>
                <div className="space-y-3 border-t border-border-light pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">TOP sample</p>
                  <DateRow label="TOP due" value={formatShortDate(t.top_due_date)} />
                  <DateRow label="TOP approved" value={formatShortDate(t.top_approved_date)} />
                </div>
                <div className="space-y-3 border-t border-border-light pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                    Delivery schedule
                  </p>
                  <DateRow label="Bulk target delivery" value={formatShortDate(t.bulk_target_delivery_date)} />
                  <DateRow label="Ex-factory date" value={formatShortDate(t.ex_factory_date)} />
                </div>
              </SectionCard>
              {hint ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5">
                  <p className="text-sm font-semibold text-blue-900">Auto-calculation</p>
                  <p className="mt-2 text-sm text-blue-800/90">
                    Packing list target ~1 week before ex-factory: <span className="font-bold">{hint}</span>
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </PanelShell>
    );
  }

  const save = p;
  return (
    <PanelShell hint={<EditPersistHint />}>
      {tracks.map((t, i) => {
        const hint = packingHintFromExFactory(t.ex_factory_date);
        return (
          <div key={t.id} className="space-y-5">
            <SectionCard
              title={tracks.length > 1 ? t.title : "Bulk production"}
              headerExtra={
                tracks.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => save({ bulk_production_tracks: tracks.filter((x) => x.id !== t.id) })}
                    className="text-[11px] font-semibold text-red-600 hover:underline"
                  >
                    Remove schedule
                  </button>
                ) : undefined
              }
            >
              <StealthMetaField
                label="Schedule name"
                value={t.title}
                placeholder={`Production schedule ${i + 1}`}
                onCommit={(v) =>
                  save({
                    bulk_production_tracks: updateBulkTrack(tracks, t.id, {
                      title: v?.trim() ? v.trim() : `Schedule ${i + 1}`,
                    }),
                  })
                }
              />
              <div className="space-y-3 border-t border-border-light pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  Production approvals
                </p>
                <StealthDateRow
                  label="Bulk fabric approval"
                  value={t.bulk_fabric_approval_date}
                  onCommit={(iso) =>
                    save({
                      bulk_production_tracks: updateBulkTrack(tracks, t.id, { bulk_fabric_approval_date: iso }),
                    })
                  }
                />
                <StealthDateRow
                  label="Bulk trim approval"
                  value={t.bulk_trim_approval_date}
                  onCommit={(iso) =>
                    save({
                      bulk_production_tracks: updateBulkTrack(tracks, t.id, { bulk_trim_approval_date: iso }),
                    })
                  }
                />
                <StealthDateRow
                  label="New product request"
                  value={t.new_product_request_date}
                  onCommit={(iso) =>
                    save({
                      bulk_production_tracks: updateBulkTrack(tracks, t.id, { new_product_request_date: iso }),
                    })
                  }
                />
                <StealthDateRow
                  label="Barcodes sent to vendor"
                  value={t.barcodes_sent_to_vendor_date}
                  onCommit={(iso) =>
                    save({
                      bulk_production_tracks: updateBulkTrack(tracks, t.id, {
                        barcodes_sent_to_vendor_date: iso,
                      }),
                    })
                  }
                />
              </div>
              <div className="space-y-3 border-t border-border-light pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">TOP sample</p>
                <StealthDateRow
                  label="TOP due"
                  value={t.top_due_date}
                  onCommit={(iso) =>
                    save({
                      bulk_production_tracks: updateBulkTrack(tracks, t.id, { top_due_date: iso }),
                    })
                  }
                />
                <StealthDateRow
                  label="TOP approved"
                  value={t.top_approved_date}
                  onCommit={(iso) =>
                    save({
                      bulk_production_tracks: updateBulkTrack(tracks, t.id, { top_approved_date: iso }),
                    })
                  }
                />
              </div>
              <div className="space-y-3 border-t border-border-light pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  Delivery schedule
                </p>
                <StealthDateRow
                  label="Bulk target delivery"
                  value={t.bulk_target_delivery_date}
                  onCommit={(iso) =>
                    save({
                      bulk_production_tracks: updateBulkTrack(tracks, t.id, {
                        bulk_target_delivery_date: iso,
                      }),
                    })
                  }
                />
                <StealthDateRow
                  label="Ex-factory date"
                  value={t.ex_factory_date}
                  onCommit={(iso) =>
                    save({
                      bulk_production_tracks: updateBulkTrack(tracks, t.id, { ex_factory_date: iso }),
                    })
                  }
                />
              </div>
            </SectionCard>
            {hint ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5">
                <p className="text-sm font-semibold text-blue-900">Auto-calculation</p>
                <p className="mt-2 text-sm text-blue-800/90">
                  Packing list target ~1 week before ex-factory: <span className="font-bold">{hint}</span>
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
      <AddRepeatSectionButton
        onClick={() => {
          const n = tracks.length + 1;
          save({
            bulk_production_tracks: [...tracks, defaultBulkProductionTrack(`Production schedule ${n}`)],
          });
        }}
      >
        + Add bulk production schedule
      </AddRepeatSectionButton>
    </PanelShell>
  );
}

function ShippingModulePanel({ project, onPatchProject }: { project: Project; onPatchProject?: ProjectPatchFn }) {
  const p = onPatchProject;
  const [sub, setSub] = useState<"shipping" | "receiving">("shipping");
  const termsDisplay = project.shipping_terms?.trim() || "FOB";
  const methodDisplay = project.shipping_method?.trim() || "Not set";

  return (
    <PanelShell hint={p ? <EditPersistHint /> : undefined}>
      <div className="flex max-w-md rounded-xl border border-border-light bg-surface-card p-1">
        {(["shipping", "receiving"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setSub(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide ${
              sub === k ? "bg-accent text-white shadow-sm" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      {sub === "shipping" ? (
        <>
          <SectionCard title="Shipping details">
            {!p ? (
              <>
                <MetaRow label="Shipping terms" value={termsDisplay} />
                <MetaRow label="Shipping method" value={methodDisplay} />
              </>
            ) : (
              <>
                <StealthTextRow
                  label="Shipping terms"
                  value={project.shipping_terms}
                  placeholder="FOB"
                  onCommit={(v) => p({ shipping_terms: v })}
                />
                <StealthTextRow
                  label="Shipping method"
                  value={project.shipping_method}
                  placeholder="e.g. Ocean freight"
                  onCommit={(v) => p({ shipping_method: v })}
                />
              </>
            )}
          </SectionCard>
          <SectionCard title="Packing list">
            {!p ? (
              <>
                <DateRow label="Packing list received" value={formatShortDate(project.packing_list_received_date)} />
                <DateRow label="Sent to client" value={formatShortDate(project.packing_list_sent_to_client_date)} />
              </>
            ) : (
              <>
                <StealthDateRow
                  label="Packing list received"
                  value={project.packing_list_received_date}
                  onCommit={(iso) => p({ packing_list_received_date: iso })}
                />
                <StealthDateRow
                  label="Sent to client"
                  value={project.packing_list_sent_to_client_date}
                  onCommit={(iso) => p({ packing_list_sent_to_client_date: iso })}
                />
              </>
            )}
          </SectionCard>
          <SectionCard title="Create packing list">
            {p ? (
              <PackingSlipSection project={project} onPatchProject={p} />
            ) : (
              <p className="text-sm text-text-secondary">
                {(project.packaging_slips?.length ?? 0) > 0
                  ? `${project.packaging_slips!.length} packing list(s) on file`
                  : "No packing lists created yet."}
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard title="Receiving">
          {!p ? (
            <>
              <MetaRow label="Tracking / BOL" value={project.tracking_bol_number ?? "—"} />
              <DateRow label="Client received" value={formatShortDate(project.client_received_date)} />
            </>
          ) : (
            <>
              <StealthTextRow
                label="Tracking / BOL"
                value={project.tracking_bol_number}
                placeholder="Number or reference"
                onCommit={(v) => p({ tracking_bol_number: v })}
              />
              <StealthDateRow
                label="Client received"
                value={project.client_received_date}
                onCommit={(iso) => p({ client_received_date: iso })}
              />
            </>
          )}
        </SectionCard>
      )}
    </PanelShell>
  );
}

type PeopleAccessFilter = PeopleSegment | "all";

const PEOPLE_FILTER_PILLS: { id: PeopleAccessFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "team", label: "Team" },
  { id: "client", label: "Clients" },
  { id: "vendor", label: "Vendors" },
];

function peopleFilterPillClass(active: boolean, filter: PeopleAccessFilter): string {
  const base =
    "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition";
  if (!active) {
    return `${base} bg-surface-card text-text-secondary ring-1 ring-border-light hover:text-text-primary`;
  }
  if (filter === "all") {
    return `${base} bg-accent text-white shadow-sm ring-1 ring-accent/40`;
  }
  return `${base} ${segmentPillSelectedClass(filter)}`;
}

export function ProjectPeopleAccessPanel({ project }: { project: Project }) {
  const { user, loading, refresh } = useCurrentUser();
  const { isTeamView } = useWorkspace();
  const canEditPermissions = canManageWorkspacePermissions(isTeamView);
  const [filter, setFilter] = useState<PeopleAccessFilter>("all");
  const [drafts, setDrafts] = useState<Record<PeopleSegment, ProjectPermissionFlags>>(() => mergeRoleDrafts(null));
  const [hydrated, setHydrated] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<ProjectPersonRow | null>(null);
  const [permRevision, setPermRevision] = useState(0);

  useEffect(() => {
    if (!isClientLiveBackend() || loading) return;
    void refresh().then(() => setPermRevision((n) => n + 1));
  }, [loading, refresh]);

  const projectPeople = useMemo(
    () =>
      peopleForProject(project, loadContacts(), {
        ownerContactId: user?.selfContactId,
        ownerEmail: user?.email,
        ownerFullName: user?.fullName,
        ownerAvatarUrl: user?.avatarUrl,
      }),
    [project, permRevision, user?.selfContactId, user?.email, user?.fullName, user?.avatarUrl],
  );
  const contacts = useMemo(() => loadContacts(), [permRevision]);
  const personSummaries = useMemo(() => {
    if (!hydrated) return new Map<string, { text: string; hasOverride: boolean }>();
    return new Map(
      projectPeople.map((p) => [
        p.key,
        personListPermissionSummary(project.id, p, contacts, drafts),
      ]),
    );
  }, [projectPeople, project.id, contacts, drafts, hydrated, permRevision]);

  const filteredPeople = useMemo(() => {
    if (filter === "all") return projectPeople;
    return projectPeople.filter((p) => p.segment === filter);
  }, [projectPeople, filter]);

  const segment: PeopleSegment = filter === "all" ? "team" : filter;

  useEffect(() => {
    if (isClientLiveBackend()) {
      setDrafts(mergeRoleDrafts(null));
    } else {
      const raw = readMockLs<Partial<Record<PeopleSegment, Partial<ProjectPermissionFlags>>>>(
        MOCK_LS.projectRolePermissions(project.id),
      );
      setDrafts(mergeRoleDrafts(raw));
    }
    setHydrated(true);
  }, [project.id]);

  useEffect(() => {
    if (!selectedPerson) return;
    if (filter === "all" || selectedPerson.segment === filter) return;
    setSelectedPerson(null);
  }, [filter, selectedPerson]);

  function save() {
    if (isClientLiveBackend()) return;
    writeMockLs(MOCK_LS.projectRolePermissions(project.id), drafts);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  const flags = drafts[segment];

  return (
    <PanelShell>
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">People &amp; access</h3>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Default capabilities for each workspace segment on{" "}
          <span className="font-semibold text-text-primary">{project.name}</span>. These apply to everyone in that
          segment on this project. Invites only send email — access is managed here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter people on project">
          {PEOPLE_FILTER_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              role="tab"
              aria-selected={filter === pill.id}
              onClick={() => setFilter(pill.id)}
              className={peopleFilterPillClass(filter === pill.id, pill.id)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </section>

      <SectionCard
        title="People on this project"
        headerExtra={
          <Link
            href="/people"
            className="text-xs font-semibold text-accent hover:underline"
          >
            Manage in People →
          </Link>
        }
      >
        {projectPeople.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No one is linked to this project yet. Assign leads on the Internal tab or add people from{" "}
            <Link href="/people" className="font-semibold text-accent hover:underline">
              People
            </Link>
            .
          </p>
        ) : filteredPeople.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No {filter === "all" ? "people" : segmentLabel(filter).toLowerCase()} on this project with the current
            filter.
          </p>
        ) : (
          <ul className="-mx-2 flex flex-col gap-3 py-2">
            {filteredPeople.map((person) => {
              const summary = personSummaries.get(person.key);
              return (
                <li key={person.key}>
                  <button
                    type="button"
                    onClick={() => setSelectedPerson(person)}
                    className="flex w-full gap-3 rounded-lg px-3 py-4 text-left transition hover:bg-surface-body/80"
                    aria-label={`${canEditPermissions ? "Edit" : "View"} permissions for ${person.displayName}`}
                  >
                    <DirectoryAvatar
                      name={person.displayName}
                      avatarUrl={person.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-text-primary group-hover:text-accent">
                          {person.displayName}
                        </span>
                        <span
                          className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${segmentBadgeSoftClass(person.segment)}`}
                        >
                          {segmentLabel(person.segment)}
                        </span>
                        {summary?.hasOverride ? (
                          <span className="inline-flex shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 ring-1 ring-violet-300/70">
                            Custom
                          </span>
                        ) : null}
                      </div>
                      {person.subtitle ? (
                        <p className="mt-0.5 truncate text-sm text-text-secondary">{person.subtitle}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">{person.roleOnProject}</span>
                        {summary ? (
                          <span className="text-text-secondary"> · {summary.text}</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-accent">
                        {canEditPermissions ? "Edit permissions →" : "View permissions →"}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {selectedPerson ? (
        <ProjectPersonPermissionsModal
          project={project}
          person={selectedPerson}
          roleDefaults={drafts}
          onClose={() => setSelectedPerson(null)}
          onSaved={() => setPermRevision((n) => n + 1)}
        />
      ) : null}

      {filter === "all" ? (
        <SectionCard title="Defaults by segment">
          <p className="text-sm text-text-secondary">
            Select <span className="font-semibold text-text-primary">Team</span>,{" "}
            <span className="font-semibold text-text-primary">Clients</span>, or{" "}
            <span className="font-semibold text-text-primary">Vendors</span> above to edit role defaults for that
            group on this project.
          </p>
        </SectionCard>
      ) : (
        <SectionCard title={`Defaults · ${segmentLabel(filter)}`}>
          {!hydrated ? (
            <p className="text-sm text-text-secondary">Loading…</p>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                Baseline for everyone in the {segmentLabel(filter).toLowerCase()} segment on this project.
                {canEditPermissions ? (
                  <>
                    {" "}
                    Override per person from{" "}
                    <Link href="/people" className="font-semibold text-accent hover:underline">
                      People
                    </Link>
                    .
                  </>
                ) : (
                  " View only — only the workspace owner can change defaults."
                )}
              </p>
              <PermissionsEditor
                segment={filter}
                flags={flags}
                readOnly={!canEditPermissions}
                onChange={(next) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [filter]: next,
                  }))
                }
              />
              {canEditPermissions ? (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border-light pt-4">
                <button
                  type="button"
                  onClick={save}
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                >
                  Save role defaults
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDrafts((prev) => ({
                      ...prev,
                      [filter]: defaultPermissionsForSegment(filter),
                    }))
                  }
                  className="rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
                >
                  Reset to OnPro defaults
                </button>
                {savedFlash ? (
                  <span className="text-sm font-medium text-emerald-700">Saved for this project.</span>
                ) : null}
              </div>
              ) : null}
            </>
          )}
        </SectionCard>
      )}
    </PanelShell>
  );
}

export function ProjectModuleRouter({
  moduleId,
  project,
  onPatchProject,
  financialDeepLink,
  onFinancialDeepLinkConsumed,
}: {
  moduleId: ProjectModuleId;
  project: Project;
  onPatchProject?: ProjectPatchFn;
  financialDeepLink?: import("@/lib/project-financials-nav").FinancialsDeepLink | null;
  onFinancialDeepLinkConsumed?: () => void;
}) {
  switch (moduleId) {
    case "details":
    case "internal":
    case "documents":
      return null;
    case "financials":
      return (
        <ProjectFinancialsPanel
          project={project}
          deepLink={financialDeepLink}
          onDeepLinkConsumed={onFinancialDeepLinkConsumed}
        />
      );
    case "payments":
      return <PaymentsPanel project={project} />;
    case "shipping":
      return <ShippingModulePanel project={project} onPatchProject={onPatchProject} />;
    case "people_access":
      return <ProjectPeopleAccessPanel project={project} />;
    default:
      return null;
  }
}
