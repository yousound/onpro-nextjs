"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Project, ProjectStatus } from "@/lib/types/project";
import type {
  JobDetailsFocus,
  ProjectJob,
  JobScopeKind,
} from "@/lib/types/wip";
import { dateInputToIso, formatShortDate, isoToDateInput } from "@/lib/format";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { createNewJobSeed } from "@/lib/project-job-create";
import {
  loadProjectJobs,
  saveProjectJobs,
} from "@/lib/project-wip-edits";
import { loadContacts, vendorContacts } from "@/lib/contacts-store";
import { clientCodeByName } from "@/lib/reference/client-codes";
import { normalizeJob } from "@/lib/job-defaults";
import type { ProjectModuleId } from "@/lib/project-modules";
import { parseProjectModuleTab, PROJECT_MODULE_TABS } from "@/lib/project-modules";
import { ContentHeader } from "@/components/content-header";
import {
  InternalDevelopmentPanel,
  ProjectDetailsClientCard,
  ProjectModuleRouter,
} from "@/components/project-module-panels";
import { WipProgressSummary } from "@/components/wip-timeline";
import { JobDetailsModal } from "@/components/job-details-modal";

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

type EditModal =
  | { kind: "project" }
  | { kind: "job"; jobId: string }
  | { kind: "job-new" }
  | null;

function statusBadgeClass(status: ProjectStatus): string {
  switch (status) {
    case "COMPLETED":
    case "DELIVERED":
      return "bg-violet-100 text-violet-800";
    case "IN-PROGRESS":
      return "bg-violet-100 text-violet-700";
    case "PENDING":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function jobStatusClass(status: ProjectJob["status"]): string {
  if (status === "In progress") return "bg-violet-100 text-violet-800";
  if (status === "Completed") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-600";
}

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

const JOB_COL_COUNT = 10;

type JobScopeFilter = "all" | JobScopeKind;

function effectiveJobScope(job: ProjectJob): JobScopeKind {
  return job.scope_kind ?? "original";
}

function JobScopeBadge({ kind }: { kind: JobScopeKind }) {
  if (kind === "original") return null;
  return (
    <span className="inline-flex shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-400/55">
      Add-on
    </span>
  );
}

function JobTableRow({
  job,
  onOpenDetails,
}: {
  job: ProjectJob;
  onOpenDetails: (jobId: string) => void;
}) {
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(job.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails(job.id);
        }
      }}
      className="cursor-pointer border-b border-l-4 border-l-transparent border-border-light bg-white transition hover:bg-slate-50/80"
    >
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-text-primary">{job.name}</span>
          <JobScopeBadge kind={effectiveJobScope(job)} />
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">{job.subtitle}</p>
        {effectiveJobScope(job) === "addon" && job.scope_note ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-amber-900/85">{job.scope_note}</p>
        ) : null}
      </td>
      <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{job.type}</td>
      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{job.lead_vendor}</td>
      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{job.category}</td>
      <td className="hidden px-4 py-3 text-text-secondary xl:table-cell">{job.style_number}</td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-xs font-medium text-text-secondary lg:table-cell">
        {job.po_number ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span
          className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${jobStatusClass(job.status)}`}
        >
          {job.status}
        </span>
      </td>
      <td className="w-28 max-w-[7rem] px-4 py-3">
        <WipProgressSummary steps={job.timeline} />
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-text-secondary sm:table-cell">
        {formatShortDate(job.due_date)}
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-text-secondary md:table-cell">
        {formatShortDate(job.updated_at)}
      </td>
    </tr>
  );
}

export function ProjectJobsView({ project }: { project: Project }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [projectPatch, setProjectPatch] = useState<Partial<Project>>({});
  const [jobs, setJobs] = useState<ProjectJob[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [editModal, setEditModal] = useState<EditModal>(null);
  const [activeModule, setActiveModule] = useState<ProjectModuleId>("details");

  const [draftProject, setDraftProject] = useState({
    name: "",
    status: "IN-PROGRESS" as ProjectStatus,
    project_number: "",
    hand_off: "",
    due_date: "",
    status_overview: "",
    status_update: "",
  });
  const [jobDetailsFocus, setJobDetailsFocus] = useState<JobDetailsFocus | null>(null);
  const [newJobSeed, setNewJobSeed] = useState<ProjectJob | null>(null);
  const [jobScopeFilter, setJobScopeFilter] = useState<JobScopeFilter>("all");

  useEffect(() => {
    const mod = searchParams.get("module");
    setActiveModule(parseProjectModuleTab(mod));
  }, [searchParams]);

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
    setProjectPatch(patch);
    const mergedProject = { ...project, ...patch };
    const loadedJobs = loadProjectJobs(project.id, mergedProject);
    setJobs(loadedJobs);
    setHydrated(true);
  }, [project, project.id]);

  const merged = useMemo(() => ({ ...project, ...projectPatch }), [project, projectPatch]);

  const clientCode = useMemo(
    () => clientCodeByName(merged.client.name) ?? "GG",
    [merged.client.name],
  );

  const vendors = useMemo(() => vendorContacts(loadContacts()), []);

  const persistProject = useCallback(
    (next: Partial<Project>) => {
      const patch = { ...projectPatch, ...next };
      setProjectPatch(patch);
      writeMockLs(MOCK_LS.project(project.id), patch);
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

  useEffect(() => {
    if (editModal?.kind !== "project") return;
    setDraftProject({
      name: merged.name,
      status: merged.status,
      project_number: merged.project_number ?? "",
      hand_off: isoToDateInput(merged.project_hand_off_date),
      due_date: isoToDateInput(merged.due_date),
      status_overview: merged.status_overview ?? "",
      status_update: isoToDateInput(merged.status_update_date),
    });
  }, [editModal, merged]);

  function openJobEdit(jobId: string) {
    setEditModal({ kind: "job", jobId });
    setJobDetailsFocus(null);
  }

  function openNewJob() {
    setNewJobSeed(createNewJobSeed(project, jobs));
    setEditModal({ kind: "job-new" });
    setJobDetailsFocus(null);
  }

  function closeModal() {
    setEditModal(null);
    setNewJobSeed(null);
    setJobDetailsFocus(null);
  }

  function handleSaveJob(saved: ProjectJob) {
    if (editModal?.kind === "job-new") {
      persistJobs((prev) => [...prev, saved]);
    } else {
      persistJobs((prev) => prev.map((j) => (j.id === saved.id ? saved : j)));
    }
    closeModal();
  }

  function openProjectEdit() {
    setEditModal({ kind: "project" });
  }

  function saveProjectModal(e: FormEvent) {
    e.preventDefault();
    persistProject({
      name: draftProject.name.trim() || merged.name,
      status: draftProject.status,
      project_number: draftProject.project_number.trim() || null,
      project_hand_off_date: dateInputToIso(draftProject.hand_off),
      due_date: dateInputToIso(draftProject.due_date),
      status_overview: draftProject.status_overview.trim() || null,
      status_update_date: dateInputToIso(draftProject.status_update),
    });
    closeModal();
  }

  const filteredJobs = useMemo(() => {
    if (jobScopeFilter === "all") return jobs;
    return jobs.filter((j) => effectiveJobScope(j) === jobScopeFilter);
  }, [jobs, jobScopeFilter]);

  const modalJob = useMemo(() => {
    if (editModal?.kind === "job-new") return newJobSeed;
    if (editModal?.kind === "job") {
      return jobs.find((j) => j.id === editModal.jobId) ?? null;
    }
    return null;
  }, [editModal, jobs, newJobSeed]);

  if (!hydrated) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
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
        <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">Loading…</div>
      </div>
    );
  }

  const jobsTableSection = (
    <section className="flex min-h-0 flex-col pb-4 pt-2">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-text-primary">
            Jobs ({filteredJobs.length}
            {jobScopeFilter !== "all" ? (
              <span className="font-normal normal-case text-text-secondary">
                {" "}
                · {jobs.length} total
              </span>
            ) : null}
            )
          </h2>
          <p className="text-xs text-text-secondary">
            Tap a row to open Job Details. Scope filters separate original deliverables from add-ons.
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter jobs by scope"
        >
          {(
            [
              { id: "all" as const, label: "All" },
              { id: "original" as const, label: "Original" },
              { id: "addon" as const, label: "Add-ons" },
            ] satisfies { id: JobScopeFilter; label: string }[]
          ).map((opt) => {
            const on = jobScopeFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setJobScopeFilter(opt.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  on
                    ? "bg-accent text-white shadow-sm"
                    : "bg-surface-card text-text-secondary ring-1 ring-border-light hover:text-text-primary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm">
        <div className="min-h-0 max-h-[min(560px,50vh)] overflow-auto bg-white sm:max-h-none sm:flex-1">
          <table className="min-w-full bg-white text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border-light bg-white text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="hidden px-4 py-3 md:table-cell">Type</th>
                <th className="hidden px-4 py-3 lg:table-cell">Lead vendor</th>
                <th className="hidden px-4 py-3 lg:table-cell">Category</th>
                <th className="hidden px-4 py-3 xl:table-cell">Style #</th>
                <th className="hidden px-4 py-3 lg:table-cell">PO #</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="w-28 max-w-[7rem] px-4 py-3">Progress</th>
                <th className="hidden px-4 py-3 sm:table-cell">Due date</th>
                <th className="hidden px-4 py-3 md:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={JOB_COL_COUNT} className="px-4 py-12 text-center text-text-secondary">
                    No jobs yet for this project (mock).
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={JOB_COL_COUNT} className="px-4 py-12 text-center text-text-secondary">
                    No jobs match this scope filter.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <JobTableRow key={job.id} job={job} onOpenDetails={openJobEdit} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 border-t border-border-light bg-white py-3 text-center">
          <button
            type="button"
            onClick={openNewJob}
            className="text-sm font-semibold text-accent hover:underline"
          >
            + New job
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
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

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden bg-white px-4 sm:px-6">
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 pt-4 pb-2">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl">{merged.name}</h1>
            {merged.po_number ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-text-secondary">
                PO {merged.po_number}
              </span>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(merged.status)}`}
            >
              {merged.status}
            </span>
          </div>
          {activeModule === "details" ? (
            <button
              type="button"
              onClick={openProjectEdit}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Edit project
            </button>
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeModule === "details" ? (
            <div className="space-y-5">
              <ProjectDetailsClientCard project={merged} />
              {jobsTableSection}
            </div>
          ) : null}

          {activeModule === "internal" ? (
            <div className="space-y-6">
              <InternalDevelopmentPanel project={merged} onPatchProject={persistProject} />
            </div>
          ) : null}

          <ProjectModuleRouter moduleId={activeModule} project={merged} onPatchProject={persistProject} />
        </div>
      </div>

      {editModal?.kind === "project" ? (
        <ModalShell
          titleId="edit-project-title"
          title="Edit project"
          description={`Saved in this browser — ${MOCK_LS.project(project.id)}`}
          onClose={closeModal}
        >
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveProjectModal}>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className={labelClass}>
                Name
                <input
                  className={fieldClass}
                  value={draftProject.name}
                  onChange={(e) => setDraftProject((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className={labelClass}>
                Status
                <select
                  className={fieldClass}
                  value={draftProject.status}
                  onChange={(e) =>
                    setDraftProject((d) => ({ ...d, status: e.target.value as ProjectStatus }))
                  }
                >
                  {PROJECT_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Project #
                <input
                  className={fieldClass}
                  value={draftProject.project_number}
                  onChange={(e) => setDraftProject((d) => ({ ...d, project_number: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  Hand off
                  <input
                    type="date"
                    className={fieldClass}
                    value={draftProject.hand_off}
                    onChange={(e) => setDraftProject((d) => ({ ...d, hand_off: e.target.value }))}
                  />
                </label>
                <label className={labelClass}>
                  Due date
                  <input
                    type="date"
                    className={fieldClass}
                    value={draftProject.due_date}
                    onChange={(e) => setDraftProject((d) => ({ ...d, due_date: e.target.value }))}
                  />
                </label>
                <label className={labelClass}>
                  Status update
                  <input
                    type="date"
                    className={fieldClass}
                    value={draftProject.status_update}
                    onChange={(e) => setDraftProject((d) => ({ ...d, status_update: e.target.value }))}
                  />
                </label>
              </div>
              <label className={labelClass}>
                Status overview
                <textarea
                  className={fieldClass}
                  rows={3}
                  value={draftProject.status_overview}
                  onChange={(e) => setDraftProject((d) => ({ ...d, status_overview: e.target.value }))}
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
                Save
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {modalJob ? (
        <JobDetailsModal
          project={merged}
          job={normalizeJob(modalJob, merged)}
          allJobs={jobs}
          clientCode={clientCode}
          vendors={vendors}
          focus={jobDetailsFocus ?? undefined}
          isNew={editModal?.kind === "job-new"}
          onClose={closeModal}
          onSave={handleSaveJob}
        />
      ) : null}
    </div>
  );
}
