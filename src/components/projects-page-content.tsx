"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Client, Project, ProjectStatus } from "@/lib/types/project";
import { computeProjectKpis } from "@/lib/health";
import { dateInputToIso } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ProjectsBrowser } from "@/components/projects-browser";
import {
  appendSessionProject,
  mergeProjectLists,
  readSessionProjects,
} from "@/lib/mock/project-session";

const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "IN DEVELOPMENT",
  "PENDING",
  "IN-PROGRESS",
  "COMPLETED",
  "DELIVERED",
];

const fieldClass =
  "mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const labelClass = "block text-xs font-medium text-text-secondary";

const NEW_CLIENT = "__new__";

function ModalShell({
  title,
  description,
  titleId,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border-light bg-surface-card shadow-xl sm:max-w-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border-light px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          {description ? <p className="mt-1 text-xs text-text-secondary">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function emptyProjectRecord(
  id: number,
  name: string,
  client: Client,
  status: ProjectStatus,
  projectNumber: string | null,
  dueDate: string | null,
  description: string | null,
): Project {
  return {
    id,
    name,
    description,
    project_number: projectNumber,
    project_hand_off_date: null,
    due_date: dueDate,
    client,
    status,
    status_overview: null,
    status_update_date: null,
    style_number: null,
    style_name: null,
    category: null,
    type: null,
    lead_vendor: null,
    colorways: [],
    in_development: [],
    lead_team_member: null,
    client_meeting_date: null,
    client_assets_received_date: null,
    cs_tech_pack_request_date: null,
    cs_tech_pack_due_date: null,
    cs_tech_pack_assigned_member: null,
    cs_tech_pack_complete_date: null,
    artwork_tech_pack_request_date: null,
    artwork_tech_pack_due_date: null,
    artwork_tech_pack_assigned_member: null,
    artwork_tech_pack_complete_date: null,
    artwork_design_client_approval_date: null,
    dev_prod_assigned_team_member: null,
    tp_sent_date: null,
    references_sent_date: null,
    quote_requested_date: null,
    vendor_costing_received_date: null,
    cost_sheet_prepared_date: null,
    estimate_sent_date: null,
    costing_approved: null,
    dye_vendor: null,
    lab_dip_request_date: null,
    lab_dip_due_date: null,
    lab_dip_received_date: null,
    lab_dip_approval_status: null,
    print_embroidery_vendor: null,
    strike_off_request_date: null,
    strike_off_due_date: null,
    strike_off_received_date: null,
    strike_off_approval_status: null,
    bulk_fabric_approval_date: null,
    bulk_trim_approval_date: null,
    new_product_request_date: null,
    barcodes_sent_to_vendor_date: null,
    top_due_date: null,
    top_approved_date: null,
    bulk_target_delivery_date: null,
    ex_factory_date: null,
    shipping_terms: null,
    shipping_method: null,
    packing_list_received_date: null,
    tracking_bol_number: null,
    packing_list_sent_to_client_date: null,
    client_received_date: null,
  };
}

export function ProjectsPageContent({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const session = readSessionProjects();
    if (session.length === 0) return;
    setProjects((prev) => mergeProjectLists(prev, session));
  }, []);

  const [name, setName] = useState("");
  const [clientSelect, setClientSelect] = useState<string>(() => String(initialProjects[0]?.client.id ?? ""));
  const [newClientName, setNewClientName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("PENDING");
  const [projectNumber, setProjectNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  const k = useMemo(() => computeProjectKpis(projects), [projects]);

  const clientsSorted = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of projects) m.set(p.client.id, p.client.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects]);

  const resetForm = useCallback(() => {
    const firstId = clientsSorted[0]?.[0];
    setName("");
    setClientSelect(firstId != null ? String(firstId) : NEW_CLIENT);
    setNewClientName("");
    setStatus("PENDING");
    setProjectNumber("");
    setDueDate("");
    setDescription("");
  }, [clientsSorted]);

  const openModal = useCallback(() => {
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    let client: Client;
    if (clientSelect === NEW_CLIENT) {
      const cn = newClientName.trim();
      if (!cn) return;
      const maxClient = Math.max(0, ...projects.map((p) => p.client.id));
      client = { id: maxClient + 1, name: cn, avatar_url: null };
    } else {
      const id = Number(clientSelect);
      const row = clientsSorted.find(([cid]) => cid === id);
      if (!row) return;
      client = { id: row[0], name: row[1], avatar_url: null };
    }

    const nextId = Math.max(0, ...projects.map((p) => p.id)) + 1;
    const dueIso = dueDate ? dateInputToIso(dueDate) : null;
    const proj = emptyProjectRecord(
      nextId,
      trimmedName,
      client,
      status,
      projectNumber.trim() || null,
      dueIso,
      description.trim() || null,
    );

    appendSessionProject(proj);
    setProjects((prev) => [...prev, proj]);
    closeModal();
    router.push(`/projects/${nextId}`);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Projects"
          subtitle="Track progress and manage production projects (mock data, field-backed metrics)."
          action={
            <button
              type="button"
              onClick={openModal}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90"
            >
              + New project
            </button>
          }
          kpis={[
            { label: "Total projects", value: k.total, tone: "accent" },
            { label: "On track", value: k.onTrack, tone: "ok" },
            { label: "At risk", value: k.atRisk, tone: "warn" },
            { label: "Delayed", value: k.delayed, tone: "bad" },
          ]}
        />
      </div>
      <ProjectsBrowser projects={projects} />

      {modalOpen ? (
        <ModalShell
          titleId="new-project-title"
          title="New project"
          description="Creates a project in this session (mock UI — not saved to a server)."
          onClose={closeModal}
        >
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className={labelClass}>
                Project name
                <input
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Spring capsule"
                  required
                  autoComplete="off"
                />
              </label>
              <label className={labelClass}>
                Client
                <select
                  className={fieldClass}
                  value={clientSelect}
                  onChange={(e) => setClientSelect(e.target.value)}
                >
                  {clientsSorted.map(([id, clientName]) => (
                    <option key={id} value={id}>
                      {clientName}
                    </option>
                  ))}
                  <option value={NEW_CLIENT}>New client…</option>
                </select>
              </label>
              {clientSelect === NEW_CLIENT ? (
                <label className={labelClass}>
                  New client name
                  <input
                    className={fieldClass}
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Brand or company name"
                    required={clientSelect === NEW_CLIENT}
                  />
                </label>
              ) : null}
              <label className={labelClass}>
                Status
                <select
                  className={fieldClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                >
                  {PROJECT_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Project # <span className="font-normal text-text-secondary">(optional)</span>
                <input
                  className={fieldClass}
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  placeholder="e.g. ABC-101"
                />
              </label>
              <label className={labelClass}>
                Due date <span className="font-normal text-text-secondary">(optional)</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              <label className={labelClass}>
                Notes <span className="font-normal text-text-secondary">(optional)</span>
                <textarea
                  className={fieldClass}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description for the team"
                />
              </label>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border-light px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Create project
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
