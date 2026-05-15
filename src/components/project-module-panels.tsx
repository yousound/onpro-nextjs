"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApprovalStatus, Project, Sample } from "@/lib/types/project";
import { PermissionsEditor } from "@/components/permissions-editor";
import { clientInitials, formatShortDate } from "@/lib/format";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import type { PeopleSegment } from "@/lib/mock/people";
import { segmentLabel, segmentPillSelectedClass } from "@/lib/mock/people";
import type { ProjectModuleId } from "@/lib/project-modules";
import { defaultPermissionsForSegment, type ProjectPermissionFlags } from "@/lib/project-permissions";

function PanelShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1600px] space-y-5 pb-8 ${className}`}>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{title}</h3>
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
            approved ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
          }`}
        >
          {approved ? "Yes" : "No"}
        </span>
      </div>
    </GrayRow>
  );
}

export function ProjectDetailsClientCard({ project }: { project: Project }) {
  const initials = clientInitials(project.client.name);
  return (
    <section className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">Client</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-accent text-lg font-bold text-white shadow-inner"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight text-text-primary md:text-2xl">{project.client.name}</h2>
          {project.project_number ? (
            <p className="mt-1 text-sm font-medium text-text-secondary">{project.project_number}</p>
          ) : null}
        </div>
      </div>
    </section>
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

export function InternalDevelopmentPanel({ project }: { project: Project }) {
  return (
    <PanelShell>
      <SectionCard title="Team assignments">
        <MetaRow label="Lead team member" value={project.lead_team_member ?? "—"} />
        <MetaRow label="Dev & prod assigned" value={project.dev_prod_assigned_team_member ?? "—"} />
      </SectionCard>
      <SectionCard title="Project timeline">
        <DateRow label="Client meeting / handover" value={formatShortDate(project.client_meeting_date)} />
        <DateRow label="Client assets received" value={formatShortDate(project.client_assets_received_date)} />
        <DateRow label="TP sent to factory" value={formatShortDate(project.tp_sent_date)} />
        <DateRow label="References sent to factory" value={formatShortDate(project.references_sent_date)} />
      </SectionCard>
      <SectionCard title="C&S tech pack">
        <MetaRow label="Assigned to" value={project.cs_tech_pack_assigned_member ?? "—"} />
        <DateRow label="Request date" value={formatShortDate(project.cs_tech_pack_request_date)} />
        <DateRow label="Due date" value={formatShortDate(project.cs_tech_pack_due_date)} />
        <DateRow label="Complete date" value={formatShortDate(project.cs_tech_pack_complete_date)} />
      </SectionCard>
      <SectionCard title="Artwork tech pack">
        <MetaRow label="Assigned to" value={project.artwork_tech_pack_assigned_member ?? "—"} />
        <DateRow label="Request date" value={formatShortDate(project.artwork_tech_pack_request_date)} />
        <DateRow label="Due date" value={formatShortDate(project.artwork_tech_pack_due_date)} />
        <DateRow label="Complete date" value={formatShortDate(project.artwork_tech_pack_complete_date)} />
        <DateRow label="Client approval" value={formatShortDate(project.artwork_design_client_approval_date)} />
      </SectionCard>
    </PanelShell>
  );
}

function PaymentsPanel({ project }: { project: Project }) {
  return (
    <PanelShell>
      <SectionCard title="Payment processors">
        <GrayRow>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-text-primary">Stripe</span>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              Connected
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
          className="w-full rounded-xl border-2 border-dashed border-accent/40 py-3 text-sm font-semibold text-accent hover:bg-violet-50"
        >
          + Add payment method
        </button>
      </SectionCard>
      <SectionCard title="Payment history">
        <p className="text-xs text-text-secondary">Project: {project.name}</p>
        <div className="flex flex-col items-center py-8 text-center">
          <p className="text-lg font-semibold text-text-primary">No payments yet</p>
          <p className="mt-2 max-w-sm text-sm text-text-secondary">Collect payments from clients (mock).</p>
          <p className="mt-4 text-sm font-semibold text-emerald-700">$0.00 collected</p>
        </div>
      </SectionCard>
    </PanelShell>
  );
}

function InvoicesPanel({ project }: { project: Project }) {
  return (
    <PanelShell>
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
      {(["Bulk invoices", "Sample invoices", "Tech pack / artwork"] as const).map((title) => (
        <SectionCard key={title} title={title}>
          <p className="text-sm text-text-secondary">No invoices yet for {project.name}.</p>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            + Create invoice
          </button>
        </SectionCard>
      ))}
    </PanelShell>
  );
}

function ApprovalsPanel({ project }: { project: Project }) {
  return (
    <PanelShell>
      <SectionCard title="Costing approvals">
        <DateRow label="Quote requested" value={formatShortDate(project.quote_requested_date)} />
        <DateRow label="Vendor costing received" value={formatShortDate(project.vendor_costing_received_date)} />
        <DateRow label="Cost sheet prepared" value={formatShortDate(project.cost_sheet_prepared_date)} />
        <DateRow label="Estimate sent" value={formatShortDate(project.estimate_sent_date)} />
        {costingToggleRow(project.costing_approved)}
      </SectionCard>
      <SectionCard title="Dye approvals">
        {project.dye_vendor ? <VendorRow label="Vendor" name={project.dye_vendor} /> : null}
        <DateRow label="Lab dip requested" value={formatShortDate(project.lab_dip_request_date)} />
        <DateRow label="Lab dip due" value={formatShortDate(project.lab_dip_due_date)} />
        <DateRow label="Lab dip received" value={formatShortDate(project.lab_dip_received_date)} />
        <GrayRow>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-text-primary">Lab dip status</span>
            {approvalPill(project.lab_dip_approval_status)}
          </div>
        </GrayRow>
      </SectionCard>
      <SectionCard title="Print / embroidery / decoration">
        {project.print_embroidery_vendor ? (
          <VendorRow label="Vendor" name={project.print_embroidery_vendor} />
        ) : null}
        <DateRow label="Strike off requested" value={formatShortDate(project.strike_off_request_date)} />
        <DateRow label="Strike off due" value={formatShortDate(project.strike_off_due_date)} />
        <DateRow label="Strike off received" value={formatShortDate(project.strike_off_received_date)} />
        <GrayRow>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-text-primary">Strike off status</span>
            {approvalPill(project.strike_off_approval_status)}
          </div>
        </GrayRow>
      </SectionCard>
      <SectionCard title="Bulk production approvals">
        <DateRow label="Bulk fabric approved" value={formatShortDate(project.bulk_fabric_approval_date)} />
        <DateRow label="Bulk trim approved" value={formatShortDate(project.bulk_trim_approval_date)} />
        <DateRow label="TOP due" value={formatShortDate(project.top_due_date)} />
        <DateRow label="TOP approved" value={formatShortDate(project.top_approved_date)} />
      </SectionCard>
    </PanelShell>
  );
}

function CostingPanel({ project }: { project: Project }) {
  return (
    <PanelShell>
      <SectionCard title="Costing overview">
        <DateRow label="Quote requested" value={formatShortDate(project.quote_requested_date)} />
        <DateRow label="Vendor costing received" value={formatShortDate(project.vendor_costing_received_date)} />
        <DateRow label="Cost sheet prepared" value={formatShortDate(project.cost_sheet_prepared_date)} />
        <DateRow label="Estimate sent" value={formatShortDate(project.estimate_sent_date)} />
        {costingToggleRow(project.costing_approved)}
      </SectionCard>
      <SectionCard title="Dyes">
        {project.dye_vendor ? <VendorRow label="Vendor" name={project.dye_vendor} /> : null}
        <DateRow label="Lab dip requested" value={formatShortDate(project.lab_dip_request_date)} />
        <DateRow label="Lab dip due" value={formatShortDate(project.lab_dip_due_date)} />
        <DateRow label="Lab dip received" value={formatShortDate(project.lab_dip_received_date)} />
      </SectionCard>
    </PanelShell>
  );
}

function sampleSummary(s: Sample) {
  return `${s.type} · ${s.status}`;
}

function CsPanel({ project }: { project: Project }) {
  const [selectedId, setSelectedId] = useState<number | "all">(
    project.colorways[0]?.id ?? "all",
  );

  if (project.colorways.length === 0) {
    return (
      <PanelShell>
        <p className="text-sm text-text-secondary">No colorways on this project.</p>
      </PanelShell>
    );
  }

  const visible =
    selectedId === "all" ? project.colorways : project.colorways.filter((c) => c.id === selectedId);

  return (
    <PanelShell>
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
        <SectionCard key={cw.id} title={cw.name}>
          {cw.samples.length === 0 ? (
            <p className="text-sm text-text-secondary">No samples tracked for this colorway.</p>
          ) : (
            cw.samples.map((s) => (
              <GrayRow key={s.id}>
                <p className="text-sm font-semibold text-text-primary">{sampleSummary(s)}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Received: {formatShortDate(s.received_date)}
                </p>
              </GrayRow>
            ))
          )}
        </SectionCard>
      ))}
    </PanelShell>
  );
}

function BulkProductionPanel({ project }: { project: Project }) {
  const ex = project.ex_factory_date ? new Date(project.ex_factory_date).getTime() : null;
  const hint =
    ex != null && !Number.isNaN(ex)
      ? new Date(ex - 7 * 86400000).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <PanelShell>
      <SectionCard title="Production approvals">
        <DateRow label="Bulk fabric approval" value={formatShortDate(project.bulk_fabric_approval_date)} />
        <DateRow label="Bulk trim approval" value={formatShortDate(project.bulk_trim_approval_date)} />
        <DateRow label="New product request" value={formatShortDate(project.new_product_request_date)} />
        <DateRow label="Barcodes sent to vendor" value={formatShortDate(project.barcodes_sent_to_vendor_date)} />
      </SectionCard>
      <SectionCard title="TOP sample">
        <DateRow label="TOP due" value={formatShortDate(project.top_due_date)} />
        <DateRow label="TOP approved" value={formatShortDate(project.top_approved_date)} />
      </SectionCard>
      <SectionCard title="Delivery schedule">
        <DateRow label="Bulk target delivery" value={formatShortDate(project.bulk_target_delivery_date)} />
        <DateRow label="Ex-factory date" value={formatShortDate(project.ex_factory_date)} />
      </SectionCard>
      {hint ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5">
          <p className="text-sm font-semibold text-blue-900">Auto-calculation (mock)</p>
          <p className="mt-2 text-sm text-blue-800/90">
            Packing list target ~1 week before ex-factory: <span className="font-bold">{hint}</span>
          </p>
        </div>
      ) : null}
    </PanelShell>
  );
}

function ShippingModulePanel({ project }: { project: Project }) {
  const [sub, setSub] = useState<"shipping" | "receiving">("shipping");
  return (
    <PanelShell>
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
            <DateRow label="Shipping terms" value={project.shipping_terms ?? "FOB"} />
            <DateRow label="Shipping method" value={project.shipping_method ?? "Not set"} />
          </SectionCard>
          <SectionCard title="Packing list">
            <DateRow label="Packing list received" value={formatShortDate(project.packing_list_received_date)} />
            <DateRow
              label="Sent to client"
              value={formatShortDate(project.packing_list_sent_to_client_date)}
            />
          </SectionCard>
        </>
      ) : (
        <SectionCard title="Receiving">
          <DateRow label="Tracking / BOL" value={project.tracking_bol_number ?? "—"} />
          <DateRow label="Client received" value={formatShortDate(project.client_received_date)} />
        </SectionCard>
      )}
    </PanelShell>
  );
}

const PEOPLE_SEGMENTS: PeopleSegment[] = ["team", "vendor", "client"];

function mergeRoleDrafts(
  raw: Partial<Record<PeopleSegment, Partial<ProjectPermissionFlags>>> | null,
): Record<PeopleSegment, ProjectPermissionFlags> {
  const base = {
    team: defaultPermissionsForSegment("team"),
    vendor: defaultPermissionsForSegment("vendor"),
    client: defaultPermissionsForSegment("client"),
  };
  if (!raw) return base;
  return {
    team: { ...base.team, ...raw.team },
    vendor: { ...base.vendor, ...raw.vendor },
    client: { ...base.client, ...raw.client },
  };
}

export function ProjectPeopleAccessPanel({ project }: { project: Project }) {
  const [segment, setSegment] = useState<PeopleSegment>("team");
  const [drafts, setDrafts] = useState<Record<PeopleSegment, ProjectPermissionFlags>>(() => mergeRoleDrafts(null));
  const [hydrated, setHydrated] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const raw = readMockLs<Partial<Record<PeopleSegment, Partial<ProjectPermissionFlags>>>>(
      MOCK_LS.projectRolePermissions(project.id),
    );
    setDrafts(mergeRoleDrafts(raw));
    setHydrated(true);
  }, [project.id]);

  function save() {
    writeMockLs(MOCK_LS.projectRolePermissions(project.id), drafts);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  const flags = drafts[segment];

  return (
    <PanelShell>
      <section className="rounded-2xl border border-border-light bg-white p-6 shadow-sm">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">People &amp; access</h3>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Default capabilities for each workspace segment on{" "}
          <span className="font-semibold text-text-primary">{project.name}</span>. Invites from People let you tune permissions for that
          email. Stored in this browser only (mock).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PEOPLE_SEGMENTS.map((s) => (
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
      </section>

      <SectionCard title={`Defaults · ${segmentLabel(segment)}`}>
        {!hydrated ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <>
            <PermissionsEditor
              segment={segment}
              flags={flags}
              onChange={(next) =>
                setDrafts((prev) => ({
                  ...prev,
                  [segment]: next,
                }))
              }
            />
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
                    [segment]: defaultPermissionsForSegment(segment),
                  }))
                }
                className="rounded-xl border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-body"
              >
                Reset to OnPro defaults
              </button>
              {savedFlash ? <span className="text-sm font-medium text-emerald-700">Saved for this project.</span> : null}
            </div>
          </>
        )}
      </SectionCard>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-text-primary">Per-person invites</p>
        <p className="mt-1 text-sm text-text-secondary">
          Open{" "}
          <Link href="/people" className="font-semibold text-accent hover:underline">
            People
          </Link>{" "}
          to invite by email and set that person&apos;s permissions before they accept.
        </p>
      </div>
    </PanelShell>
  );
}

export function ProjectModuleRouter({ moduleId, project }: { moduleId: ProjectModuleId; project: Project }) {
  switch (moduleId) {
    case "details":
    case "internal":
      return null;
    case "payments":
      return <PaymentsPanel project={project} />;
    case "invoices":
      return <InvoicesPanel project={project} />;
    case "approvals":
      return <ApprovalsPanel project={project} />;
    case "costing":
      return <CostingPanel project={project} />;
    case "cs":
      return <CsPanel project={project} />;
    case "bulk_production":
      return <BulkProductionPanel project={project} />;
    case "shipping":
      return <ShippingModulePanel project={project} />;
    case "people_access":
      return <ProjectPeopleAccessPanel project={project} />;
    default:
      return null;
  }
}
