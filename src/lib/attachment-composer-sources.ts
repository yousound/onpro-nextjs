import type { AttachmentComposerDraft, ChatAttachmentKind } from "@/lib/attachment-composer-draft";
import { draftFromDocumentRow, defaultAttachmentComposerDraft } from "@/lib/attachment-composer-draft";
import { draftFieldsFromProjectJob, jobAttachmentOptionLabel } from "@/lib/attachment-composer-job";
import { packingSlipCompanyName } from "@/lib/packing-slip";
import { generatePoForJob } from "@/lib/po-context";
import type { DocumentRow } from "@/lib/types/documents";
import type { PackingSlipDocument } from "@/lib/types/packing-slip";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";
import type { CalendarEvent } from "@/lib/types/calendar";
import {
  blankCalendarComposerFields,
  calendarEventSourceLabel,
  draftFromCalendarEvent,
  parseCalendarSourceId,
} from "@/lib/calendar-events-store";

export type AttachmentSourceOption = {
  id: string;
  label: string;
  sublabel?: string;
};

export type AttachmentSourceContext = {
  project: Project | null;
  jobs: ProjectJob[];
  documents: DocumentRow[];
  calendarEvents: CalendarEvent[];
  roomTitle: string;
};

export function listAttachmentSources(
  kind: ChatAttachmentKind,
  ctx: AttachmentSourceContext,
): AttachmentSourceOption[] {
  const { project, jobs, documents, calendarEvents } = ctx;

  if (kind === "calendar_event") {
    const clientName = project?.client.name?.trim().toLowerCase();
    return calendarEvents
      .filter((e) => {
        if (!clientName) return true;
        const link = e.link_to_client?.trim().toLowerCase();
        return !link || link === clientName || link.includes(clientName);
      })
      .map((e) => ({
        id: `calendar:${e.id}`,
        label: e.name,
        sublabel: calendarEventSourceLabel(e),
      }));
  }

  if (!project) return [];

  const pid = project.id;

  switch (kind) {
    case "job":
      return jobs.map((j) => ({
        id: `job:${j.id}`,
        label: jobAttachmentOptionLabel(j),
        sublabel: [j.status, j.po_number].filter(Boolean).join(" · "),
      }));
    case "packing_list":
      return (project.packaging_slips ?? []).map((s) => ({
        id: `packing:${s.id}`,
        label: s.document_number,
        sublabel: `${s.ship_to_name} · ${s.lines.length} lines`,
      }));
    case "purchase_order": {
      const pos = new Set<string>();
      if (project.po_number?.trim()) pos.add(project.po_number.trim());
      for (const j of jobs) {
        if (j.po_number?.trim()) pos.add(j.po_number.trim());
      }
      return [...pos].map((p) => ({ id: `po:${p}`, label: p, sublabel: project.name }));
    }
    case "tracking":
      if (project.tracking_bol_number?.trim() || project.shipping_method?.trim()) {
        return [
          {
            id: "tracking:project",
            label: project.tracking_bol_number?.trim() || "Project shipment",
            sublabel: project.shipping_method?.trim() ?? undefined,
          },
        ];
      }
      return [];
    case "invoice":
      return documents
        .filter((d) => d.project_id === pid && d.kind === "invoice")
        .map((d) => ({ id: `doc:${d.id}`, label: d.name, sublabel: "Document library" }));
    case "quote":
      return documents
        .filter((d) => d.project_id === pid && d.kind === "quote")
        .map((d) => ({ id: `doc:${d.id}`, label: d.name, sublabel: "Document library" }));
    case "estimate":
      return documents
        .filter((d) => d.project_id === pid && (d.kind === "tech_pack" || d.kind === "quote"))
        .map((d) => ({ id: `doc:${d.id}`, label: d.name, sublabel: d.kind === "tech_pack" ? "Tech pack" : "Quote" }));
    case "approval": {
      const fromDocs = documents
        .filter((d) => d.project_id === pid && d.kind !== "invoice")
        .map((d) => ({ id: `doc:${d.id}`, label: d.name, sublabel: "Document library" }));
      const fromLabels = jobs.flatMap((j) =>
        (j.label_files ?? []).map((f) => ({
          id: `label:${j.id}:${f.id}`,
          label: f.name,
          sublabel: j.name,
        })),
      );
      return [...fromLabels, ...fromDocs];
    }
    case "receiving":
      if (project.tracking_bol_number?.trim()) {
        return [
          {
            id: "receiving:bol",
            label: project.tracking_bol_number.trim(),
            sublabel: "From project shipping",
          },
        ];
      }
      return [];
    case "payment":
    case "task":
      return [];
    default:
      return [];
  }
}

export function draftFromPackingSlip(
  slip: PackingSlipDocument,
  roomTitle: string,
  base: AttachmentComposerDraft,
): AttachmentComposerDraft {
  return {
    ...base,
    kind: "packing_list",
    selectedSourceId: `packing:${slip.id}`,
    packingListNo: slip.document_number,
    packingCompanyName: packingSlipCompanyName(slip),
    packingShipDate: slip.ship_date?.slice(0, 10) ?? "",
    projectName: base.projectName || roomTitle,
    fromName: slip.ship_from_name,
    fromAddr: slip.ship_from_address,
    toName: slip.ship_to_name,
    toAddr: slip.ship_to_address,
    trackCarrier: slip.carrier,
    trackNo: slip.tracking_number,
    lines: slip.lines.map((l) => ({
      id: l.id,
      description: [l.style_number, l.description, l.colorway, l.size].filter(Boolean).join(" · "),
      units: String(l.quantity),
      price: String(l.cartons || 0),
    })),
    notes: slip.notes ?? "",
  };
}

export function applyAttachmentSource(
  kind: ChatAttachmentKind,
  sourceId: string,
  base: AttachmentComposerDraft,
  ctx: AttachmentSourceContext,
): AttachmentComposerDraft | null {
  const { project, jobs, documents, roomTitle } = ctx;
  if (!project || !sourceId) return null;

  if (sourceId.startsWith("job:")) {
    const job = jobs.find((j) => j.id === sourceId.slice(4));
    if (!job) return null;
    return {
      ...base,
      kind: "job",
      selectedSourceId: sourceId,
      ...draftFieldsFromProjectJob(job),
      projectName: project.name,
    };
  }

  if (sourceId.startsWith("packing:")) {
    const slip = project.packaging_slips?.find((s) => s.id === sourceId.slice(8));
    if (!slip) return null;
    return draftFromPackingSlip(slip, roomTitle, { ...base, projectName: project.name });
  }

  if (sourceId.startsWith("po:")) {
    const po = sourceId.slice(3);
    const vendor = jobs.find((j) => j.po_number === po)?.lead_vendor ?? jobs[0]?.lead_vendor ?? "";
    return {
      ...base,
      kind: "purchase_order",
      selectedSourceId: sourceId,
      poNo: po,
      vendor,
      projectName: project.name,
      poLines: jobs
        .filter((j) => j.po_number === po)
        .map((j) => `${j.style_number} ${j.name}`.trim())
        .join(" · "),
    };
  }

  if (sourceId === "tracking:project") {
    return {
      ...base,
      kind: "tracking",
      selectedSourceId: sourceId,
      trackCarrier: project.shipping_method?.trim() ?? base.trackCarrier,
      trackNo: project.tracking_bol_number?.trim() ?? base.trackNo,
      projectName: project.name,
    };
  }

  if (sourceId === "receiving:bol") {
    return {
      ...base,
      kind: "receiving",
      selectedSourceId: sourceId,
      recvBol: project.tracking_bol_number?.trim() ?? base.recvBol,
      recvSummary: `${project.name} · ${project.shipping_method ?? "Receiving"}`,
      projectName: project.name,
    };
  }

  if (sourceId.startsWith("doc:")) {
    const docId = Number(sourceId.slice(4));
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return null;
    const fromDoc = draftFromDocumentRow(doc, roomTitle);
    return { ...fromDoc, selectedSourceId: sourceId, projectName: project.name };
  }

  if (sourceId.startsWith("label:")) {
    const [, jobId, fileId] = sourceId.split(":");
    const job = jobs.find((j) => j.id === jobId);
    const file = job?.label_files?.find((f) => f.id === fileId);
    if (!job || !file) return null;
    return {
      ...base,
      kind: "approval",
      selectedSourceId: sourceId,
      approvalFile: file.name,
      approvalNote: `Job: ${job.name} (${job.style_number})`,
      projectName: project.name,
    };
  }

  if (kind === "calendar_event" && sourceId.startsWith("calendar:")) {
    const id = parseCalendarSourceId(sourceId);
    if (id == null) return null;
    const ev = ctx.calendarEvents.find((e) => e.id === id);
    if (!ev) return null;
    return draftFromCalendarEvent(ev, base);
  }

  return null;
}

export function newAttachmentDraftForKind(
  kind: ChatAttachmentKind,
  ctx: AttachmentSourceContext,
): AttachmentComposerDraft {
  const { project, jobs, roomTitle } = ctx;
  const base = defaultAttachmentComposerDraft(roomTitle);
  if (kind === "calendar_event") {
    return {
      ...base,
      kind: "calendar_event",
      ...blankCalendarComposerFields(roomTitle, project?.client.name),
    };
  }
  if (!project) {
    return { ...base, kind, selectedSourceId: "" };
  }

  const withProject = { ...base, kind, selectedSourceId: "", projectName: project.name, toName: roomTitle };

  switch (kind) {
    case "purchase_order":
      return {
        ...withProject,
        poNo: generatePoForJob(project),
        vendor: jobs[0]?.lead_vendor ?? withProject.vendor,
        poLines: jobs.length
          ? jobs.map((j) => `${j.style_number} ${j.name}`.trim()).join(" · ")
          : withProject.poLines,
      };
    case "tracking":
      return {
        ...withProject,
        trackCarrier: project.shipping_method?.trim() ?? withProject.trackCarrier,
        trackNo: project.tracking_bol_number?.trim() ?? "",
      };
    case "packing_list":
      return {
        ...withProject,
        packingListNo: "",
        toName: project.client.name,
      };
    case "job":
      return { ...withProject, jobId: "" };
    default:
      return withProject;
  }
}

export function sourcePickerLabel(kind: ChatAttachmentKind): string {
  switch (kind) {
    case "job":
      return "Job";
    case "packing_list":
      return "Packing list";
    case "purchase_order":
      return "Purchase order";
    case "invoice":
      return "Invoice";
    case "quote":
      return "Quote";
    case "estimate":
      return "Estimate";
    case "approval":
      return "Approval file";
    case "tracking":
      return "Shipment";
    case "receiving":
      return "Receiving record";
    case "calendar_event":
      return "Calendar event";
    default:
      return "Existing item";
  }
}
