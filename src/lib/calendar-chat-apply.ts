"use client";

import { localDayAndTimeToIso } from "@/lib/calendar-utils";
import { upsertCalendarEvent } from "@/lib/calendar-events-store";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { updateProjectInDb } from "@/lib/data/persist-project";
import { upsertLiveProject } from "@/lib/data/live-cache";
import { patchProjectOverlay } from "@/lib/calendar-chat-apply-project";
import type { CalendarChatProposal } from "@/lib/openai/calendar-chat-reply";
import type { CalendarEvent, CalendarEventType } from "@/lib/types/calendar";
import type { Project } from "@/lib/types/project";

const EVENT_TYPES: CalendarEventType[] = [
  "shipping",
  "meeting",
  "deadline",
  "sample_review",
  "production",
  "other",
];

function applyEventPatch(event: CalendarEvent, patch: Record<string, unknown>): CalendarEvent {
  const next = { ...event };
  if (typeof patch.name === "string") next.name = patch.name.trim() || next.name;
  if (typeof patch.description === "string") next.description = patch.description.trim() || null;
  if (typeof patch.date === "string") next.date = patch.date.slice(0, 10);
  if (typeof patch.start_time === "string") next.start_time = patch.start_time;
  if (typeof patch.end_time === "string") next.end_time = patch.end_time;
  if (typeof patch.delivery_by === "string") next.delivery_by = patch.delivery_by.trim() || null;
  if (typeof patch.shipped_from === "string") next.shipped_from = patch.shipped_from.trim() || null;
  if (typeof patch.shipped_to === "string") next.shipped_to = patch.shipped_to.trim() || null;
  if (typeof patch.type_of_product === "string") next.type_of_product = patch.type_of_product.trim() || null;
  if (typeof patch.po === "string") next.po = patch.po.trim() || null;
  if (typeof patch.invoice === "string") next.invoice = patch.invoice.trim() || null;
  if (typeof patch.notes === "string") next.notes = patch.notes.trim() || null;
  if (typeof patch.department === "string") next.department = patch.department.trim() || null;
  if (typeof patch.link_to_client === "string") next.link_to_client = patch.link_to_client.trim() || null;
  if (typeof patch.event_type === "string" && EVENT_TYPES.includes(patch.event_type as CalendarEventType)) {
    next.event_type = patch.event_type as CalendarEventType;
  }
  // Allow HH:MM on same day
  if (typeof patch.start === "string" && typeof patch.date !== "string") {
    next.start_time = localDayAndTimeToIso(next.date, patch.start);
  }
  if (typeof patch.end === "string") {
    next.end_time = localDayAndTimeToIso(next.date, patch.end);
  }
  return next;
}

function applyProjectPatch(project: Project, patch: Record<string, unknown>): Partial<Project> {
  const out: Partial<Project> = {};
  const str = (k: keyof Project) => {
    const v = patch[k as string];
    if (typeof v === "string") (out as Record<string, unknown>)[k as string] = v.trim() || null;
  };
  str("shipping_method");
  str("shipping_terms");
  str("tracking_bol_number");
  str("po_number");
  str("project_number");
  str("status_overview");
  str("lead_vendor");
  for (const k of [
    "packing_list_received_date",
    "packing_list_sent_to_client_date",
    "ex_factory_date",
    "bulk_target_delivery_date",
    "client_received_date",
  ] as const) {
    const v = patch[k];
    if (typeof v === "string") out[k] = v.trim() || null;
  }
  if (typeof patch.status === "string") out.status = patch.status as Project["status"];
  return out;
}

export type ApplyCalendarProposalResult = {
  ok: boolean;
  message: string;
  event: CalendarEvent;
  project: Project | null;
};

export async function applyCalendarChatProposal(opts: {
  event: CalendarEvent;
  proposal: CalendarChatProposal;
  seedIds: ReadonlySet<number>;
  linkedProject: Project | null;
}): Promise<ApplyCalendarProposalResult> {
  let event = opts.event;
  let project = opts.linkedProject;
  const parts: string[] = [];

  if (opts.proposal.event_patch && Object.keys(opts.proposal.event_patch).length > 0) {
    event = applyEventPatch(event, opts.proposal.event_patch);
    event = upsertCalendarEvent(event, opts.seedIds);
    parts.push("Calendar event updated");
  }

  if (opts.proposal.project_patch && Object.keys(opts.proposal.project_patch).length > 0) {
    const id = opts.proposal.project_id ?? project?.id;
    if (id == null) {
      return { ok: false, message: "No project linked to apply project fields.", event, project };
    }
    if (!project || project.id !== id) {
      return { ok: false, message: "Project not loaded — open Projects first.", event, project };
    }
    const patch = applyProjectPatch(project, opts.proposal.project_patch);
    if (Object.keys(patch).length === 0) {
      return { ok: false, message: "No valid project fields in proposal.", event, project };
    }
    if (isClientLiveBackend()) {
      project = await updateProjectInDb(project.id, patch);
      upsertLiveProject(project);
    } else {
      project = patchProjectOverlay(project, patch);
    }
    window.dispatchEvent(new Event("onpro-projects-changed"));
    parts.push(`Project “${project.name}” updated`);
  }

  return {
    ok: true,
    message: parts.length ? parts.join(". ") + "." : "Nothing to apply.",
    event,
    project,
  };
}
