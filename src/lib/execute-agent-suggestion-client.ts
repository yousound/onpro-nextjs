"use client";

import type { AgentApplyResult } from "@/lib/agent-apply-core";
import type { AgentSuggestion, AgentSuggestionKind } from "@/lib/types/agent";
import {
  findClientByPayload,
  listResolvableProjects,
  resolveJobForSuggestion,
  resolveProjectForSuggestion,
  type SuggestionResolveContext,
} from "@/lib/agent-suggestion-resolve";
import { normalizeRfqProjectPayload } from "@/lib/mailroom/client-from-rfq";
import { poPrefixMismatch } from "@/lib/po-client-code";
import { orderDisplayLabel } from "@/lib/effective-po";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { persistProjectToDb, updateProjectInDb } from "@/lib/data/persist-project";
import { upsertLiveProject } from "@/lib/data/live-cache";
import { contactDisplayName, loadContacts, newContactId, saveContacts } from "@/lib/contacts-store";
import { persistContactToDb } from "@/lib/data/persist-contact";
import {
  generateEstimateFromSheet,
  costingLineFromVendorQuote,
  emptyCostingSheet,
  mergeProjectJobCostingSheets,
  newCostingLine,
  newVendorQuote,
} from "@/lib/costing-sheet";
import {
  applyMergedProjectEstimate,
  projectHasClientEstimate,
  sortJobsForEstimate,
} from "@/lib/project-estimate-merge";
import { sanitizeJobDisplayName } from "@/lib/job-display-name";
import { defaultJobApprovals, defaultJobFulfillment, normalizeJob } from "@/lib/job-defaults";
import { reassignMailroomDocumentJobs } from "@/lib/documents/import-mailroom-images";
import { createNewJobSeed } from "@/lib/project-job-create";
import { appendSessionProject, readSessionProjects } from "@/lib/mock/project-session";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import { resolveClientCode } from "@/lib/reference/client-codes";
import { sanitizeClientEmail } from "@/lib/client-email";
import { applyMailroomJobPayloadExtras } from "@/lib/mailroom/job-ingest";
import { collectAllAppPoNumbers } from "@/lib/po-context";
import { generatePoNumber, projectPoNumber, resolveProjectNumber } from "@/lib/po-number";
import { createPackingSlipDraft } from "@/lib/packing-slip";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";
import {
  createFirstProjectOrder,
  getOrCreateOrderForJob,
  loadProjectOrders,
  saveProjectOrders,
} from "@/lib/project-order-edits";
import { resolveOperatorCompanyCode } from "@/lib/operator-company-code";
import { readExtraCalendarEvents, writeExtraCalendarEvents } from "@/lib/calendar-events-store";
import type { Contact } from "@/lib/types/contact";
import type { Client, Project, ProjectStatus } from "@/lib/types/project";
import { deriveCompanyCode } from "@/lib/types/contact";
import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import type { DocumentRow } from "@/lib/types/documents";
import type { PackingSlipVariant } from "@/lib/types/packing-slip";
import type { ProjectJob } from "@/lib/types/wip";
import type { CalendarEvent } from "@/lib/types/calendar";

export type ExecuteAgentSuggestionOptions = SuggestionResolveContext;

function nowIso(): string {
  return new Date().toISOString();
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function patchProjectOverlay(project: Project, patch: Partial<Project>): Project {
  const merged = { ...project, ...patch };
  const prev = readMockLs<Partial<Project>>(MOCK_LS.project(project.id)) ?? {};
  writeMockLs(MOCK_LS.project(project.id), { ...prev, ...patch });

  const session = readSessionProjects();
  if (session.some((p) => p.id === project.id)) {
    const next = session.map((p) => (p.id === project.id ? { ...p, ...patch } : p));
    if (typeof window !== "undefined") {
      localStorage.setItem("onpro-session-projects-v1", JSON.stringify(next));
    }
  }

  if (isClientLiveBackend()) {
    upsertLiveProject(merged);
  }
  return merged;
}

function saveJob(project: Project, job: ProjectJob): ProjectJob {
  const jobs = loadProjectJobs(project.id, project);
  const idx = jobs.findIndex((j) => j.id === job.id);
  const next = idx >= 0 ? jobs.map((j, i) => (i === idx ? job : j)) : [...jobs, job];
  saveProjectJobs(project.id, next);
  return normalizeJob(job, project);
}

function projectDeepLink(projectId: number, jobId?: string): string {
  return jobId ? `/projects/${projectId}?job=${encodeURIComponent(jobId)}` : `/projects/${projectId}`;
}

function leadVendorFromPayload(payload: Record<string, unknown>): string | null {
  const v = String(payload.lead_vendor ?? payload.vendor ?? payload.vendor_name ?? "").trim();
  return v || null;
}

function leadTeamMemberFromPayload(payload: Record<string, unknown>): string | null {
  const v = String(payload.lead_team_member ?? payload.team_contact_name ?? "").trim();
  return v || null;
}

function buildMockProject(
  name: string,
  client: Client,
  description?: string,
  clientPoNumber?: string | null,
  leadVendor?: string | null,
  leadTeamMember?: string | null,
): Project {
  const projects = listResolvableProjects();
  const nextId = Math.max(0, ...projects.map((p) => p.id)) + 1;
  const clientCode = resolveClientCode(client.name);
  const po = resolveProjectNumber(
    clientCode,
    clientPoNumber,
    collectAllAppPoNumbers(projects),
  );
  const status: ProjectStatus = "Development";
  return {
    id: nextId,
    name,
    description: description?.trim() || null,
    project_number: po,
    po_number: po,
    project_hand_off_date: null,
    due_date: null,
    client,
    status,
    status_overview: null,
    status_update_date: null,
    style_number: null,
    style_name: null,
    category: null,
    type: null,
    lead_vendor: leadVendor ?? null,
    colorways: [],
    in_development: [],
    lead_team_member: leadTeamMember ?? null,
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
    tracking_bol_number: null,
    packing_list_received_date: null,
    packing_list_sent_to_client_date: null,
    client_received_date: null,
    packaging_slips: [],
  };
}

async function ensureClientContact(
  payload: Record<string, unknown>,
): Promise<{ contact: Contact; created: boolean } | null> {
  const contacts = loadContacts();
  const existing = findClientByPayload(contacts, payload);
  if (existing) return { contact: existing, created: false };

  const auto = payload.auto_contact as Record<string, unknown> | undefined;
  const company = String(
    payload.client ?? payload.client_name ?? payload.company ?? auto?.company ?? "",
  ).trim();
  const email = sanitizeClientEmail(String(auto?.email ?? payload.email ?? ""));
  const contactName = String(auto?.name ?? payload.contact_name ?? "").trim();

  if (!company && !email && !contactName) return null;

  const now = nowIso();
  const contact: Contact = {
    id: newContactId(),
    segment: "client",
    kind: "company",
    company_code: resolveClientCode(company || contactName),
    name: company || contactName || email,
    contact_name: contactName || undefined,
    email: email || "",
    avatar_url: null,
    member_contact_ids: [],
    permissions: defaultPermissionsForSegment("client"),
    created_at: now,
    updated_at: now,
  };

  if (isClientLiveBackend()) {
    try {
      const saved = await persistContactToDb(contact);
      if (!saved) return null;
      return { contact: saved, created: true };
    } catch {
      return null;
    }
  }

  saveContacts([...contacts, contact]);
  return { contact, created: true };
}

async function execCreateProject(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): Promise<AgentApplyResult> {
  const payload = normalizeRfqProjectPayload(
    suggestion.payload ?? {},
    ctx.threadSubject,
    ctx.threadBodies,
  );
  const ensured = await ensureClientContact(payload);
  const clientContact =
    ensured?.contact ?? findClientByPayload(loadContacts(), payload);
  if (!clientContact) {
    return { ok: false, message: "Add a client in Contacts first, then try again." };
  }

  const name =
    String(payload.name ?? payload.project_name ?? suggestion.title.replace(/^Create project:?\s*/i, "")).trim() ||
    "New project";
  const clientId = Number(clientContact.id);
  if (!Number.isFinite(clientId)) {
    return { ok: false, message: "Could not resolve client for this project." };
  }

  const dueDateRaw = String(payload.due_date ?? payload.dueDate ?? "").trim();
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) ? dueDateRaw : null;
  const clientPoNumber = String(payload.client_po_number ?? payload.po_number ?? "").trim() || null;
  const leadVendor = leadVendorFromPayload(payload);
  const leadTeamMember = leadTeamMemberFromPayload(payload);

  const client: Client = {
    id: clientId,
    name: contactDisplayName(clientContact),
    avatar_url: clientContact.avatar_url ?? null,
  };

  const contactNote = ensured?.created
    ? ` Added client “${contactDisplayName(clientContact)}” to Contacts.`
    : "";
  const poMismatch = poPrefixMismatch(
    contactDisplayName(clientContact),
    clientContact.company_code || resolveClientCode(client.name),
    clientPoNumber,
  );
  const poMismatchNote = poMismatch.message ? ` Note: ${poMismatch.message}` : "";

  if (isClientLiveBackend()) {
    try {
      const clientCode = clientContact.company_code || resolveClientCode(client.name);
      const po = resolveProjectNumber(
        clientCode,
        clientPoNumber,
        collectAllAppPoNumbers(),
      );
      const saved = await persistProjectToDb({
        name,
        description: String(payload.notes ?? payload.description ?? "").trim() || null,
        clientId,
        status: "Development",
        projectNumber: po,
        dueDate,
        leadTeamMember,
        leadVendor,
      });
      upsertLiveProject(saved);
      return {
        ok: true,
        message: `Created project “${saved.name}” for ${client.name}.${contactNote}${poMismatchNote}`,
        deepLink: projectDeepLink(saved.id),
        projectId: saved.id,
        contactCreated: ensured?.created,
      };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Could not create project." };
    }
  }

  const proj = buildMockProject(
    name,
    client,
    String(payload.notes ?? ""),
    clientPoNumber,
    leadVendor,
    leadTeamMember,
  );
  const overlay: Partial<Project> = {};
  if (dueDate) overlay.due_date = dueDate;
  if (leadVendor) overlay.lead_vendor = leadVendor;
  if (leadTeamMember) overlay.lead_team_member = leadTeamMember;
  if (Object.keys(overlay).length > 0) {
    patchProjectOverlay(proj, overlay);
  }
  appendSessionProject(proj);
  upsertLiveProject(proj);
  return {
    ok: true,
    message: `Created project “${proj.name}” for ${client.name}.${contactNote}${poMismatchNote}`,
    deepLink: projectDeepLink(proj.id),
    projectId: proj.id,
    contactCreated: ensured?.created,
  };
}

function execCreateOrder(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) {
    return { ok: false, message: "Create or open a project first, then add an order." };
  }
  const opCode = resolveOperatorCompanyCode(null);
  let orders = loadProjectOrders(project.id);
  if (orders.length === 0) {
    const order = createFirstProjectOrder(project.id, project, orders, opCode);
    orders = [...orders, order];
  }

  const clientPo = String(suggestion.payload?.client_po_number ?? "").trim();
  if (clientPo) {
    const latest = orders[orders.length - 1]!;
    orders = orders.map((o) =>
      o.id === latest.id
        ? { ...o, client_po_number: clientPo, updated_at: new Date().toISOString() }
        : o,
    );
    saveProjectOrders(project.id, orders);
  }

  const order = orders[orders.length - 1]!;
  return {
    ok: true,
    message: `Shipment batch ${orderDisplayLabel(order, project, orders.length - 1)} on ${project.name}.`,
    deepLink: projectDeepLink(project.id),
    projectId: project.id,
  };
}

function execCreateJob(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) {
    return { ok: false, message: "Create or open a project first, then add jobs from Mailroom." };
  }

  const payload = suggestion.payload ?? {};
  const count = Math.min(12, Math.max(1, Number(payload.count) || 1));
  const baseName = sanitizeJobDisplayName(
    String(payload.name ?? payload.style_name ?? payload.job_name ?? "").trim(),
  );
  const vendor = String(payload.vendor ?? payload.supplier ?? ctx.threadRelated?.vendor ?? project.lead_vendor ?? "").trim();

  let jobs = loadProjectJobs(project.id, project);
  let orders = loadProjectOrders(project.id);
  const orderBundle = getOrCreateOrderForJob(
    project.id,
    project,
    orders,
    resolveOperatorCompanyCode(null),
  );
  orders = orderBundle.orders;
  const orderId =
    String(payload.order_id ?? "").trim() || orderBundle.orderId;
  const created: ProjectJob[] = [];

  for (let i = 0; i < count; i++) {
    const seed = createNewJobSeed(project, jobs, undefined, orderId);
    const name =
      count > 1
        ? baseName
          ? `${baseName} ${i + 1}`
          : `Job ${jobs.length + i + 1}`
        : baseName ||
          sanitizeJobDisplayName(suggestion.title.replace(/^Add .* job/i, "").trim()) ||
          "New job";
    const job = applyMailroomJobPayloadExtras(
      normalizeJob(
        {
          ...seed,
          name,
          lead_vendor: vendor || seed.lead_vendor,
          style_number: String(payload.style_number ?? "").trim() || seed.style_number,
          subtitle:
            String(payload.subtitle ?? payload.print_notes ?? "").trim() ||
            seed.subtitle,
          updated_at: nowIso(),
        },
        project,
      ),
      payload,
    );
    jobs = [...jobs, job];
    created.push(job);
  }

  saveProjectJobs(project.id, jobs);
  void reassignMailroomDocumentJobs({ projectId: project.id, jobs });
  const first = created[0]!;
  return {
    ok: true,
    message:
      created.length === 1
        ? `Added job “${first.name}” (${first.job_number}) to ${project.name}.`
        : `Added ${created.length} jobs to ${project.name}.`,
    deepLink: projectDeepLink(project.id, first.id),
    projectId: project.id,
    jobId: first.id,
    jobIds: created.map((j) => j.id),
  };
}

function execAddVendorQuote(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) return { ok: false, message: "Open a project with jobs before adding vendor quotes." };

  const job = resolveJobForSuggestion(suggestion, ctx, project);
  if (!job) return { ok: false, message: `Add a job to ${project.name} first, then capture the vendor quote.` };

  const p = suggestion.payload ?? {};
  const quote = newVendorQuote({
    vendor: String(p.vendor ?? ctx.threadRelated?.vendor ?? "Vendor"),
    item_description: String(p.item_description ?? p.description ?? "Quoted item"),
    unit_cost: Number(p.unit_cost ?? 0),
    qty: Number(p.qty ?? 1),
    notes: p.notes ? String(p.notes) : undefined,
    source: { kind: "email", email_id: suggestion.thread_id },
  });

  saveJob(project, { ...job, vendor_quotes: [...(job.vendor_quotes ?? []), quote], updated_at: nowIso() });

  return {
    ok: true,
    message: `Added ${quote.vendor} quote to job ${job.job_number ?? job.name} on ${project.name}.`,
    deepLink: projectDeepLink(project.id, job.id),
  };
}

function execAddCostingLine(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) return { ok: false, message: "No project found for this costing line." };
  const job = resolveJobForSuggestion(suggestion, ctx, project);
  if (!job) return { ok: false, message: "Add a job before adding costing lines." };

  const p = suggestion.payload ?? {};
  const sheet = job.costing_sheet ?? emptyCostingSheet();
  const line = newCostingLine({
    description: String(p.description ?? p.item_description ?? "Cost line"),
    vendor: p.vendor ? String(p.vendor) : null,
    cost: Number(p.unit_cost ?? p.cost ?? 0),
    qty: Number(p.qty ?? 1),
  });
  saveJob(project, {
    ...job,
    costing_sheet: { ...sheet, lines: [...sheet.lines, line] },
    updated_at: nowIso(),
  });

  return {
    ok: true,
    message: `Added costing line on ${job.job_number ?? job.name}.`,
    deepLink: projectDeepLink(project.id, job.id),
  };
}

function execGenerateEstimate(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) return { ok: false, message: "No project found for estimate." };

  const allJobs = loadProjectJobs(project.id, project);
  if (projectHasClientEstimate(allJobs)) {
    const existing = allJobs
      .flatMap((job) => job.estimates ?? [])
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
    const host =
      allJobs.find((job) => job.estimates?.some((est) => est.id === existing?.id)) ??
      sortJobsForEstimate(allJobs)[0];
    return {
      ok: true,
      message: `Estimate ${existing?.document_number ?? ""} already covers ${project.name}.`,
      deepLink: host ? projectDeepLink(project.id, host.id) : projectDeepLink(project.id),
      projectId: project.id,
    };
  }

  const resolved = resolveJobForSuggestion(suggestion, ctx, project);
  const targetJobs =
    allJobs.length > 1 ? sortJobsForEstimate(allJobs) : resolved ? [resolved] : allJobs.slice(0, 1);
  if (targetJobs.length === 0) {
    return { ok: false, message: "Add a job with costing before generating an estimate." };
  }

  const mergedSheet = mergeProjectJobCostingSheets(targetJobs);
  if (!mergedSheet || mergedSheet.lines.length === 0) {
    return {
      ok: false,
      message: "Add vendor quotes or costing lines on at least one job before generating an estimate.",
    };
  }

  const docBase =
    projectPoNumber(project)?.trim() ||
    targetJobs[0]!.job_number?.trim()?.replace(/-\d{2}$/, "") ||
    String(project.id);

  const { jobs: nextJobs, estimate, created } = applyMergedProjectEstimate(
    allJobs,
    targetJobs,
    docBase,
  );
  if (!created || !estimate) {
    return { ok: false, message: "Could not generate estimate." };
  }

  saveProjectJobs(project.id, nextJobs);
  const primary = targetJobs[0]!;
  const labels = targetJobs
    .map((job) => job.job_number ?? job.style_number ?? job.name)
    .filter(Boolean)
    .join(", ");

  return {
    ok: true,
    message: `Generated estimate ${estimate.document_number} covering ${labels || project.name}.`,
    deepLink: projectDeepLink(project.id, primary.id),
    projectId: project.id,
  };
}

function appendExtraDocument(row: DocumentRow): void {
  const prev = readMockLs<DocumentRow[]>(MOCK_LS.documents) ?? [];
  void import("@/lib/documents/document-storage").then(({ persistExtraDocuments }) =>
    persistExtraDocuments([...prev, row]),
  );
}

function execCreateInvoice(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  const p = suggestion.payload ?? {};
  const extras = readMockLs<DocumentRow[]>(MOCK_LS.documents) ?? [];
  const nextId = Math.max(0, ...extras.map((d) => d.id)) + 100;
  const title = suggestion.title.replace(/^Draft invoice\s*[-—]?\s*/i, "").trim() || "Invoice draft";

  appendExtraDocument({
    id: nextId,
    name: title,
    project_id: project?.id ?? null,
    project_name: project?.name ?? String(p.client ?? null),
    kind: "invoice",
    size_bytes: 0,
    uploaded_by: "Mailroom agent",
    updated_at: nowIso(),
  });

  return {
    ok: true,
    message: project
      ? `Invoice draft saved for ${project.name} — open Documents to review.`
      : "Invoice draft saved — open Documents to review.",
    deepLink: project ? projectDeepLink(project.id) : "/documents",
  };
}

function execUpdateClientPo(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) return { ok: false, message: "No project found for client PO update." };
  const job = resolveJobForSuggestion(suggestion, ctx, project);
  if (!job) return { ok: false, message: "Add a job to set the client PO." };

  const po = String(suggestion.payload?.client_po_number ?? "").trim();
  if (!po) return { ok: false, message: "No client PO number in this suggestion." };

  saveJob(project, { ...job, client_po_number: po, updated_at: nowIso() });
  return {
    ok: true,
    message: `Set client PO ${po} on ${job.job_number ?? job.name}.`,
    deepLink: projectDeepLink(project.id, job.id),
  };
}

function execUpdateSampleMilestone(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) return { ok: false, message: "No project found for milestone update." };
  const job = resolveJobForSuggestion(suggestion, ctx, project);
  if (!job) return { ok: false, message: "Add a job to update sample milestones." };

  const milestone = String(suggestion.payload?.milestone ?? "").toLowerCase();
  const now = nowIso();
  let patch: Partial<ProjectJob> = { updated_at: now };

  if (milestone.includes("strike") && milestone.includes("approv")) {
    patch = {
      ...patch,
      approvals: {
        ...defaultJobApprovals(project),
        ...(job.approvals ?? {}),
        strike_off_approval_status: "APPROVED",
        strike_off_received_date: now,
      },
    };
  } else if (milestone.includes("1st") || milestone.includes("shipped")) {
    patch = {
      ...patch,
      fulfillment: {
        ...defaultJobFulfillment(project),
        ...(job.fulfillment ?? {}),
        packing_list_sent_to_client_date: now,
      },
    };
  } else {
    patch = {
      ...patch,
      timeline: job.timeline.map((s) =>
        /sample|strike|ship/i.test(s.label) ? { ...s, state: "completed", date: todayYmd() } : s,
      ),
    };
  }

  saveJob(project, { ...job, ...patch });
  return {
    ok: true,
    message: `Updated sample milestone on ${job.job_number ?? job.name}.`,
    deepLink: projectDeepLink(project.id, job.id),
  };
}

function packingVariant(raw: unknown): PackingSlipVariant {
  const v = String(raw ?? "products_go").toLowerCase();
  if (v === "shipper") return "shipper";
  if (v === "basic") return "basic";
  return "products_go";
}

function execUpdateProject(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) {
    return {
      ok: false,
      message: "No project linked to this thread yet — create or link a project first.",
    };
  }

  const p = suggestion.payload ?? {};
  const name = String(p.name ?? p.project_name ?? "").trim();
  const description = String(p.description ?? p.notes ?? "").trim();
  if (!name && !description) {
    return { ok: false, message: "No project fields to update in this suggestion." };
  }

  const patch: Partial<Project> = {};
  if (name) patch.name = name;
  if (description) patch.description = description;

  const merged = patchProjectOverlay(project, patch);
  if (isClientLiveBackend()) {
    void updateProjectInDb(merged.id, patch).catch((e) =>
      console.warn("[mailroom] update project in db failed", e),
    );
  }

  return {
    ok: true,
    message: name
      ? `Updated project name to “${name}”.`
      : `Updated project details on “${project.name}”.`,
    deepLink: projectDeepLink(merged.id),
    projectId: merged.id,
  };
}

function execLogPackingList(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  if (!project) {
    return {
      ok: false,
      message: "No project linked to this thread — create a project first, then update packing lists here.",
    };
  }

  const jobs = loadProjectJobs(project.id, project);
  const variant = packingVariant(suggestion.payload?.variant);
  const slips = [...(project.packaging_slips ?? [])];
  const p = suggestion.payload ?? {};
  const slipKey = String(p.slip_id ?? p.document_number ?? "").trim();
  const updateExisting = p.update_existing !== false;

  let slip: (typeof slips)[number];
  let action: "updated" | "added" = "added";

  if (slipKey) {
    const idx = slips.findIndex(
      (s) => s.id === slipKey || s.document_number.toLowerCase() === slipKey.toLowerCase(),
    );
    if (idx >= 0) {
      slip = { ...slips[idx]!, variant, updated_at: nowIso() };
      slips[idx] = slip;
      action = "updated";
    } else {
      slip = { ...createPackingSlipDraft(project, jobs, loadContacts()), variant };
      slips.push(slip);
    }
  } else if (updateExisting && slips.length > 0) {
    const idx = slips.length - 1;
    slip = { ...slips[idx]!, variant, updated_at: nowIso() };
    slips[idx] = slip;
    action = "updated";
  } else {
    slip = { ...createPackingSlipDraft(project, jobs, loadContacts()), variant };
    slips.push(slip);
  }

  patchProjectOverlay(project, { packaging_slips: slips });

  return {
    ok: true,
    message:
      action === "updated"
        ? `Updated packing list ${slip.document_number} (${variant}) on ${project.name}.`
        : `Added ${variant} packing list ${slip.document_number} to ${project.name}.`,
    deepLink: projectDeepLink(project.id),
    projectId: project.id,
  };
}

function execTeamNote(
  suggestion: AgentSuggestion,
  ctx: ExecuteAgentSuggestionOptions,
): AgentApplyResult {
  const project = resolveProjectForSuggestion(suggestion, ctx);
  const p = suggestion.payload ?? {};
  const body = String(p.body ?? suggestion.title).trim();
  const assignee = p.assignee ? String(p.assignee) : undefined;

  const extras = readExtraCalendarEvents();
  const nextId = Math.max(0, ...extras.map((e) => e.id)) + 5000;
  writeExtraCalendarEvents([
    ...extras,
    {
      id: nextId,
      name: body.slice(0, 80),
      description: assignee ? `Assignee: ${assignee}\n\n${body}` : body,
      date: todayYmd(),
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600_000).toISOString(),
      event_type: "deadline",
      delivery_by: null,
      shipped_from: null,
      shipped_to: null,
      type_of_product: null,
      link_to_client: project?.client.name ?? null,
      po: project?.po_number ?? null,
      invoice: null,
      received_by: null,
      department: "Team task",
      notes: "From Mailroom agent",
      receiving_options: null,
    } satisfies CalendarEvent,
  ]);

  return {
    ok: true,
    message: project
      ? `Team task added on Calendar for ${project.name}.`
      : "Team task added on Calendar.",
    deepLink: project ? projectDeepLink(project.id) : "/calendar",
  };
}

const EXECUTORS: Record<
  AgentSuggestionKind,
  (
    s: AgentSuggestion,
    ctx: ExecuteAgentSuggestionOptions,
  ) => AgentApplyResult | Promise<AgentApplyResult>
> = {
  create_project: execCreateProject,
  update_project: execUpdateProject,
  create_order: execCreateOrder,
  create_job: execCreateJob,
  add_vendor_quote: execAddVendorQuote,
  add_costing_line: execAddCostingLine,
  generate_estimate: execGenerateEstimate,
  create_invoice: execCreateInvoice,
  update_client_po: execUpdateClientPo,
  update_sample_milestone: execUpdateSampleMilestone,
  log_packing_list: execLogPackingList,
  team_note: execTeamNote,
};

/** Apply a Mailroom suggestion to real workspace data (mock LS + Live APIs). */
export async function executeAgentSuggestionClient(
  suggestion: AgentSuggestion,
  opts: ExecuteAgentSuggestionOptions = {},
): Promise<AgentApplyResult> {
  const ctx: ExecuteAgentSuggestionOptions = {
    ...opts,
    projects: opts.projects ?? listResolvableProjects(),
  };
  const run = EXECUTORS[suggestion.kind];
  if (!run) return { ok: false, message: "Unhandled suggestion kind." };
  return run(suggestion, ctx);
}

export function dispatchWorkspaceDataChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
  window.dispatchEvent(new CustomEvent("onpro-projects-changed"));
  window.dispatchEvent(new CustomEvent("onpro-jobs-changed"));
}
