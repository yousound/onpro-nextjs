import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { loadContacts, clientContacts } from "@/lib/contacts-store";
import { getLiveCachedProjects, upsertLiveProject } from "@/lib/data/live-cache";
import { persistProjectToDb } from "@/lib/data/persist-project";
import { resolveClientProjectList } from "@/lib/mock/project-session";
import { appendSessionProject, readSessionProjects } from "@/lib/mock/project-session";
import { loadProjectJobs, saveProjectJobs } from "@/lib/project-wip-edits";
import { collectAllAppPoNumbers } from "@/lib/po-context";
import { generatePoNumber } from "@/lib/po-number";
import { resolveClientCode } from "@/lib/reference/client-codes";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { ProjectJob } from "@/lib/types/wip";

export type SplitJobsPlan = {
  sourceProject: Project;
  targetProjectName: string;
  jobToken: string;
  jobsToMove: ProjectJob[];
};

export type SplitJobsProposal = {
  kind: "split_jobs";
  plan: SplitJobsPlan;
  status: "pending" | "applied" | "failed";
  error?: string;
};

export type CreateProjectPlan = {
  name: string;
  client: Project["client"];
  description?: string;
  /** Set when a project with this name already exists — confirm reuses it. */
  existingProject?: Project;
};

export type CreateProjectProposal = {
  kind: "create_project";
  plan: CreateProjectPlan;
  status: "pending" | "applied" | "failed";
  error?: string;
};

export type ProjectPickerEntry = {
  id: number;
  name: string;
  clientName: string;
  status: Project["status"];
  jobCount: number;
  /** Jobs on this project matching the move token (e.g. BAU). */
  matchingJobCount: number;
  /** AI-ranked match for the user's source hint. */
  suggested: boolean;
};

export type PickSourceProjectPlan = {
  targetProjectName: string;
  jobToken: string;
  sourceProjectHint: string;
  projects: ProjectPickerEntry[];
  selectedProjectId?: number;
  /** True when a project with this name already exists — confirm will reuse it, not create a duplicate. */
  targetProjectExists?: boolean;
};

export type PickSourceProjectProposal = {
  kind: "pick_source_project";
  plan: PickSourceProjectPlan;
  status: "pending" | "applied" | "failed";
  error?: string;
};

export type WorkspaceProposal =
  | SplitJobsProposal
  | CreateProjectProposal
  | PickSourceProjectProposal;

function normalizeProjectHint(hint: string): string {
  return hint
    .replace(/\b(current|this|the|existing|active)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSourceProjectHint(text: string): string {
  const patterns = [
    /\bfrom\s+(?:the\s+)?(?:current\s+)?(.+?)\s+project\b/i,
    /\bon\s+(?:the\s+)?(?:current\s+)?(.+?)\s+project\b/i,
    /\b(?:remove|move|take\s+out|transfer|split)\b[\s\S]*?\bfrom\s+(?:the\s+)?(?:current\s+)?(.+?)\s+project\b/i,
    /\b(?:on|from|under|in)\s+(?:the\s+)?(?:current\s+)?["']?([^"'.]+?)["']?\s+project\b/i,
    /\bproject\s+["']?([^"'.]+?)["']?\s*,/i,
  ];
  for (const pattern of patterns) {
    const hit = text.match(pattern)?.[1]?.trim();
    if (hit) return normalizeProjectHint(hit);
  }
  return "";
}

function extractTargetProjectName(text: string): string {
  const patterns = [
    /\bcreate\s+(?:a\s+)?(?:new\s+)?(.+?)\s+project\b/i,
    /\b(?:into|to)\s+(?:a\s+)?(?:new\s+)?project\s+(?:called\s+)?["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i,
    /\bproject\s+(?:called|named)\s+["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i,
    /\bnew\s+project\s+["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i,
  ];
  for (const pattern of patterns) {
    const hit = text.match(pattern)?.[1]?.trim();
    if (hit) return hit.replace(/\s+project$/i, "").trim();
  }
  return "";
}

function extractJobToken(text: string): string {
  if (/\bbau\b/i.test(text) || /\bbau\d+/i.test(text)) return "BAU";
  const styleRef = text.match(/\b([A-Z]{2,}\d{2,})\b/)?.[1]?.trim();
  if (styleRef) return styleRef;
  const loose = text.match(/\b([A-Z]{2,})\s+items?\b/i)?.[1]?.trim();
  if (loose) return loose;
  const itemsMatch = text.match(/\b(?:all\s+)?(?:the\s+)?(.+?)\s+items?\b/i)?.[1]?.trim();
  if (itemsMatch && !/bau|zoe|project/i.test(itemsMatch)) return itemsMatch;
  return "";
}

export function parseSplitJobsRequest(message: string): {
  sourceProjectHint: string;
  targetProjectName: string;
  jobToken: string;
} | null {
  const text = message.trim();
  if (!text) return null;

  const wantsSplit =
    /\b(?:move|put|transfer|split|reassign|remove|take\s+out|delete)\b/i.test(text) ||
    (/\b(?:create|new)\b/i.test(text) && /\bproject\b/i.test(text));
  if (!wantsSplit) return null;

  const sourceProjectHint = extractSourceProjectHint(text);
  const targetProjectName = extractTargetProjectName(text);
  const jobToken = extractJobToken(text);

  if (!targetProjectName || !jobToken) return null;
  return { sourceProjectHint, targetProjectName, jobToken };
}

function parseCreateProjectOnly(message: string): { name: string; clientHint?: string } | null {
  const text = message.trim();
  if (!text) return null;
  if (!/\b(create|new|start|add)\b/i.test(text) || !/\bproject\b/i.test(text)) return null;
  if (/\b(move|split|transfer|reassign|put)\b/i.test(text)) return null;

  const name =
    text.match(/\bproject\s+(?:called\s+|named\s+)?["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i)?.[1]?.trim() ??
    text.match(/\bcreate\s+(?:a\s+)?(?:new\s+)?project\s+(?:called\s+)?["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i)?.[1]
      ?.trim() ??
    text.match(/\bnew\s+project\s+["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i)?.[1]?.trim() ??
    text.match(/\bstart\s+(?:a\s+)?project\s+["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i)?.[1]?.trim() ??
    "";
  if (!name) return null;

  const clientHint =
    text.match(/\bfor\s+(?:client\s+)?["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i)?.[1]?.trim() ??
    text.match(/\bclient\s+["']?([^"'.]+?)["']?(?:\s*[,.\s]|$)/i)?.[1]?.trim();

  return { name, clientHint };
}

function clientFromContact(contact: Contact): Project["client"] | null {
  const id = Number(contact.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return { id, name: contact.name, avatar_url: contact.avatar_url ?? null };
}

function resolveClientForPlan(hint?: string, fallback?: Project["client"]): Project["client"] | null {
  if (hint?.trim()) {
    const h = hint.trim().toLowerCase();
    const fromContacts = clientContacts(loadContacts()).find(
      (c) => c.name.toLowerCase() === h || c.name.toLowerCase().includes(h) || h.includes(c.name.toLowerCase()),
    );
    if (fromContacts) {
      return clientFromContact(fromContacts);
    }
    const fromProject = listWorkspaceProjects().find(
      (p) =>
        p.client.name.toLowerCase() === h ||
        p.client.name.toLowerCase().includes(h) ||
        h.includes(p.client.name.toLowerCase()),
    );
    if (fromProject) return fromProject.client;
  }
  if (fallback) return fallback;
  const clients = clientContacts(loadContacts());
  if (clients[0]) {
    return clientFromContact(clients[0]);
  }
  const projects = listWorkspaceProjects();
  return projects[0]?.client ?? null;
}

function listWorkspaceProjects(): Project[] {
  return isClientLiveBackend()
    ? resolveClientProjectList(getLiveCachedProjects())
    : readSessionProjects();
}

export function findProjectByExactName(projects: Project[], name: string): Project | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return projects.find((p) => p.name.trim().toLowerCase() === n);
}

export function findProjectByHint(projects: Project[], hint: string): Project | undefined {
  const h = normalizeProjectHint(hint).toLowerCase();
  if (!h) return undefined;

  const exact =
    projects.find((p) => p.name.toLowerCase() === h) ??
    projects.find((p) => p.client.name.toLowerCase() === h);
  if (exact) return exact;

  const contains =
    projects.find((p) => p.name.toLowerCase().includes(h)) ??
    projects.find((p) => h.includes(p.name.toLowerCase())) ??
    projects.find((p) => p.client.name.toLowerCase().includes(h)) ??
    projects.find((p) => h.includes(p.client.name.toLowerCase()));
  if (contains) return contains;

  const tokens = h.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return undefined;

  const ranked = projects
    .map((p) => {
      const hay = `${p.name} ${p.client.name}`.toLowerCase();
      const score = tokens.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
      return { p, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.p;
}

export function jobsMatchingToken(jobs: ProjectJob[], token: string): ProjectJob[] {
  const t = token.trim().toLowerCase();
  if (!t) return [];
  return jobs.filter(
    (j) =>
      j.name.toLowerCase().includes(t) ||
      j.style_number?.toLowerCase().includes(t) ||
      j.job_number?.toLowerCase().includes(t) ||
      j.subtitle?.toLowerCase().includes(t),
  );
}

/** Rank project ids by how well they match a source hint (exported for tests). */
export function rankProjectIdsByHint(projects: Project[], hint: string): number[] {
  const h = normalizeProjectHint(hint).toLowerCase();
  if (!h) return [];

  const tokens = h.split(/\s+/).filter((t) => t.length >= 2);
  const scored = projects.map((p) => {
    const name = p.name.toLowerCase();
    const client = p.client.name.toLowerCase();
    let score = 0;
    if (name === h || client === h) score += 100;
    if (name.includes(h) || h.includes(name)) score += 60;
    if (client.includes(h) || h.includes(client)) score += 40;
    for (const t of tokens) {
      if (name.includes(t)) score += 12;
      if (client.includes(t)) score += 8;
    }
    return { id: p.id, score };
  });

  return scored
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.id);
}

export function buildProjectPickerPlanFromProjects(
  projects: Project[],
  jobsForProject: (project: Project) => ProjectJob[],
  parsed: {
    sourceProjectHint: string;
    targetProjectName: string;
    jobToken: string;
  },
): PickSourceProjectPlan {
  const suggestedIds = new Set(rankProjectIdsByHint(projects, parsed.sourceProjectHint).slice(0, 3));

  const entries: ProjectPickerEntry[] = projects.map((p) => {
    const jobs = jobsForProject(p);
    const matchingJobCount = jobsMatchingToken(jobs, parsed.jobToken).length;
    return {
      id: p.id,
      name: p.name,
      clientName: p.client.name,
      status: p.status,
      jobCount: jobs.length,
      matchingJobCount,
      suggested: suggestedIds.has(p.id),
    };
  });

  entries.sort((a, b) => {
    if (a.suggested !== b.suggested) return a.suggested ? -1 : 1;
    if (a.matchingJobCount !== b.matchingJobCount) return b.matchingJobCount - a.matchingJobCount;
    return a.name.localeCompare(b.name);
  });

  const preselect =
    entries.find((e) => e.suggested && e.matchingJobCount > 0) ??
    entries.find((e) => e.matchingJobCount > 0) ??
    entries.find((e) => e.suggested);

  return {
    targetProjectName: parsed.targetProjectName,
    jobToken: parsed.jobToken,
    sourceProjectHint: parsed.sourceProjectHint,
    projects: entries,
    selectedProjectId: preselect?.id,
    targetProjectExists: Boolean(findProjectByExactName(projects, parsed.targetProjectName)),
  };
}

export function buildProjectPickerPlan(parsed: {
  sourceProjectHint: string;
  targetProjectName: string;
  jobToken: string;
}): PickSourceProjectPlan {
  const projects = listWorkspaceProjects();
  return buildProjectPickerPlanFromProjects(projects, (p) => loadProjectJobs(p.id, p), parsed);
}

export function buildSplitPlanFromPickerWithProjects(
  plan: PickSourceProjectPlan,
  projectId: number,
  projects: Project[],
  jobsForProject: (project: Project) => ProjectJob[],
): { ok: true; plan: SplitJobsPlan } | { ok: false; error: string } {
  const sourceProject = projects.find((p) => p.id === projectId);
  if (!sourceProject) {
    return { ok: false, error: "That project is no longer in your workspace." };
  }

  const jobsToMove = jobsMatchingToken(jobsForProject(sourceProject), plan.jobToken);
  if (jobsToMove.length === 0) {
    return {
      ok: false,
      error: `No jobs matching “${plan.jobToken}” on ${sourceProject.name}.`,
    };
  }

  return {
    ok: true,
    plan: {
      sourceProject,
      targetProjectName: plan.targetProjectName,
      jobToken: plan.jobToken,
      jobsToMove,
    },
  };
}

export function buildSplitPlanFromPicker(
  plan: PickSourceProjectPlan,
  projectId: number,
): { ok: true; plan: SplitJobsPlan } | { ok: false; error: string } {
  const projects = listWorkspaceProjects();
  return buildSplitPlanFromPickerWithProjects(plan, projectId, projects, (p) =>
    loadProjectJobs(p.id, p),
  );
}

export function pickerJobsPreview(
  plan: PickSourceProjectPlan,
  projectId: number,
): ProjectJob[] {
  const projects = listWorkspaceProjects();
  const sourceProject = projects.find((p) => p.id === projectId);
  if (!sourceProject) return [];
  return jobsMatchingToken(loadProjectJobs(sourceProject.id, sourceProject), plan.jobToken);
}

export function planSplitJobsFromMessage(
  message: string,
): { ok: true; plan: SplitJobsPlan } | { ok: false; error: string } {
  const parsed = parseSplitJobsRequest(message);
  if (!parsed) {
    return { ok: false, error: "Could not parse a split-project request." };
  }

  const projects = listWorkspaceProjects();
  const sourceProject = findProjectByHint(projects, parsed.sourceProjectHint);
  if (!sourceProject) {
    return {
      ok: false,
      error: `No project matching “${parsed.sourceProjectHint}” in your workspace.`,
    };
  }

  const sourceJobs = loadProjectJobs(sourceProject.id, sourceProject);
  const jobsToMove = jobsMatchingToken(sourceJobs, parsed.jobToken);
  if (jobsToMove.length === 0) {
    return {
      ok: false,
      error: `No jobs matching “${parsed.jobToken}” on ${sourceProject.name} (checked ${sourceJobs.length} job(s) in this browser).`,
    };
  }

  return {
    ok: true,
    plan: {
      sourceProject,
      targetProjectName: parsed.targetProjectName,
      jobToken: parsed.jobToken,
      jobsToMove,
    },
  };
}

export function planCreateProjectFromMessage(
  message: string,
): { ok: true; plan: CreateProjectPlan } | { ok: false; error: string } {
  const parsed = parseCreateProjectOnly(message);
  if (!parsed) {
    return { ok: false, error: "Could not parse a create-project request." };
  }

  const client = resolveClientForPlan(parsed.clientHint);
  if (!client) {
    return {
      ok: false,
      error: "Add a client in Contacts first, or say which client this project is for.",
    };
  }

  return {
    ok: true,
    plan: {
      name: parsed.name,
      client,
      description: undefined,
      existingProject: findProjectByExactName(listWorkspaceProjects(), parsed.name),
    },
  };
}

function combinedUserText(
  message: string,
  history?: Array<{ role: string; text: string }>,
): string {
  const prior = (history ?? [])
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.text.trim())
    .filter(Boolean);
  if (prior.length === 0) return message.trim();
  return [...prior, message.trim()].join(" ");
}

/** Detect create-project or split-jobs actions from a user message. */
export function planWorkspaceActionFromMessage(
  message: string,
  opts?: { history?: Array<{ role: string; text: string }> },
): { ok: true; proposal: WorkspaceProposal } | { ok: false; error: string } {
  const combined = combinedUserText(message, opts?.history);
  const split = planSplitJobsFromMessage(combined);
  if (split.ok) {
    return {
      ok: true,
      proposal: { kind: "split_jobs", plan: split.plan, status: "pending" },
    };
  }

  const create = planCreateProjectFromMessage(combined);
  if (create.ok) {
    return {
      ok: true,
      proposal: { kind: "create_project", plan: create.plan, status: "pending" },
    };
  }

  return { ok: false, error: split.error };
}

export const ASSISTANT_CONFIRM_PHRASE =
  /^(yes|yeah|yep|confirm|do it|go ahead|please do|sounds good|ok|okay|sure|apply)\b/i;

export function findPendingWorkspaceProposal(
  messages: Array<{ role: string; workspaceProposal?: WorkspaceProposal }>,
): { index: number; proposal: WorkspaceProposal } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "assistant" && m.workspaceProposal?.status === "pending") {
      return { index: i, proposal: m.workspaceProposal };
    }
  }
  return null;
}

function buildMockProject(name: string, client: Project["client"]): Project {
  const projects = listWorkspaceProjects();
  const nextId = Math.max(0, ...projects.map((p) => p.id)) + 1;
  const clientCode = resolveClientCode(client.name);
  const po = generatePoNumber(clientCode, collectAllAppPoNumbers(projects));
  return {
    id: nextId,
    name,
    description: `Split from ${name}`,
    project_number: po,
    po_number: po,
    project_hand_off_date: null,
    due_date: null,
    client,
    status: "Development",
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
    tracking_bol_number: null,
    packing_list_received_date: null,
    packing_list_sent_to_client_date: null,
    client_received_date: null,
    packaging_slips: [],
  };
}

async function resolveTargetProject(
  name: string,
  client: Project["client"],
  description: string,
  sourceProjectId?: number,
): Promise<{ project: Project; created: boolean }> {
  const projects = listWorkspaceProjects();
  const existing = findProjectByExactName(projects, name);
  if (existing && existing.id !== sourceProjectId) {
    return { project: existing, created: false };
  }

  const project = await persistNewProject(name, client, description);
  upsertLiveProject(project);
  return { project, created: true };
}

async function persistNewProject(
  name: string,
  client: Project["client"],
  description: string,
): Promise<Project> {
  if (isClientLiveBackend()) {
    return persistProjectToDb({
      name,
      description,
      clientId: client.id,
      status: "Development",
      projectNumber: null,
      dueDate: null,
      leadTeamMember: null,
      leadVendor: null,
    });
  }
  const project = buildMockProject(name, client);
  project.description = description;
  appendSessionProject(project);
  return project;
}

export async function applyCreateProjectPlan(
  plan: CreateProjectPlan,
): Promise<{ ok: true; message: string; targetProject: Project } | { ok: false; message: string }> {
  try {
    const { project: targetProject, created } = await resolveTargetProject(
      plan.name,
      plan.client,
      plan.description ?? `Created from OnPro AI`,
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("onpro-projects-changed"));
      window.dispatchEvent(new CustomEvent("onpro-workspace-data-changed"));
    }
    return {
      ok: true,
      targetProject,
      message: created
        ? `Created project “${targetProject.name}” for ${plan.client.name}.`
        : `Project “${targetProject.name}” already exists — opened that project (no duplicate created).`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not create the project.",
    };
  }
}

export async function applyWorkspaceProposal(
  proposal: WorkspaceProposal,
): Promise<{ ok: true; message: string; targetProject?: Project } | { ok: false; message: string }> {
  if (proposal.kind === "pick_source_project") {
    const projectId = proposal.plan.selectedProjectId;
    if (!projectId) {
      return { ok: false, message: "Pick which project to move jobs from first." };
    }
    const built = buildSplitPlanFromPicker(proposal.plan, projectId);
    if (!built.ok) return { ok: false, message: built.error };
    return applySplitJobsPlan(built.plan);
  }
  if (proposal.kind === "split_jobs") return applySplitJobsPlan(proposal.plan);
  return applyCreateProjectPlan(proposal.plan);
}

export async function applySplitJobsPlan(
  plan: SplitJobsPlan,
): Promise<{ ok: true; message: string; targetProject: Project } | { ok: false; message: string }> {
  const { sourceProject, targetProjectName, jobsToMove } = plan;
  const moveIds = new Set(jobsToMove.map((j) => j.id));

  let targetProject: Project;
  let targetCreated = false;
  try {
    const resolved = await resolveTargetProject(
      targetProjectName,
      sourceProject.client,
      `Split from ${sourceProject.name}`,
      sourceProject.id,
    );
    targetProject = resolved.project;
    targetCreated = resolved.created;
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not create the new project.",
    };
  }

  const now = new Date().toISOString();
  const targetExisting = loadProjectJobs(targetProject.id, targetProject);
  const alreadyOnTarget = new Set(targetExisting.map((j) => j.id));
  const moved = jobsToMove
    .filter((j) => !alreadyOnTarget.has(j.id))
    .map((j) => ({
      ...j,
      project_id: targetProject.id,
      updated_at: now,
    }));

  const sourceRemaining = loadProjectJobs(sourceProject.id, sourceProject).filter(
    (j) => !moveIds.has(j.id),
  );
  const targetJobs = [...loadProjectJobs(targetProject.id, targetProject), ...moved];

  saveProjectJobs(sourceProject.id, sourceRemaining);
  saveProjectJobs(targetProject.id, targetJobs);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("onpro-projects-changed"));
    window.dispatchEvent(new Event("onpro-jobs-changed"));
    window.dispatchEvent(new CustomEvent("onpro-workspace-data-changed"));
  }

  const names = moved.map((j) => j.name).join(", ");
  const createdLabel = targetCreated ? "Created" : "Used existing";
  const skipped = jobsToMove.length - moved.length;
  const skipNote =
    skipped > 0 ? ` (${skipped} already on “${targetProject.name}”.)` : "";
  return {
    ok: true,
    targetProject,
    message: `${createdLabel} “${targetProject.name}” and moved ${moved.length} job(s): ${names}. Removed them from “${sourceProject.name}”.${skipNote}`,
  };
}
