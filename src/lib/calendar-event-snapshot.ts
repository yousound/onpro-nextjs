import type { CalendarEvent } from "@/lib/types/calendar";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

export type CalendarEventContext = {
  event: Record<string, unknown>;
  linked_project: Record<string, unknown> | null;
  link_reason: string | null;
  jobs: Array<Record<string, unknown>>;
  project_field_guide: Record<string, string>;
};

const PROJECT_FIELD_GUIDE: Record<string, string> = {
  shipping_method: "Carrier / shipping method",
  shipping_terms: "Shipping terms (FOB, etc.)",
  tracking_bol_number: "Tracking or BOL number",
  packing_list_received_date: "Packing list received",
  packing_list_sent_to_client_date: "Packing list sent to client",
  ex_factory_date: "Ex-factory date",
  bulk_target_delivery_date: "Bulk target delivery",
  client_received_date: "Client received date",
  po_number: "Client PO / project PO",
  project_number: "Internal project number",
  status_overview: "Status overview note",
  lead_vendor: "Lead vendor",
};

function pickProjectFields(p: Project): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    client: p.client.name,
    po_number: p.po_number,
    project_number: p.project_number,
    due_date: p.due_date,
    shipping_method: p.shipping_method,
    shipping_terms: p.shipping_terms,
    tracking_bol_number: p.tracking_bol_number,
    packing_list_received_date: p.packing_list_received_date,
    packing_list_sent_to_client_date: p.packing_list_sent_to_client_date,
    ex_factory_date: p.ex_factory_date,
    bulk_target_delivery_date: p.bulk_target_delivery_date,
    client_received_date: p.client_received_date,
    status_overview: p.status_overview,
    lead_vendor: p.lead_vendor,
  };
}

function pickEventFields(e: CalendarEvent): Record<string, unknown> {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    date: e.date,
    start_time: e.start_time,
    end_time: e.end_time,
    event_type: e.event_type,
    delivery_by: e.delivery_by,
    shipped_from: e.shipped_from,
    shipped_to: e.shipped_to,
    type_of_product: e.type_of_product,
    po: e.po,
    invoice: e.invoice,
    department: e.department,
    notes: e.notes,
    link_to_client: e.link_to_client,
    external_id: e.external_id ?? null,
    calendar_owner_email: e.calendar_owner_email ?? null,
  };
}

export function buildCalendarEventContext(
  event: CalendarEvent,
  project: Project | null,
  jobs: ProjectJob[],
  linkReason: string | null,
): CalendarEventContext {
  return {
    event: pickEventFields(event),
    linked_project: project ? pickProjectFields(project) : null,
    link_reason: linkReason,
    jobs: jobs.slice(0, 12).map((j) => ({
      id: j.id,
      name: j.name,
      status: j.status,
      subtitle: j.subtitle,
      po_number: j.po_number,
      lead_vendor: j.lead_vendor,
    })),
    project_field_guide: PROJECT_FIELD_GUIDE,
  };
}
