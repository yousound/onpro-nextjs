import {
  extractClientPoFromThread,
  inferBrandClientName,
  isWorkspaceOperatorClientName,
} from "@/lib/mailroom/client-from-rfq";
import {
  inferClientNameForProject,
  inferProjectNameFromThread,
} from "@/lib/mailroom/project-from-thread";
import {
  inferTeamContactFromThread,
  inferVendorNameFromThread,
  type ParticipantRole,
} from "@/lib/mailroom/thread-participants";
import { inferVendorNameFromThreadWithContacts } from "@/lib/mailroom/vendor-from-thread";
import type { Contact } from "@/lib/types/contact";
import type {
  EmailThread,
  MailroomRfqIntake,
  MailroomWorkflow,
  MailroomWorkflowStep,
} from "@/lib/types/agent";

export type { ParticipantRole } from "@/lib/mailroom/thread-participants";
export {
  defaultParticipantRole,
  inferTeamContactFromThread,
  inferVendorNameFromThread,
  threadParticipantRoles,
} from "@/lib/mailroom/thread-participants";

function projectStepPayload(workflow: MailroomWorkflow): Record<string, unknown> {
  return (
    workflow.steps.find((s) => s.kind === "create_project")?.payload ?? {}
  );
}

export function buildRfqIntakeDraft(
  thread: EmailThread,
  workflow: MailroomWorkflow,
  existing?: MailroomRfqIntake | null,
  contacts?: Contact[],
): MailroomRfqIntake {
  if (existing?.confirmed_at) return existing;

  const overrides = existing?.participant_role_overrides;
  const projectPayload = projectStepPayload(workflow);
  const subject = thread.subject ?? "";
  const firstJob = workflow.steps.find((s) => s.kind === "create_job");
  const nameHints = {
    threadSubject: subject,
    jobTitle: firstJob?.title,
    jobPayload: firstJob?.payload,
  };
  const poFromThread = extractClientPoFromThread(thread);
  const clientHint = String(
    projectPayload.client ?? projectPayload.client_name ?? projectPayload.company ?? "",
  ).trim();
  const projectNameHint = String(projectPayload.name ?? projectPayload.project_name ?? "").trim();
  const inferredProjectName = inferProjectNameFromThread({
    ...nameHints,
    projectName: projectNameHint || undefined,
  });

  let clientName = clientHint;
  if (!clientName || isWorkspaceOperatorClientName(clientName)) {
    clientName =
      inferClientNameForProject({
        ...nameHints,
        projectName: inferredProjectName ?? (projectNameHint || undefined),
      }) ??
      inferBrandClientName(projectNameHint, subject) ??
      inferBrandClientName(clientHint, subject) ??
      "";
  }

  const dueRaw = String(projectPayload.due_date ?? projectPayload.dueDate ?? "").trim();
  const due_date = /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;

  const payloadPo = String(projectPayload.client_po_number ?? projectPayload.po_number ?? "").trim();
  return {
    client_name: existing?.client_name?.trim() || clientName,
    client_po: existing?.client_po?.trim() || payloadPo || poFromThread || "",
    client_po_tbd: existing?.client_po_tbd ?? false,
    project_name:
      existing?.project_name?.trim() ||
      projectNameHint ||
      inferredProjectName ||
      thread.subject.replace(/^PO#?\s*\S+\s*[-–]\s*/i, "").trim() ||
      "New project",
    due_date: existing?.due_date ?? due_date,
    team_contact_name: existing?.team_contact_name?.trim() || null,
    team_contact_email: existing?.team_contact_email?.trim() || null,
    vendor_name:
      existing?.vendor_name?.trim() ||
      (contacts?.length
        ? inferVendorNameFromThreadWithContacts(thread, contacts, overrides)
        : inferVendorNameFromThread(thread, overrides)),
    participant_role_overrides: overrides,
    create_estimate:
      existing?.create_estimate ??
      (existing as { create_order?: boolean } | undefined)?.create_order ??
      true,
    confirmed_at: null,
  };
}

export function isRfqIntakeConfirmed(intake: MailroomRfqIntake | null | undefined): boolean {
  return Boolean(intake?.confirmed_at);
}

export function rfqIntakeRequiresConfirmation(workflow: MailroomWorkflow): boolean {
  return (
    workflow.thread_intent === "new_client_rfq" &&
    workflow.link_existing_project_id == null
  );
}

/** RFQ must be confirmed before running workflow steps (does not block chat or email tabs). */
export function mailroomNeedsRfqConfirm(
  summarized: boolean,
  workflow: MailroomWorkflow | undefined,
  intake: MailroomRfqIntake | null | undefined,
): boolean {
  return Boolean(
    summarized &&
      workflow &&
      rfqIntakeRequiresConfirmation(workflow) &&
      !isRfqIntakeConfirmed(intake),
  );
}

/** @deprecated Use mailroomNeedsRfqConfirm — kept for call sites during migration. */
export function mailroomIntakeGateActive(
  summarized: boolean,
  workflow: MailroomWorkflow | undefined,
  intake: MailroomRfqIntake | null | undefined,
): boolean {
  return Boolean(
    summarized &&
      workflow &&
      rfqIntakeRequiresConfirmation(workflow) &&
      !isRfqIntakeConfirmed(intake),
  );
}

export function mergeIntakeIntoStepPayload(
  step: MailroomWorkflowStep,
  intake: MailroomRfqIntake,
): Record<string, unknown> {
  const clientPo = intake.client_po_tbd ? "" : intake.client_po.trim();
  if (step.kind === "create_project") {
    const next: Record<string, unknown> = {
      ...step.payload,
      client: intake.client_name.trim(),
      client_name: intake.client_name.trim(),
      name: intake.project_name.trim(),
      project_name: intake.project_name.trim(),
      due_date: intake.due_date ?? undefined,
    };
    if (clientPo) next.client_po_number = clientPo;
    if (intake.vendor_name?.trim()) {
      const vendor = intake.vendor_name.trim();
      next.lead_vendor = vendor;
      next.vendor = vendor;
      next.vendor_name = vendor;
    }
    if (intake.team_contact_name?.trim()) {
      const team = intake.team_contact_name.trim();
      next.lead_team_member = team;
      next.team_contact_name = team;
    }
    if (step.auto_contact) {
      next.auto_contact = {
        ...step.auto_contact,
        company: intake.client_name.trim(),
        email: undefined,
      };
    }
    return next;
  }
  if (step.kind === "create_order" && clientPo) {
    return { ...step.payload, client_po_number: clientPo };
  }
  if (step.kind === "create_job" && intake.vendor_name?.trim()) {
    return {
      ...step.payload,
      vendor: intake.vendor_name.trim(),
      supplier: intake.vendor_name.trim(),
    };
  }
  return { ...step.payload };
}

export function applyIntakeToWorkflow(
  workflow: MailroomWorkflow,
  intake: MailroomRfqIntake,
): MailroomWorkflow {
  if (!isRfqIntakeConfirmed(intake)) return workflow;
  return {
    ...workflow,
    steps: workflow.steps.map((step) => {
      const payload = mergeIntakeIntoStepPayload(step, intake);
      const auto = payload.auto_contact as MailroomWorkflowStep["auto_contact"];
      return {
        ...step,
        payload,
        ...(step.kind === "create_project" && auto ? { auto_contact: auto } : {}),
      };
    }),
  };
}

export function validateRfqIntakeDraft(
  draft: MailroomRfqIntake,
): { ok: true } | { ok: false; message: string } {
  if (!draft.client_name.trim()) {
    return { ok: false, message: "Enter the end client (brand) name." };
  }
  if (!draft.project_name.trim()) {
    return { ok: false, message: "Enter a project name." };
  }
  if (!draft.client_po_tbd && !draft.client_po.trim()) {
    return { ok: false, message: "Enter the client PO or mark it as TBD." };
  }
  return { ok: true };
}
