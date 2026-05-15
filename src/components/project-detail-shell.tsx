"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Project, ProjectStatus } from "@/lib/types/project";
import { dateInputToIso, formatCellValue, formatShortDate, isoToDateInput } from "@/lib/format";
import { MilestoneStrip } from "@/components/milestone-strip";
import { MOCK_LS, clearMockLs, readMockLs, writeMockLs } from "@/lib/mock-local";

type Row = { label: string; value: string };

function rowsFrom(
  entries: { label: string; value: string | null | boolean | undefined }[],
): Row[] {
  return entries.map((e) => ({
    label: e.label,
    value: formatCellValue(e.value),
  }));
}

type SectionDef = { id: string; title: string; rows: Row[] };

function buildSections(project: Project): SectionDef[] {
  return [
    {
      id: "project-details",
      title: "Project details",
      rows: rowsFrom([
        { label: "Name", value: project.name },
        { label: "Number", value: project.project_number },
        { label: "Due", value: project.due_date },
        { label: "Status", value: project.status },
        { label: "Status overview", value: project.status_overview },
        { label: "Status update", value: project.status_update_date },
        { label: "Style #", value: project.style_number },
        { label: "Style name", value: project.style_name },
        { label: "Category", value: project.category },
        { label: "Type", value: project.type },
        { label: "Lead vendor", value: project.lead_vendor },
        { label: "Client", value: project.client.name },
      ]),
    },
    {
      id: "internal-development",
      title: "Internal development",
      rows: rowsFrom([
        { label: "Lead team member", value: project.lead_team_member },
        { label: "Dev / prod assignee", value: project.dev_prod_assigned_team_member },
        { label: "Client meeting", value: project.client_meeting_date },
        { label: "Client assets received", value: project.client_assets_received_date },
        { label: "C&S TP request", value: project.cs_tech_pack_request_date },
        { label: "C&S TP due", value: project.cs_tech_pack_due_date },
        { label: "C&S TP assignee", value: project.cs_tech_pack_assigned_member },
        { label: "C&S TP complete", value: project.cs_tech_pack_complete_date },
        { label: "Artwork TP request", value: project.artwork_tech_pack_request_date },
        { label: "Artwork TP due", value: project.artwork_tech_pack_due_date },
        { label: "Artwork TP assignee", value: project.artwork_tech_pack_assigned_member },
        { label: "Artwork TP complete", value: project.artwork_tech_pack_complete_date },
        { label: "Artwork client approval", value: project.artwork_design_client_approval_date },
        { label: "TP sent to factory", value: project.tp_sent_date },
        { label: "References sent", value: project.references_sent_date },
      ]),
    },
    {
      id: "costing",
      title: "Costing",
      rows: rowsFrom([
        { label: "Quote requested", value: project.quote_requested_date },
        { label: "Vendor costing received", value: project.vendor_costing_received_date },
        { label: "Cost sheet prepared", value: project.cost_sheet_prepared_date },
        { label: "Estimate sent", value: project.estimate_sent_date },
        { label: "Costing approved", value: project.costing_approved },
        { label: "Dye vendor", value: project.dye_vendor },
        { label: "Lab dip request", value: project.lab_dip_request_date },
        { label: "Lab dip due", value: project.lab_dip_due_date },
        { label: "Lab dip received", value: project.lab_dip_received_date },
        { label: "Lab dip approval", value: project.lab_dip_approval_status },
        { label: "Print / embroidery vendor", value: project.print_embroidery_vendor },
        { label: "Strike-off request", value: project.strike_off_request_date },
        { label: "Strike-off due", value: project.strike_off_due_date },
        { label: "Strike-off received", value: project.strike_off_received_date },
        { label: "Strike-off approval", value: project.strike_off_approval_status },
      ]),
    },
    {
      id: "bulk-production",
      title: "Bulk production",
      rows: rowsFrom([
        { label: "Bulk fabric approval", value: project.bulk_fabric_approval_date },
        { label: "Bulk trim approval", value: project.bulk_trim_approval_date },
        { label: "New product request", value: project.new_product_request_date },
        { label: "Barcodes sent", value: project.barcodes_sent_to_vendor_date },
        { label: "TOP due", value: project.top_due_date },
        { label: "TOP approved", value: project.top_approved_date },
        { label: "Bulk target delivery", value: project.bulk_target_delivery_date },
        { label: "Ex-factory", value: project.ex_factory_date },
      ]),
    },
    {
      id: "shipping-receiving",
      title: "Shipping & receiving",
      rows: rowsFrom([
        { label: "Shipping terms", value: project.shipping_terms },
        { label: "Shipping method", value: project.shipping_method },
        { label: "Packing list received", value: project.packing_list_received_date },
        { label: "Tracking / BOL", value: project.tracking_bol_number },
        { label: "Packing list sent to client", value: project.packing_list_sent_to_client_date },
        { label: "Client received", value: project.client_received_date },
      ]),
    },
    {
      id: "payments",
      title: "Payments & invoices",
      rows: rowsFrom([
        {
          label: "Note",
          value:
            "Invoice line items are not on the `Project` model in iOS; wire invoices here when the API exists.",
        },
      ]),
    },
  ];
}

const STATUS_OPTIONS: ProjectStatus[] = [
  "IN DEVELOPMENT",
  "PENDING",
  "IN-PROGRESS",
  "COMPLETED",
  "DELIVERED",
];

export function ProjectDetailShell({ project }: { project: Project }) {
  const [patch, setPatch] = useState<Partial<Project>>({});
  const [mfStatus, setMfStatus] = useState<ProjectStatus>(project.status);
  const [mfOverview, setMfOverview] = useState("");
  const [mfQr, setMfQr] = useState("");
  const [mfVcr, setMfVcr] = useState("");
  const [mfCsp, setMfCsp] = useState("");
  const [mfEst, setMfEst] = useState("");
  const [mfCap, setMfCap] = useState<"unset" | "yes" | "no">("unset");

  useEffect(() => {
    const saved = readMockLs<Partial<Project>>(MOCK_LS.project(project.id));
    setPatch(saved && typeof saved === "object" ? saved : {});
  }, [project.id]);

  const merged = useMemo(() => ({ ...project, ...patch }), [project, patch]);

  useEffect(() => {
    const m = merged;
    setMfStatus(m.status);
    setMfOverview(m.status_overview ?? "");
    setMfQr(isoToDateInput(m.quote_requested_date));
    setMfVcr(isoToDateInput(m.vendor_costing_received_date));
    setMfCsp(isoToDateInput(m.cost_sheet_prepared_date));
    setMfEst(isoToDateInput(m.estimate_sent_date));
    setMfCap(m.costing_approved === null ? "unset" : m.costing_approved ? "yes" : "no");
  }, [
    merged.status,
    merged.status_overview,
    merged.quote_requested_date,
    merged.vendor_costing_received_date,
    merged.cost_sheet_prepared_date,
    merged.estimate_sent_date,
    merged.costing_approved,
  ]);

  const sections = useMemo(() => buildSections(merged), [merged]);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "project-details");
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  useEffect(() => {
    if (!sections.some((s) => s.id === activeId)) {
      setActiveId(sections[0]?.id ?? "project-details");
    }
  }, [sections, activeId]);

  function applyMockSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: Partial<Project> = {
      status: mfStatus,
      status_overview: mfOverview.trim() || null,
      quote_requested_date: dateInputToIso(mfQr),
      vendor_costing_received_date: dateInputToIso(mfVcr),
      cost_sheet_prepared_date: dateInputToIso(mfCsp),
      estimate_sent_date: dateInputToIso(mfEst),
      costing_approved: mfCap === "unset" ? null : mfCap === "yes",
    };
    writeMockLs(MOCK_LS.project(project.id), next);
    setPatch(next);
  }

  function clearMockSave() {
    clearMockLs(MOCK_LS.project(project.id));
    setPatch({});
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-border-light bg-surface-card lg:w-56 lg:border-b-0 lg:border-r">
        <div className="sticky top-0 p-4">
          <Link href="/projects" className="text-xs font-semibold text-accent hover:underline">
            ← Projects
          </Link>
          <h1 className="mt-3 text-lg font-bold leading-tight tracking-tight text-text-primary">
            {merged.name}
          </h1>
          <p className="mt-1 text-xs text-text-secondary">
            {merged.client.name}
            <br />
            Due {formatShortDate(merged.due_date)}
          </p>
          <div className="mt-4 rounded-lg border border-border-light bg-surface-body p-2 text-[10px] text-text-secondary">
            <div className="font-medium uppercase tracking-wide">Milestones</div>
            <div className="mt-1">
              <MilestoneStrip project={merged} />
            </div>
          </div>
          <nav className="mt-6 space-y-0.5" aria-label="Project modules">
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveId(sec.id)}
                className={`flex w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  active.id === sec.id
                    ? "bg-chrome-dark text-white"
                    : "text-text-secondary hover:bg-surface-body hover:text-text-primary"
                }`}
              >
                {sec.title}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <header className="mb-6 border-b border-border-light pb-4">
          <h2 className="text-2xl font-bold text-text-primary">{active.title}</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Read-only grid from the <code className="rounded bg-surface-body px-1">Project</code> record. Use{" "}
            <strong className="font-medium text-text-primary">Mock team updates</strong> below to simulate status and costing changes (localStorage, this browser only).
          </p>
        </header>
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.rows.map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                {r.label}
              </dt>
              <dd className="mt-1 break-words text-sm text-text-primary">{r.value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-10 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-text-primary">Mock team updates</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Persists under <code className="rounded bg-white/80 px-1">{MOCK_LS.project(project.id)}</code> — no API. Clears when you remove site data.
          </p>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={applyMockSave}>
            <label className="block text-xs font-medium text-text-secondary sm:col-span-2">
              Status
              <select
                className="mt-1 w-full max-w-md rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary"
                value={mfStatus}
                onChange={(e) => setMfStatus(e.target.value as ProjectStatus)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-text-secondary sm:col-span-2">
              Status overview
              <textarea
                rows={2}
                className="mt-1 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary"
                value={mfOverview}
                onChange={(e) => setMfOverview(e.target.value)}
                placeholder="Short update for the team…"
              />
            </label>
            <label className="block text-xs font-medium text-text-secondary">
              Quote requested
              <input type="date" className="mt-1 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm" value={mfQr} onChange={(e) => setMfQr(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-text-secondary">
              Vendor costing received
              <input type="date" className="mt-1 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm" value={mfVcr} onChange={(e) => setMfVcr(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-text-secondary">
              Cost sheet prepared
              <input type="date" className="mt-1 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm" value={mfCsp} onChange={(e) => setMfCsp(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-text-secondary">
              Estimate sent
              <input type="date" className="mt-1 w-full rounded-lg border border-border-light bg-white px-3 py-2 text-sm" value={mfEst} onChange={(e) => setMfEst(e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-text-secondary sm:col-span-2">
              Costing approved
              <select
                className="mt-1 w-full max-w-md rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary"
                value={mfCap}
                onChange={(e) => setMfCap(e.target.value as "unset" | "yes" | "no")}
              >
                <option value="unset">Unset</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-chrome-dark px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                Save mock changes
              </button>
              <button type="button" className="rounded-lg border border-border-light bg-white px-4 py-2 text-sm font-medium text-text-secondary hover:bg-slate-50" onClick={clearMockSave}>
                Clear mock for this project
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
