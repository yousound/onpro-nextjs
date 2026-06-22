"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Project, ProjectStatus } from "@/lib/types/project";
import type {
  JobDetailsFocus,
  ProjectJob,
  ProjectOrder,
} from "@/lib/types/wip";
import { dateInputToIso, formatShortDate, isoToDateInput } from "@/lib/format";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { upsertLiveProject } from "@/lib/data/live-cache";
import { updateProjectInDb } from "@/lib/data/persist-project";
import { splitProjectPatch, readLocalProjectOverlay } from "@/lib/supabase/mappers/project";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { resolveClientProjectList } from "@/lib/mock/project-session";
import {
  loadProjectJobs,
  saveProjectJobs,
} from "@/lib/project-wip-edits";
import {
  getOrCreateOrderForJob,
  loadProjectOrders,
  saveProjectOrders,
} from "@/lib/project-order-edits";
import { ProjectOrdersSection } from "@/components/project-orders-section";
import { useCurrentUser } from "@/components/profile-provider";
import { resolveOperatorCompanyCode } from "@/lib/operator-company-code";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import type { UserProfile } from "@/lib/types/profile";
import { loadContacts, vendorContacts } from "@/lib/contacts-store";
import { clientCodeFromContact } from "@/lib/client-code-resolve";
import { resolveClientCode } from "@/lib/reference/client-codes";
import { PROJECT_STATUS_OPTIONS, projectStatusBadgeClass } from "@/lib/project-status";
import { collectAllAppPoNumbers } from "@/lib/po-context";
import { projectPoNumber, rollPoNumberIfNewMonth, shouldValidateProjectNumber } from "@/lib/po-number";
import { validateProjectPoUnique } from "@/lib/po-duplicate";
import { normalizeJob } from "@/lib/job-defaults";
import { createNewJobSeed } from "@/lib/project-job-create";
import type { ProjectModuleId } from "@/lib/project-modules";
import { parseProjectModuleTab, PROJECT_MODULE_TABS } from "@/lib/project-modules";
import { ContentHeader } from "@/components/content-header";
import {
  InternalDevelopmentPanel,
  ProjectDetailsClientCard,
  ProjectModuleRouter,
} from "@/components/project-module-panels";
import { ProjectDocumentsPanel } from "@/components/project-documents-panel";
import { JobDetailsModal } from "@/components/job-details-modal";
import { EditProjectModal } from "@/components/edit-project-modal";
import { RequestVendorQuotesModal } from "@/components/request-vendor-quotes-modal";
import { parseInspectJob } from "@/lib/job-inspect";
import { commitDeleteProject } from "@/lib/data/delete-project";
import { countExtraDocumentsForProject } from "@/lib/documents/delete-documents";
import { dispatchProjectDeleted, dispatchAppToast } from "@/lib/onpro-events";

type EditModal = { kind: "project" } | { kind: "job"; jobId: string } | null;

function statusBadgeClass(status: ProjectStatus): string {
  return projectStatusBadgeClass(status);
}

export function ProjectJobsView({
  project,
  initialJobs,
}: {
  project: Project;
  initialJobs?: ProjectJob[];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [projectPatch, setProjectPatch] = useState<Partial<Project>>({});
  const [jobs, setJobs] = useState<ProjectJob[]>([]);
  const [orders, setOrders] = useState<ProjectOrder[]>([]);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const { user: currentUser } = useCurrentUser();
  const [hydrated, setHydrated] = useState(false);
  const [editModal, setEditModal] = useState<EditModal>(null);
  const [activeModule, setActiveModule] = useState<ProjectModuleId>("details");

  const [draftProject, setDraftProject] = useState({
    name: "",
    status: "Intake" as ProjectStatus,
    po_number: "",
    hand_off: "",
    due_date: "",
    status_overview: "",
    status_update: "",
  });
  const [jobDetailsFocus, setJobDetailsFocus] = useState<JobDetailsFocus | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);
  const [deletingJob, setDeletingJob] = useState(false);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [projectNumberMessage, setProjectNumberMessage] = useState<string | null>(null);

  useEffect(() => {
    const mod = searchParams.get("module");
    setActiveModule(parseProjectModuleTab(mod));
  }, [searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    const parsed = parseInspectJob(searchParams.get("inspectJob"));
    if (!parsed || parsed.projectId !== project.id) return;
    const job = jobs.find((j) => j.id === parsed.jobId);
    if (!job) return;
    setEditModal({ kind: "job", jobId: job.id });
    setJobDetailsFocus(null);
  }, [hydrated, searchParams, project.id, jobs]);

  const navigateToModule = useCallback(
    (id: ProjectModuleId) => {
      setActiveModule(id);
      const params = new URLSearchParams(searchParams.toString());
      if (id === "details") {
        params.delete("module");
      } else {
        params.set("module", id);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const saved = readMockLs<Partial<Project>>(MOCK_LS.project(project.id));
    const patch = saved && typeof saved === "object" ? saved : {};
    setProjectPatch(readLocalProjectOverlay(saved));
    const mergedProject = { ...project, ...patch };

    if (isClientLiveBackend()) {
      let loaded = loadProjectJobs(project.id, mergedProject);
      if (loaded.length === 0 && (initialJobs?.length ?? 0) > 0) {
        saveProjectJobs(project.id, initialJobs!);
        loaded = initialJobs!;
      }
      setJobs(loaded);
    } else {
      setJobs(loadProjectJobs(project.id, mergedProject));
    }
    setOrders(loadProjectOrders(project.id, mergedProject));
    setHydrated(true);
  }, [project, project.id, initialJobs, currentUser]);

  useEffect(() => {
    if (!hydrated) return;
    function reloadJobs() {
      const saved = readMockLs<Partial<Project>>(MOCK_LS.project(project.id));
      const patch = saved && typeof saved === "object" ? saved : {};
      const mergedProject = { ...project, ...patch };
      setJobs(loadProjectJobs(project.id, mergedProject));
    }
    function reloadOrders() {
      const saved = readMockLs<Partial<Project>>(MOCK_LS.project(project.id));
      const patch = saved && typeof saved === "object" ? saved : {};
      const mergedProject = { ...project, ...patch };
      setOrders(loadProjectOrders(project.id, mergedProject));
    }
    window.addEventListener("onpro-jobs-changed", reloadJobs);
    window.addEventListener("onpro-orders-changed", reloadOrders);
    return () => {
      window.removeEventListener("onpro-jobs-changed", reloadJobs);
      window.removeEventListener("onpro-orders-changed", reloadOrders);
    };
  }, [project, project.id, hydrated]);

  const merged = useMemo(() => ({ ...project, ...projectPatch }), [project, projectPatch]);

  const clientCode = useMemo(() => {
    const contact = loadContacts().find((c) => String(c.id) === String(merged.client.id));
    if (contact) return clientCodeFromContact(contact).effectiveCode;
    return resolveClientCode(merged.client.name);
  }, [merged.client.id, merged.client.name]);

  const vendors = useMemo(() => vendorContacts(loadContacts()), []);

  const persistProject = useCallback(
    (next: Partial<Project>): void | Promise<void> => {
      const patch = { ...projectPatch, ...next };
      setProjectPatch(patch);

      if (!isClientLiveBackend()) {
        writeMockLs(MOCK_LS.project(project.id), patch);
        return;
      }

      const { db, local } = splitProjectPatch(next);
      if (Object.keys(local).length > 0) {
        const prevLocal = readMockLs<Partial<Project>>(MOCK_LS.project(project.id)) ?? {};
        writeMockLs(MOCK_LS.project(project.id), { ...prevLocal, ...local });
      }

      if (Object.keys(db).length === 0) return;

      return updateProjectInDb(project.id, db)
        .then((saved) => {
          upsertLiveProject({
            ...saved,
            ...readLocalProjectOverlay(readMockLs(MOCK_LS.project(project.id))),
          });
        })
        .catch((err) => {
          console.error("[project] update failed", err);
          throw err;
        });
    },
    [project.id, projectPatch],
  );

  const persistJobs = useCallback(
    (updater: (prev: ProjectJob[]) => ProjectJob[]) => {
      setJobs((prev) => {
        const next = updater(prev);
        saveProjectJobs(project.id, next);
        return next;
      });
    },
    [project.id],
  );

  const persistOrders = useCallback(
    (next: ProjectOrder[]) => {
      setOrders(next);
      saveProjectOrders(project.id, next);
    },
    [project.id],
  );

  const operatorCode = useMemo(
    () =>
      resolveOperatorCompanyCode(
        currentUser
          ? ({
              operator_company_code: currentUser.operatorCompanyCode,
              company_name: currentUser.companyName,
            } as import("@/lib/types/profile").UserProfile)
          : null,
      ),
    [currentUser],
  );

  const allProjectsForOrders = useMemo(() => {
    const live = getLiveCachedProjects();
    return live.length > 0 ? live : resolveClientProjectList([merged]);
  }, [merged]);

  useEffect(() => {
    if (editModal?.kind !== "project") return;
    const clientCode = resolveClientCode(merged.client.name);
    const currentPo = projectPoNumber(merged);
    const rolledPo = rollPoNumberIfNewMonth(
      currentPo,
      clientCode,
      collectAllAppPoNumbers().filter((po) => po !== currentPo),
    );
    setDraftProject({
      name: merged.name,
      status: merged.status,
      po_number: rolledPo,
      hand_off: isoToDateInput(merged.project_hand_off_date),
      due_date: isoToDateInput(merged.due_date),
      status_overview: merged.status_overview ?? "",
      status_update: isoToDateInput(merged.status_update_date),
    });
  }, [editModal, merged]);

  useEffect(() => {
    if (editModal?.kind !== "project") {
      setProjectNumberMessage(null);
      return;
    }
    const po = draftProject.po_number;
    if (!shouldValidateProjectNumber(po)) {
      setProjectNumberMessage(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const msg = validateProjectPoUnique(po, allProjectsForOrders, project.id);
      setProjectNumberMessage(msg);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [editModal, draftProject.po_number, allProjectsForOrders, project.id]);

  function openJobEdit(jobId: string) {
    setEditModal({ kind: "job", jobId });
    setJobDetailsFocus(null);
  }

  function closeModal() {
    setEditModal(null);
    setJobDetailsFocus(null);
    setPendingOrderId(null);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("inspectJob")) {
      params.delete("inspectJob");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  function handleSaveJob(saved: ProjectJob) {
    const modalJobId = editModal?.kind === "job" ? editModal.jobId : null;
    const isCreate = modalJobId === "__new__";
    const isDuplicate =
      modalJobId != null &&
      modalJobId !== "__new__" &&
      modalJobId !== saved.id &&
      !jobs.some((j) => j.id === saved.id);

    let jobToSave = saved;
    if (isCreate && !saved.order_id) {
      const created = getOrCreateOrderForJob(
        project.id,
        merged,
        orders,
        operatorCode,
        allProjectsForOrders,
      );
      jobToSave = { ...saved, order_id: created.orderId };
      if (created.orders.length !== orders.length) {
        persistOrders(created.orders);
      }
    }

    persistJobs((prev) => {
      const exists = prev.some((j) => j.id === jobToSave.id);
      if (exists) return prev.map((j) => (j.id === jobToSave.id ? jobToSave : j));
      return [...prev, jobToSave];
    });
    closeModal();
    dispatchAppToast(isDuplicate ? "Job duplicated" : isCreate ? "Job created" : "Job saved");
  }

  function handleDeleteJob() {
    if (editModal?.kind !== "job" || editModal.jobId === "__new__") return;
    const job = jobs.find((j) => j.id === editModal.jobId);
    if (!job) return;
    const label = job.name.trim() || "this job";
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setDeletingJob(true);
    try {
      persistJobs((prev) => prev.filter((j) => j.id !== job.id));
      closeModal();
    } finally {
      setDeletingJob(false);
    }
  }

  function openProjectEdit() {
    setEditModal({ kind: "project" });
  }

  async function saveProjectModal(e: FormEvent) {
    e.preventDefault();
    const po = draftProject.po_number.trim() || null;
    if (po) {
      const poConflict = validateProjectPoUnique(po, allProjectsForOrders, project.id);
      if (poConflict) {
        setProjectNumberMessage(poConflict);
        window.alert(poConflict);
        return;
      }
    }
    const modalPatch = {
      name: draftProject.name.trim() || merged.name,
      status: draftProject.status,
      project_number: po,
      po_number: po,
      project_hand_off_date: dateInputToIso(draftProject.hand_off),
      due_date: dateInputToIso(draftProject.due_date),
      status_overview: draftProject.status_overview.trim() || null,
      status_update_date: dateInputToIso(draftProject.status_update),
    };
    try {
      await persistProject(modalPatch);
      if (isClientLiveBackend()) router.refresh();
      closeModal();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not save project");
    }
  }

  async function handleDeleteProject() {
    const label = merged.name.trim() || "this project";
    const docCount = countExtraDocumentsForProject(project.id);
    const docLine =
      docCount > 0
        ? ` This also removes ${docCount} file${docCount === 1 ? "" : "s"} (including images) from Documents.`
        : "";
    if (
      !window.confirm(
        `Delete "${label}"? This removes the project and all its jobs.${docLine} Contacts in People are not removed — delete those manually if needed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingProject(true);
    try {
      await commitDeleteProject(project.id);
      dispatchProjectDeleted(project.id);
      if (isClientLiveBackend()) await router.refresh();
      router.push("/projects");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not delete project");
      setDeletingProject(false);
    }
  }

  const modalJob = useMemo(() => {
    if (editModal?.kind !== "job") return null;
    if (editModal.jobId === "__new__") {
      const orderId = pendingOrderId ?? orders[0]?.id;
      return createNewJobSeed(merged, jobs, undefined, orderId);
    }
    return jobs.find((j) => j.id === editModal.jobId) ?? null;
  }, [editModal, jobs, merged, orders, pendingOrderId]);

  if (!hydrated) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <ContentHeader
          breadcrumbs={
            <nav className="flex items-center gap-2 text-sm text-text-secondary" aria-label="Breadcrumb">
              <Link href="/projects" className="font-medium hover:text-accent">
                Projects
              </Link>
              <span aria-hidden>/</span>
              <span className="truncate font-semibold text-text-primary">{project.name}</span>
            </nav>
          }
        />
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-text-secondary">Loading…</div>
      </div>
    );
  }

  const ordersSection = (
    <section className="pb-4 pt-2">
      <ProjectOrdersSection
        project={merged}
        orders={orders}
        jobs={jobs}
        operatorCode={operatorCode}
        allProjects={allProjectsForOrders}
        onOrdersChange={persistOrders}
        onOpenJob={openJobEdit}
        onAddJobToOrder={(orderId) => {
          setPendingOrderId(orderId);
          setEditModal({ kind: "job", jobId: "__new__" });
        }}
        onAddJob={() => {
          const orderId = orders[0]?.id;
          if (orderId) setPendingOrderId(orderId);
          setEditModal({ kind: "job", jobId: "__new__" });
        }}
      />
    </section>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <ContentHeader
        breadcrumbs={
          <nav className="flex items-center gap-2 text-sm text-text-secondary" aria-label="Breadcrumb">
            <Link href="/projects" className="font-medium hover:text-accent">
              Projects
            </Link>
            <span aria-hidden>/</span>
            <span className="truncate font-semibold text-text-primary">{merged.name}</span>
          </nav>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-8 sm:px-6">
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 pt-4 pb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">{merged.name}</h1>
            {projectPoNumber(merged) ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-text-secondary">
                {projectPoNumber(merged)}
              </span>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(merged.status)}`}
            >
              {merged.status}
            </span>
          </div>
          {activeModule === "details" ? (
            <div className="flex flex-wrap items-center gap-2">
              {jobs.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setQuoteModalOpen(true)}
                  className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-violet-50"
                >
                  Request vendor quotes
                </button>
              ) : null}
              <button
                type="button"
                onClick={openProjectEdit}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Edit project
              </button>
            </div>
          ) : null}
        </header>

        <div
          className="scrollbar-light-gray -mx-1 shrink-0 overflow-x-auto pb-2"
          role="tablist"
          aria-label="Project modules"
        >
          <div className="flex min-w-max gap-1 px-1">
            {PROJECT_MODULE_TABS.map((t) => {
              const on = activeModule === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => navigateToModule(t.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                    on
                      ? "bg-accent text-white shadow-sm"
                      : "bg-surface-card text-text-secondary ring-1 ring-border-light hover:text-text-primary"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {activeModule === "details" ? (
            <div className="space-y-5">
              <ProjectDetailsClientCard project={merged} />
              {ordersSection}
            </div>
          ) : null}

          {activeModule === "internal" ? (
            <div className="space-y-6">
              <InternalDevelopmentPanel project={merged} onPatchProject={persistProject} />
            </div>
          ) : null}

          {activeModule === "documents" ? (
            <div className="-mx-4 min-h-[24rem] sm:-mx-6">
              <ProjectDocumentsPanel project={merged} />
            </div>
          ) : null}

          <ProjectModuleRouter moduleId={activeModule} project={merged} onPatchProject={persistProject} />
        </div>
        </div>
      </div>

      {editModal?.kind === "project" ? (
        <EditProjectModal
          open
          clientName={merged.client.name}
          draft={draftProject}
          onDraftChange={(patch) => setDraftProject((d) => ({ ...d, ...patch }))}
          statusOptions={PROJECT_STATUS_OPTIONS}
          onClose={closeModal}
          onSubmit={saveProjectModal}
          onDelete={() => void handleDeleteProject()}
          deleting={deletingProject}
          projectNumberMessage={projectNumberMessage}
          projectNumberConflict={Boolean(projectNumberMessage)}
        />
      ) : null}

      {quoteModalOpen ? (
        <RequestVendorQuotesModal
          project={merged}
          jobs={jobs}
          vendors={vendors}
          onClose={() => setQuoteModalOpen(false)}
          onSend={(updates) => {
            const now = new Date().toISOString();
            persistJobs((prev) =>
              prev.map((j) => {
                const added = updates.get(j.id);
                if (!added?.length) return j;
                const quoteRequested = j.estimate?.quote_requested_date ?? now;
                return {
                  ...j,
                  vendor_quotes: [...(j.vendor_quotes ?? []), ...added],
                  estimate: j.estimate
                    ? { ...j.estimate, quote_requested_date: quoteRequested }
                    : j.estimate,
                  updated_at: now,
                };
              }),
            );
            setQuoteModalOpen(false);
            dispatchAppToast("Vendor quote requests sent");
          }}
        />
      ) : null}

      {modalJob ? (
        <JobDetailsModal
          project={merged}
          job={normalizeJob(modalJob, merged)}
          allJobs={jobs}
          orders={orders}
          clientCode={clientCode}
          operatorCode={operatorCode}
          vendors={vendors}
          focus={jobDetailsFocus ?? undefined}
          isNew={editModal?.kind === "job" && editModal.jobId === "__new__"}
          onClose={closeModal}
          onSave={handleSaveJob}
          onDelete={handleDeleteJob}
          deleting={deletingJob}
        />
      ) : null}
    </div>
  );
}
