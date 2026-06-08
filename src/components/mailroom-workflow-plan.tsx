"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ProjectModalPanelHeader } from "@/components/project-modal-ui";
import type { AgentSuggestion, MailroomRfqIntake, MailroomWorkflow, MailroomWorkflowStep } from "@/lib/types/agent";
import { MailroomRfqIntakeConfirmedBanner } from "@/components/mailroom-rfq-intake-card";
import {
  isRfqIntakeConfirmed,
  rfqIntakeRequiresConfirmation,
} from "@/lib/mailroom/rfq-intake";
import { sanitizeJobDisplayName } from "@/lib/job-display-name";
import { MAILROOM_Z_WORKFLOW_SUCCESS } from "@/lib/mailroom/modal-layers";
import {
  workflowMissingProjectMessage,
  workflowProjectAlreadyCreated,
  workflowStepNeedsProject,
  type WorkflowSuccessSummary,
} from "@/lib/mailroom/workflow-utils";
import { formatPayloadValue } from "@/lib/mailroom/workflow-utils";
import { orderedPayloadEntries } from "@/lib/mailroom/payload-field-order";
import { generatedKindFromSuggestion } from "@/lib/agent-apply";

const SECTION_BADGE: Record<string, string> = {
  project: "bg-sky-100 text-sky-800",
  job: "bg-violet-100 text-violet-800",
  vendor_quote: "bg-blue-100 text-blue-800",
  costing_line: "bg-amber-100 text-amber-800",
  estimate: "bg-emerald-100 text-emerald-800",
  invoice: "bg-rose-100 text-rose-800",
  client_po: "bg-orange-100 text-orange-800",
  sample: "bg-pink-100 text-pink-800",
  packing_list: "bg-teal-100 text-teal-800",
  task: "bg-slate-100 text-slate-800",
};

function stepBadge(kind: AgentSuggestion["kind"]) {
  const g = generatedKindFromSuggestion(kind);
  return SECTION_BADGE[g] ?? "bg-slate-100 text-slate-800";
}

function workflowStepDisplayTitle(step: MailroomWorkflowStep): string {
  if (step.kind === "create_job") {
    return sanitizeJobDisplayName(step.title) || step.title;
  }
  return step.title;
}

function workflowApplyingMessage(
  workflow: MailroomWorkflow,
  applyingStepId: string | null,
): string {
  if (!applyingStepId) return "Working…";
  if (applyingStepId === "all") return "Running workflow steps…";
  const step = workflow.steps.find((s) => s.step_id === applyingStepId);
  if (!step) return "Working…";
  switch (step.kind) {
    case "create_project":
      return "Creating project…";
    case "create_order":
      return "Creating production order…";
    case "create_job":
      return "Creating jobs…";
    case "generate_estimate":
      return "Generating estimate…";
    case "create_invoice":
      return "Creating invoice…";
    default:
      return `Running: ${step.title}…`;
  }
}

function StepPayloadSummary({ step }: { step: MailroomWorkflowStep }) {
  const entries = Object.entries(step.payload).filter(
    ([k, v]) => k !== "workflow_step_id" && v !== undefined && v !== "",
  );
  if (entries.length === 0 && !step.auto_contact) return null;
  return (
    <ul className="mt-1.5 space-y-0.5 text-[11px]">
      {step.auto_contact ? (
        <li className="flex justify-between gap-3 text-amber-800">
          <span className="font-semibold uppercase">Will add client</span>
          <span className="text-right font-mono">
            {step.auto_contact.company ?? step.auto_contact.name ?? step.auto_contact.email}
          </span>
        </li>
      ) : null}
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-3">
          <span className="font-semibold uppercase text-text-secondary">{k.replaceAll("_", " ")}</span>
          <span className="max-w-[58%] truncate text-right font-mono text-text-primary">
            {formatPayloadValue(v)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function MailroomWorkflowPlan({
  workflow,
  projects,
  onPreview,
  onApproveStep,
  onSkipStep,
  onRunAllRemaining,
  onLinkExistingProject,
  onCreateNewProject,
  workflowLocked = false,
  lockReason,
  surface = "dock",
  applyingStepId = null,
  onClearAiResults,
}: {
  workflow: MailroomWorkflow;
  projects: Array<{ id: number; name: string; client: string }>;
  /** When true (RFQ intake not confirmed), step actions are disabled. */
  workflowLocked?: boolean;
  lockReason?: string;
  surface?: "dock" | "modal";
  applyingStepId?: string | null;
  onClearAiResults?: () => void;
  onPreview: (
    step: MailroomWorkflowStep,
    suggestion: AgentSuggestion,
    attachMode?: boolean,
  ) => void;
  onApproveStep: (step: MailroomWorkflowStep) => void;
  onSkipStep: (step: MailroomWorkflowStep) => void;
  onRunAllRemaining: () => void;
  onLinkExistingProject: (projectId: number) => void;
  onCreateNewProject: () => void;
}) {
  const pendingCount = workflow.steps.filter((s) => s.status === "pending").length;
  const workflowBusy = Boolean(applyingStepId);
  const existingProjectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const projectAlreadyCreated = workflowProjectAlreadyCreated(workflow, existingProjectIds);
  const missingProjectMessage = workflowMissingProjectMessage(workflow, existingProjectIds);
  const actionsDisabled = workflowLocked || workflowBusy;
  const matchedProject =
    workflow.project_match.project_id != null
      ? projects.find((p) => p.id === workflow.project_match.project_id)
      : undefined;
  const linkedProject =
    workflow.link_existing_project_id != null
      ? projects.find((p) => p.id === workflow.link_existing_project_id)
      : undefined;

  const shellClass =
    surface === "modal"
      ? "px-1 py-1"
      : "shrink-0 border-b border-violet-200 bg-gradient-to-b from-violet-50/90 to-white px-5 py-4";

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {surface === "dock" ? (
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-accent">Workflow plan</p>
            <p className="mt-0.5 text-sm text-text-primary">
              {workflow.steps.length} step{workflow.steps.length === 1 ? "" : "s"} · review each before
              running
            </p>
            {workflow.thread_intent === "new_client_rfq" ? (
              <p className="mt-1 text-[11px] text-text-secondary">
                Client quote request — project and jobs first.
              </p>
            ) : null}
          </div>
        ) : workflow.thread_intent === "new_client_rfq" ? (
          <p className="text-[11px] text-text-secondary">Client quote request — project and jobs first.</p>
        ) : (
          <span />
        )}
        {pendingCount > 1 ? (
          <button
            type="button"
            onClick={onRunAllRemaining}
            disabled={actionsDisabled || Boolean(missingProjectMessage)}
            title={missingProjectMessage ?? lockReason}
            className="shrink-0 rounded-lg border border-accent/40 bg-white px-3 py-1.5 text-xs font-semibold text-accent hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run all remaining ({pendingCount})
          </button>
        ) : null}
      </div>

      {workflowBusy ? (
        <p
          className="mt-2 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/90 px-3 py-2.5 text-[12px] font-medium text-violet-950"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-violet-300 border-t-accent"
            aria-hidden
          />
          {workflowApplyingMessage(workflow, applyingStepId)}
        </p>
      ) : null}

      {missingProjectMessage ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-[12px] font-medium text-amber-900">
          {missingProjectMessage}
        </p>
      ) : null}

      {actionsDisabled && lockReason && !workflowBusy ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] font-medium text-amber-900">
          {lockReason}
        </p>
      ) : null}

      {linkedProject ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-[12px] font-medium text-emerald-900">
          Using existing project: <span className="font-semibold">{linkedProject.name}</span> (
          {linkedProject.client}) — create-project step skipped.
        </p>
      ) : null}

      {workflow.project_match.confidence !== "none" && matchedProject ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-[12px]">
          <p className="font-semibold text-amber-900">
            Possible match: {matchedProject.name} ({matchedProject.client})
          </p>
          {workflow.project_match.reason ? (
            <p className="mt-0.5 text-amber-800">{workflow.project_match.reason}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onLinkExistingProject(matchedProject.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                workflow.link_existing_project_id === matchedProject.id
                  ? "bg-accent text-white"
                  : "bg-white text-accent ring-1 ring-accent/30"
              }`}
            >
              Use existing project
            </button>
            <button
              type="button"
              onClick={onCreateNewProject}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                workflow.link_existing_project_id === null
                  ? "bg-accent text-white"
                  : "bg-white text-text-secondary ring-1 ring-border-light"
              }`}
            >
              Create new project
            </button>
          </div>
        </div>
      ) : null}

      <ol className="mt-3 space-y-2">
        {workflow.steps.map((step, index) => {
          const suggestion: AgentSuggestion = {
            id: step.suggestion_id,
            thread_id: workflow.thread_id,
            kind: step.kind,
            title: step.title,
            payload: {
              ...step.payload,
              ...(step.auto_contact ? { auto_contact: step.auto_contact } : {}),
            },
            status: step.status === "applied" ? "applied" : "pending",
            created_at: workflow.created_at,
          };
          const isPending = step.status === "pending";
          const isFirstPending =
            isPending && workflow.steps.findIndex((s) => s.status === "pending") === index;
          const isApplying =
            workflowBusy &&
            (applyingStepId === step.step_id || applyingStepId === "all");
          const createProjectBlocked =
            step.kind === "create_project" &&
            projectAlreadyCreated &&
            isPending;
          const needsProjectBlocked =
            isPending &&
            workflowStepNeedsProject(step.kind) &&
            Boolean(missingProjectMessage);

          return (
            <li
              key={step.step_id}
              className={`rounded-xl border px-3 py-2.5 ${
                step.status === "applied"
                  ? "border-emerald-200 bg-emerald-50/60"
                  : step.status === "skipped"
                    ? "border-border-light bg-slate-50 opacity-70"
                    : isFirstPending
                      ? "border-accent/50 bg-white shadow-sm ring-1 ring-accent/20"
                      : "border-border-light bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold text-text-secondary">{index + 1}.</span>
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold ${stepBadge(step.kind)}`}
                    >
                      {step.kind.replaceAll("_", " ")}
                    </span>
                    {step.status === "applied" ? (
                      <span className="text-[10px] font-semibold text-emerald-700">Done</span>
                    ) : step.status === "skipped" ? (
                      <span className="text-[10px] font-semibold text-text-secondary">Skipped</span>
                    ) : isApplying ? (
                      <span className="text-[10px] font-semibold text-violet-700">Working…</span>
                    ) : isFirstPending ? (
                      <span className="text-[10px] font-semibold text-accent">Up next</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-text-primary">
                    {workflowStepDisplayTitle(step)}
                  </p>
                  <StepPayloadSummary step={step} />
                </div>
              </div>
              {isPending ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onPreview(step, suggestion)}
                    disabled={actionsDisabled}
                    title={lockReason}
                    className="rounded-lg border border-border-light bg-white px-2.5 py-1 text-[11px] font-semibold text-text-primary hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Preview & edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onPreview(step, suggestion, true)}
                    disabled={actionsDisabled}
                    title={lockReason}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Quick generate
                  </button>
                  <button
                    type="button"
                    onClick={() => onApproveStep(step)}
                    disabled={
                      !isFirstPending ||
                      actionsDisabled ||
                      createProjectBlocked ||
                      needsProjectBlocked ||
                      isApplying
                    }
                    title={
                      createProjectBlocked
                        ? "Project already created for this workflow"
                        : needsProjectBlocked
                          ? missingProjectMessage ?? "Create a project first"
                          : actionsDisabled
                            ? lockReason ?? "Please wait…"
                            : undefined
                    }
                    className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isApplying ? "Working…" : "Approve & run"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkipStep(step)}
                    disabled={workflowBusy}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Skip
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Polished follow-up modal after workflow steps finish — “Go to your project”. */
export function MailroomWorkflowSuccessModal({
  open,
  summary,
  onStayInMailroom,
  onViewProject,
}: {
  open: boolean;
  summary: WorkflowSuccessSummary;
  onStayInMailroom: () => void;
  onViewProject: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStayInMailroom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onStayInMailroom]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[228] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      style={{ zIndex: MAILROOM_Z_WORKFLOW_SUCCESS }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onStayInMailroom();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mailroom-workflow-success-title"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/90"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-[#6d28d9] via-[#7c3aed] to-violet-800 px-6 pb-8 pt-10 text-center text-white">
          <div
            className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/30"
            aria-hidden
          >
            <span className="text-3xl font-bold leading-none">✓</span>
          </div>
          <h2 id="mailroom-workflow-success-title" className="mt-5 text-xl font-bold tracking-tight">
            You&apos;re all set
          </h2>
          <p className="mt-1.5 text-sm text-violet-100">Your project is ready in the workspace</p>
        </div>

        <div className="px-6 py-6">
          <p className="text-center text-lg font-bold text-slate-900">{summary.projectName}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {summary.projectCreated ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                Project created
              </span>
            ) : null}
            {summary.jobsCreated > 0 ? (
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800 ring-1 ring-violet-200">
                {summary.jobsCreated} job{summary.jobsCreated === 1 ? "" : "s"}
              </span>
            ) : null}
            {summary.skippedCount > 0 ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                {summary.skippedCount} skipped
              </span>
            ) : null}
          </div>
          <p className="mt-5 text-center text-sm leading-relaxed text-slate-500">
            Review jobs, orders, and production details on the project page.
          </p>

          <button
            type="button"
            onClick={onViewProject}
            className="mt-6 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 hover:opacity-95"
          >
            Go to your project
          </button>
          <button
            type="button"
            onClick={onStayInMailroom}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Stay in Mailroom
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type WorkflowPlanModalProps = {
  open: boolean;
  /** When true, Escape / backdrop dismiss on the workflow modal are suppressed. */
  childOverlayOpen?: boolean;
  workflow: MailroomWorkflow;
  projects: Array<{ id: number; name: string; client: string }>;
  rfqIntake?: MailroomRfqIntake;
  workflowLocked?: boolean;
  lockReason?: string;
  workflowApplying?: string | null;
  onDismiss: () => void;
  /** When all steps are finished — open the success follow-up modal. */
  onFinishWorkflow?: () => void;
  onEditRfqIntake?: () => void;
  onPreview: (
    step: MailroomWorkflowStep,
    suggestion: AgentSuggestion,
    attachMode?: boolean,
  ) => void;
  onApproveStep: (step: MailroomWorkflowStep) => void;
  onSkipStep: (step: MailroomWorkflowStep) => void;
  onRunAllRemaining: () => void;
  onLinkExistingProject: (projectId: number) => void;
  onCreateNewProject: () => void;
  onClearAiResults?: () => void;
};

/** Full workflow steps in a modal over the conversation (easier to read than the bottom dock). */
export function MailroomWorkflowPlanModal({
  open,
  childOverlayOpen = false,
  workflowApplying = null,
  onDismiss,
  onFinishWorkflow,
  onClearAiResults,
  rfqIntake,
  onEditRfqIntake,
  ...planProps
}: WorkflowPlanModalProps) {
  const [mounted, setMounted] = useState(false);
  const pendingCount = planProps.workflow.steps.filter((s) => s.status === "pending").length;
  const workflowBusy = Boolean(workflowApplying);
  const workflowFinished = pendingCount === 0 && !workflowBusy;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || childOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (workflowFinished && onFinishWorkflow) onFinishWorkflow();
      else onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, childOverlayOpen, onDismiss, workflowFinished, onFinishWorkflow]);

  if (!open || !mounted) return null;

  const showRfqBanner =
    rfqIntake &&
    isRfqIntakeConfirmed(rfqIntake) &&
    rfqIntakeRequiresConfirmation(planProps.workflow);

  return createPortal(
    <div
      className="fixed inset-0 z-[225] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (childOverlayOpen) return;
        if (e.target === e.currentTarget) {
          if (workflowFinished && onFinishWorkflow) onFinishWorkflow();
          else onDismiss();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mailroom-workflow-plan-title"
        className="flex max-h-[min(820px,92vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/90"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <ProjectModalPanelHeader
          title="Workflow plan"
          subtitle={
            workflowFinished
              ? "All steps finished — tap Done to continue"
              : `${planProps.workflow.steps.length} step${planProps.workflow.steps.length === 1 ? "" : "s"} · ${pendingCount} pending — review and run each task`
          }
          onClose={() => {
            if (workflowBusy) return;
            if (workflowFinished && onFinishWorkflow) onFinishWorkflow();
            else onDismiss();
          }}
        />
        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {workflowBusy ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 bg-white/50"
              aria-hidden
            />
          ) : null}
          {showRfqBanner ? (
            <MailroomRfqIntakeConfirmedBanner
              intake={rfqIntake}
              onEdit={onEditRfqIntake ?? onDismiss}
            />
          ) : null}
          <MailroomWorkflowPlan
            {...planProps}
            applyingStepId={workflowApplying}
            onClearAiResults={onClearAiResults}
            surface="modal"
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 bg-white px-5 py-3">
          {onClearAiResults ? (
            <button
              type="button"
              onClick={onClearAiResults}
              disabled={workflowBusy}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear AI results
            </button>
          ) : null}
          {workflowFinished && onFinishWorkflow ? (
            <button
              type="button"
              onClick={onFinishWorkflow}
              className="ml-auto rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              disabled={workflowBusy}
              className="ml-auto rounded-lg border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
