"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Project, ProjectStatus } from "@/lib/types/project";
import type { ProjectJob, WipStep, WipStepState } from "@/lib/types/wip";
import { dateInputToIso, formatShortDate, isoToDateInput, normalizeDurationShort } from "@/lib/format";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import {
  JOB_STATUS_OPTIONS,
  WIP_STEP_STATES,
  loadProjectJobs,
  loadProjectTimelineSteps,
  patchProjectStep,
  saveProjectJobs,
  saveProjectTimelineSteps,
} from "@/lib/project-wip-edits";
import type { ProjectModuleId } from "@/lib/project-modules";
import { PROJECT_MODULE_TABS } from "@/lib/project-modules";
import { ContentHeader } from "@/components/content-header";
import {
  InternalDevelopmentPanel,
  ProjectDetailsClientCard,
  ProjectModuleRouter,
} from "@/components/project-module-panels";
import { WipProgressSummary, WipTimeline } from "@/components/wip-timeline";

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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1 text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function stepStateLabel(state: WipStepState): string {
  if (state === "completed") return "Done";
  if (state === "in_progress") return "In progress";
  if (state === "na") return "N/A";
  return "Upcoming";
}

function StepStateSelect({
  value,
  onChange,
}: {
  value: WipStepState;
  onChange: (state: WipStepState) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as WipStepState)}
      className="rounded-lg border border-border-light bg-white px-2 py-1 text-xs font-medium text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      aria-label="Step status"
    >
      {WIP_STEP_STATES.map((s) => (
        <option key={s} value={s}>
          {stepStateLabel(s)}
        </option>
      ))}
    </select>
  );
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

const JOB_COL_COUNT = 9;

function JobTableRow({ job, onOpen }: { job: ProjectJob; onOpen: () => void }) {
  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer border-b border-border-light bg-white transition hover:bg-slate-50/80"
    >
      <td className="px-4 py-3">
        <div className="font-semibold text-text-primary">{job.name}</div>
        <p className="mt-0.5 text-xs text-text-secondary">{job.subtitle}</p>
      </td>
      <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{job.type}</td>
      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{job.lead_vendor}</td>
      <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{job.category}</td>
      <td className="hidden px-4 py-3 text-text-secondary xl:table-cell">{job.style_number}</td>
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

function cloneSteps(steps: WipStep[]): WipStep[] {
  return steps.map((s) => ({ ...s }));
}

function cloneJob(job: ProjectJob): ProjectJob {
  return { ...job, timeline: cloneSteps(job.timeline) };
}

export function ProjectJobsView({ project }: { project: Project }) {
  const [projectPatch, setProjectPatch] = useState<Partial<Project>>({});
  const [jobs, setJobs] = useState<ProjectJob[]>([]);
  const [projectTimeline, setProjectTimeline] = useState<WipStep[]>([]);
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
  const [draftTimeline, setDraftTimeline] = useState<WipStep[]>([]);
  const [draftJob, setDraftJob] = useState<ProjectJob | null>(null);

  useEffect(() => {
    const saved = readMockLs<Partial<Project>>(MOCK_LS.project(project.id));
    const patch = saved && typeof saved === "object" ? saved : {};
    setProjectPatch(patch);
    setJobs(loadProjectJobs(project.id));
    setProjectTimeline(loadProjectTimelineSteps(project.id, { ...project, ...patch }));
    setHydrated(true);
  }, [project, project.id]);

  const merged = useMemo(() => ({ ...project, ...projectPatch }), [project, projectPatch]);

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

  const persistTimeline = useCallback((steps: WipStep[]) => {
    setProjectTimeline(steps);
    saveProjectTimelineSteps(project.id, steps);
  }, [project.id]);

  const handleTimelineDurationChange = useCallback(
    (stepId: string, durationShort: string) => {
      setProjectTimeline((prev) => {
        const next = patchProjectStep(prev, stepId, {
          durationShort: durationShort || undefined,
        });
        saveProjectTimelineSteps(project.id, next);
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
    setDraftTimeline(cloneSteps(projectTimeline));
  }, [editModal, merged, projectTimeline]);

  useEffect(() => {
    if (editModal?.kind === "job") {
      const job = jobs.find((j) => j.id === editModal.jobId);
      setDraftJob(job ? cloneJob(job) : null);
      return;
    }
    if (editModal?.kind === "job-new") {
      const template = jobs[0]?.timeline ?? [
        { id: "tp_setup", label: "Tech pack", state: "upcoming" as const },
        { id: "quote", label: "Quote / costing", state: "upcoming" as const },
        { id: "strike", label: "Strike-off", state: "upcoming" as const },
        { id: "bulk_fabric", label: "Bulk fabric", state: "upcoming" as const },
        { id: "top", label: "TOP", state: "upcoming" as const },
        { id: "ex_factory", label: "Ex-factory", state: "upcoming" as const },
      ];
      setDraftJob({
        id: `job-${project.id}-${Date.now()}`,
        project_id: project.id,
        name: "",
        subtitle: "",
        type: "",
        lead_vendor: "",
        category: "",
        style_number: "",
        status: "Upcoming",
        due_date: null,
        updated_at: new Date().toISOString(),
        timeline: cloneSteps(template),
      });
    }
  }, [editModal, jobs, project.id]);

  function openProjectEdit() {
    setEditModal({ kind: "project" });
  }

  function openJobEdit(jobId: string) {
    setEditModal({ kind: "job", jobId });
  }

  function openNewJob() {
    setEditModal({ kind: "job-new" });
  }

  function closeModal() {
    setEditModal(null);
    setDraftJob(null);
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
    persistTimeline(draftTimeline);
    closeModal();
  }

  function saveJobModal(e: FormEvent) {
    e.preventDefault();
    if (!draftJob) return;
    const saved = { ...draftJob, updated_at: new Date().toISOString() };
    if (editModal?.kind === "job-new") {
      persistJobs((prev) => [...prev, saved]);
    } else {
      persistJobs((prev) => prev.map((j) => (j.id === saved.id ? saved : j)));
    }
    closeModal();
  }

  function updateDraftJobStep(stepId: string, state: WipStepState) {
    setDraftJob((prev) =>
      prev
        ? {
            ...prev,
            timeline: prev.timeline.map((s) => (s.id === stepId ? { ...s, state } : s)),
          }
        : null,
    );
  }

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
          className="-mx-1 shrink-0 overflow-x-auto pb-2"
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
                  onClick={() => setActiveModule(t.id)}
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
              <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetaItem label="Project #" value={merged.project_number ?? "—"} />
                <MetaItem label="Client" value={merged.client.name} />
                <MetaItem label="Hand off" value={formatShortDate(merged.project_hand_off_date)} />
                <MetaItem label="Due date" value={formatShortDate(merged.due_date)} />
                <MetaItem label="Status overview" value={merged.status_overview ?? "—"} />
                <MetaItem label="Status update" value={formatShortDate(merged.status_update_date)} />
              </div>
              <section className="shrink-0 py-1">
                <h2 className="mb-3 text-sm font-semibold text-text-primary">Connect the dots timeline</h2>
                <WipTimeline
                  steps={projectTimeline}
                  editableDurations={hydrated}
                  onDurationChange={handleTimelineDurationChange}
                />
              </section>
            </div>
          ) : null}

          {activeModule === "internal" ? (
            <div className="space-y-6">
              <InternalDevelopmentPanel project={merged} />
              <section className="flex min-h-0 flex-col pb-4">
                <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-text-primary">
                      Jobs ({jobs.length})
                    </h2>
                    <p className="text-xs text-text-secondary">Click a row to edit a job.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-border-light bg-white px-3 py-1.5 text-xs font-medium text-text-secondary">
                      Group by ▾
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-border-light bg-white p-1.5 text-text-secondary"
                      aria-label="Filter"
                    >
                      <FilterIcon />
                    </button>
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
                        ) : (
                          jobs.map((job) => (
                            <JobTableRow key={job.id} job={job} onOpen={() => openJobEdit(job.id)} />
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
                      + Add job
                    </button>
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          <ProjectModuleRouter moduleId={activeModule} project={merged} />
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
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Project timeline steps
                </h3>
                <ul className="mt-2 space-y-2">
                  {draftTimeline.map((s, stepIndex) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 text-text-primary">{s.label}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        {stepIndex < draftTimeline.length - 1 ? (
                          <label className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                            Days →
                            <input
                              type="text"
                              className="w-16 rounded-lg border border-border-light bg-white px-2 py-1 text-xs font-semibold tabular-nums text-text-primary"
                              placeholder="1d"
                              value={s.durationShort ?? ""}
                              onChange={(e) =>
                                setDraftTimeline((steps) =>
                                  steps.map((step) =>
                                    step.id === s.id
                                      ? { ...step, durationShort: e.target.value || undefined }
                                      : step,
                                  ),
                                )
                              }
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (!v) return;
                                const normalized = normalizeDurationShort(v);
                                if (normalized === v) return;
                                setDraftTimeline((steps) =>
                                  steps.map((step) =>
                                    step.id === s.id ? { ...step, durationShort: normalized } : step,
                                  ),
                                );
                              }}
                            />
                          </label>
                        ) : null}
                        <StepStateSelect
                          value={s.state}
                          onChange={(state) =>
                            setDraftTimeline((steps) =>
                              steps.map((step) => (step.id === s.id ? { ...step, state } : step)),
                            )
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
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

      {(editModal?.kind === "job" || editModal?.kind === "job-new") && draftJob ? (
        <ModalShell
          titleId="edit-job-title"
          title={editModal.kind === "job-new" ? "Add job" : `Edit job — ${draftJob.name || "Untitled"}`}
          description={`Saved in this browser — ${MOCK_LS.projectJobs(project.id)}`}
          onClose={closeModal}
        >
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveJobModal}>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <label className={labelClass}>
                Job name
                <input
                  className={fieldClass}
                  value={draftJob.name}
                  onChange={(e) => setDraftJob((j) => (j ? { ...j, name: e.target.value } : j))}
                />
              </label>
              <label className={labelClass}>
                Subtitle
                <input
                  className={fieldClass}
                  value={draftJob.subtitle}
                  onChange={(e) => setDraftJob((j) => (j ? { ...j, subtitle: e.target.value } : j))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  Type
                  <input
                    className={fieldClass}
                    value={draftJob.type}
                    onChange={(e) => setDraftJob((j) => (j ? { ...j, type: e.target.value } : j))}
                  />
                </label>
                <label className={labelClass}>
                  Status
                  <select
                    className={fieldClass}
                    value={draftJob.status}
                    onChange={(e) =>
                      setDraftJob((j) =>
                        j ? { ...j, status: e.target.value as ProjectJob["status"] } : j,
                      )
                    }
                  >
                    {JOB_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className={labelClass}>
                Lead vendor
                <input
                  className={fieldClass}
                  value={draftJob.lead_vendor}
                  onChange={(e) => setDraftJob((j) => (j ? { ...j, lead_vendor: e.target.value } : j))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={labelClass}>
                  Category
                  <input
                    className={fieldClass}
                    value={draftJob.category}
                    onChange={(e) => setDraftJob((j) => (j ? { ...j, category: e.target.value } : j))}
                  />
                </label>
                <label className={labelClass}>
                  Style #
                  <input
                    className={fieldClass}
                    value={draftJob.style_number}
                    onChange={(e) => setDraftJob((j) => (j ? { ...j, style_number: e.target.value } : j))}
                  />
                </label>
              </div>
              <label className={labelClass}>
                Due date
                <input
                  type="date"
                  className={fieldClass}
                  value={isoToDateInput(draftJob.due_date)}
                  onChange={(e) =>
                    setDraftJob((j) => (j ? { ...j, due_date: dateInputToIso(e.target.value) } : j))
                  }
                />
              </label>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Job timeline steps
                </h3>
                <ul className="mt-2 space-y-2">
                  {draftJob.timeline.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-text-primary">{s.label}</span>
                      <StepStateSelect value={s.state} onChange={(state) => updateDraftJobStep(s.id, state)} />
                    </li>
                  ))}
                </ul>
              </div>
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
    </div>
  );
}
