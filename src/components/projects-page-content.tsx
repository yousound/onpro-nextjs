"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { Client, Project, ProjectStatus } from "@/lib/types/project";
import { computeProjectKpis } from "@/lib/health";
import { dateInputToIso } from "@/lib/format";
import {
  NewProjectModal,
  type NewClientDraft,
  type SavedNewClient,
} from "@/components/new-project-modal";
import { useCurrentUser } from "@/components/profile-provider";
import { PageHeader } from "@/components/page-header";
import { ProjectsBrowser } from "@/components/projects-browser";
import { ProjectsConnectHero } from "@/components/projects-connect-hero";
import { sectionCoverHref, shouldShowSectionCover } from "@/lib/section-cover";
import { useStripSectionCoverWhenPopulated } from "@/lib/section-cover-hooks";
import { OPEN_NEW_PROJECT_EVENT, PROJECT_DELETED_EVENT } from "@/lib/onpro-events";
import { isClientLiveBackend, isClientMockBackend } from "@/lib/config/backend-mode";
import {
  appendSessionProject,
  mergeProjectLists,
  resolveClientProjectList,
} from "@/lib/mock/project-session";
import { commitSingleContact } from "@/lib/data/commit-contacts";
import { persistProjectToDb } from "@/lib/data/persist-project";
import {
  seedLiveProjects,
  upsertLiveContact,
  upsertLiveProject,
} from "@/lib/data/live-cache";
import {
  clientListContacts,
  clientPickerLabel,
  contactDisplayName,
  findContactByEmail,
  loadContacts,
  newContactId,
} from "@/lib/contacts-store";
import { validateClientContactFields } from "@/lib/contact-field-validation";
import {
  clientCodeFromContact,
  clientCodeMismatchMessage,
} from "@/lib/client-code-resolve";
import { resolveClientCode } from "@/lib/reference/client-codes";
import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import type { Contact } from "@/lib/types/contact";
import { generatePoNumber, shouldValidateProjectNumber } from "@/lib/po-number";
import { collectAllAppPoNumbers } from "@/lib/po-context";
import { validateProjectPoUnique } from "@/lib/po-duplicate";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-status";

function emptyProjectRecord(
  id: number,
  name: string,
  client: Client,
  status: ProjectStatus,
  projectNumber: string | null,
  dueDate: string | null,
  description: string | null,
): Project {
  return {
    id,
    name,
    description,
    project_number: projectNumber,
    po_number: null,
    project_hand_off_date: null,
    due_date: dueDate,
    client,
    status,
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
    packing_list_received_date: null,
    tracking_bol_number: null,
    packing_list_sent_to_client_date: null,
    client_received_date: null,
  };
}

export function ProjectsPageContent({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  /** Server list respects deleted-projects cookie; client merges session/live cache after mount. */
  const [projects, setProjects] = useState(() => resolveClientProjectList(initialProjects));
  const [cacheTick, setCacheTick] = useState(0);
  const [forceBoard, setForceBoard] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const syncProjectsFromSources = useCallback(
    (base: Project[] = initialProjects) => {
      const next = resolveClientProjectList(base);
      setProjects(next);
      if (isClientLiveBackend() && next.length > 0) seedLiveProjects(next);
      return next;
    },
    [initialProjects],
  );

  const mergedProjects = useMemo(() => {
    void cacheTick;
    return resolveClientProjectList(initialProjects);
  }, [initialProjects, cacheTick]);

  const projectCount = Math.max(mergedProjects.length, projects.length);

  useLayoutEffect(() => {
    syncProjectsFromSources();
  }, [syncProjectsFromSources]);

  useEffect(() => {
    const onProjectsUpdated = () => {
      syncProjectsFromSources();
      setCacheTick((t) => t + 1);
    };
    onProjectsUpdated();
    window.addEventListener("onpro-live-cache-seeded", onProjectsUpdated);
    window.addEventListener("onpro-projects-changed", onProjectsUpdated);
    return () => {
      window.removeEventListener("onpro-live-cache-seeded", onProjectsUpdated);
      window.removeEventListener("onpro-projects-changed", onProjectsUpdated);
    };
  }, [syncProjectsFromSources]);

  useEffect(() => {
    if (projectCount > 0 && projects.length === 0) {
      syncProjectsFromSources();
    }
  }, [projectCount, projects.length, syncProjectsFromSources]);

  useEffect(() => {
    if (!isClientLiveBackend() || projectCount > 0) return;
    let cancelled = false;
    void fetch("/api/projects", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { projects?: Project[] } | null) => {
        if (cancelled || !json?.projects?.length) return;
        syncProjectsFromSources(json.projects);
        setCacheTick((t) => t + 1);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectCount, syncProjectsFromSources]);

  useEffect(() => {
    function onDeleted(e: Event) {
      const id = (e as CustomEvent<{ projectId: number }>).detail?.projectId;
      if (id == null) return;
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
    window.addEventListener(PROJECT_DELETED_EVENT, onDeleted);
    return () => window.removeEventListener(PROJECT_DELETED_EVENT, onDeleted);
  }, []);

  const [contactsTick, setContactsTick] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [clientSelect, setClientSelect] = useState<string>(() => String(initialProjects[0]?.client.id ?? ""));
  const [status, setStatus] = useState<ProjectStatus>("Intake");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poTouched, setPoTouched] = useState(false);
  const [projectNumberMessage, setProjectNumberMessage] = useState<string | null>(null);

  const projectNumberConflict = Boolean(projectNumberMessage);

  const contactsDirectory = useMemo(() => loadContacts(), [contactsTick]);
  const directoryClients = useMemo(() => clientListContacts(contactsDirectory), [contactsDirectory]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const boardProjects = hydrated
    ? projects.length >= mergedProjects.length
      ? projects
      : mergedProjects.length > 0
        ? mergedProjects
        : projects
    : initialProjects;
  const k = useMemo(() => computeProjectKpis(boardProjects), [boardProjects]);

  const showCoverPage = searchParams.get("cover") === "1";
  const projectsHref = (cover: boolean) => sectionCoverHref("/projects", searchParams, cover);
  const openCoverPage = () => router.push(projectsHref(true));
  const openProjects = () => router.push(projectsHref(false));
  /** Cover only for an empty workspace; existing projects always open the board. */
  const showHero = !forceBoard && shouldShowSectionCover(showCoverPage, projectCount);
  useStripSectionCoverWhenPopulated("/projects", searchParams, projectCount);

  const openProjectBoard = useCallback(() => {
    setForceBoard(true);
    router.push(projectsHref(false));
  }, [router, searchParams]);

  const clientsSorted = useMemo(() => {
    const fromProjects = new Map<number, string>();
    for (const p of projects) fromProjects.set(p.client.id, p.client.name);
    if (directoryClients.length > 0) {
      return directoryClients.map(
        (c) => [c.id, clientPickerLabel(c), c.company_code] as const,
      );
    }
    return [...fromProjects.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => [String(id), name, ""] as const);
  }, [projects, directoryClients]);

  const selectedClient = useMemo(
    () => directoryClients.find((c) => String(c.id) === clientSelect),
    [directoryClients, clientSelect],
  );

  const projectPoPreview = useMemo(() => {
    if (!selectedClient) return "";
    const resolution = clientCodeFromContact(selectedClient);
    return generatePoNumber(resolution.effectiveCode, collectAllAppPoNumbers(projects));
  }, [selectedClient, projects]);

  const clientCodeNotice = useMemo(() => {
    if (!selectedClient) return null;
    const resolution = clientCodeFromContact(selectedClient);
    return clientCodeMismatchMessage(resolution, selectedClient.name);
  }, [selectedClient]);

  useEffect(() => {
    if (poTouched) return;
    setPoNumber(projectPoPreview);
  }, [projectPoPreview, poTouched]);

  useEffect(() => {
    setPoTouched(false);
    setProjectNumberMessage(null);
  }, [clientSelect]);

  useEffect(() => {
    if (!shouldValidateProjectNumber(poNumber)) {
      setProjectNumberMessage(null);
      return;
    }
    const handle = window.setTimeout(() => {
      const msg = validateProjectPoUnique(poNumber, projects);
      setProjectNumberMessage(msg);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [poNumber, projects]);

  useEffect(() => {
    if (!modalOpen || clientSelect.trim()) return;
    const firstId = clientsSorted[0]?.[0];
    if (firstId) setClientSelect(String(firstId));
  }, [modalOpen, clientSelect, clientsSorted]);

  const resetForm = useCallback(() => {
    const firstId = clientsSorted[0]?.[0];
    setName("");
    setClientSelect(firstId != null ? String(firstId) : "");
    setStatus("Intake");
    setDueDate("");
    setDescription("");
    setPoNumber("");
    setPoTouched(false);
    setProjectNumberMessage(null);
  }, [clientsSorted]);

  async function saveNewClient(draft: NewClientDraft): Promise<SavedNewClient | { error: string }> {
    const contacts = loadContacts();
    const email = draft.email.trim();
    const isCompany = draft.kind === "company";
    const label = draft.companyName.trim();
    const resolved = resolveClientCode(label);
    const code = draft.companyCode.trim().toUpperCase() || resolved;
    const codeConfirmed = code !== resolved;

    if (!label || !email) {
      return {
        error: isCompany ? "Company name and email are required." : "Name and email are required.",
      };
    }
    const fieldErrors = validateClientContactFields(contacts, {
      kind: draft.kind,
      name: label,
      email,
      companyCode: code,
    });
    if (fieldErrors.companyCode) return { error: fieldErrors.companyCode };
    if (fieldErrors.email?.includes("already used for")) {
      return { error: fieldErrors.email };
    }
    const existingEmail = findContactByEmail(contacts, email);

    const now = new Date().toISOString();
    const id = existingEmail?.id ?? newContactId();
    const contact: Contact = {
      id,
      segment: "client",
      kind: draft.kind,
      company_code: code,
      company_code_confirmed: codeConfirmed,
      name: label,
      contact_name: isCompany ? draft.contactName.trim() || undefined : undefined,
      email,
      phone: draft.phone.trim() || undefined,
      avatar_url: null,
      member_contact_ids: [],
      permissions: defaultPermissionsForSegment("client"),
      created_at: existingEmail?.created_at ?? now,
      updated_at: now,
    };

    try {
      const saved = await commitSingleContact(contact);
      if (isClientLiveBackend()) {
        upsertLiveContact(saved);
      }
      setContactsTick((t) => t + 1);
      if (!isClientMockBackend()) {
        router.refresh();
      }
      return {
        id: saved.id,
        name: contactDisplayName(saved),
        code: saved.company_code,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not save client" };
    }
  }

  const openModal = useCallback(() => {
    setCreateError(null);
    resetForm();
    setModalOpen(true);
  }, [resetForm]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
  }, []);

  useEffect(() => {
    function onOpenEvent() {
      openModal();
    }
    window.addEventListener(OPEN_NEW_PROJECT_EVENT, onOpenEvent);
    return () => window.removeEventListener(OPEN_NEW_PROJECT_EVENT, onOpenEvent);
  }, [openModal]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setCreateError("Enter a project name.");
      return;
    }

    const clientEntry = clientsSorted.find(([id]) => id === clientSelect);
    if (!clientEntry) {
      setCreateError("Select a client for this project.");
      return;
    }

    const clientId = Number(clientSelect);
    if (!Number.isFinite(clientId)) {
      setCreateError("Select a valid client for this project.");
      return;
    }

    const contact = directoryClients.find((c) => String(c.id) === clientSelect);
    const clientName = contact
      ? contactDisplayName(contact, contactsDirectory)
      : clientEntry[1];
    const client: Client = {
      id: clientId,
      name: clientName,
      avatar_url: null,
    };
    const clientCode = contact
      ? clientCodeFromContact(contact).effectiveCode
      : resolveClientCode(clientName);
    const po =
      poNumber.trim() ||
      generatePoNumber(clientCode, collectAllAppPoNumbers(projects));
    const poConflict = validateProjectPoUnique(po, projects);
    if (poConflict) {
      setCreateError(poConflict);
      setProjectNumberMessage(poConflict);
      return;
    }
    const dueIso = dueDate ? dateInputToIso(dueDate) : null;
    const creatorName = user?.fullName?.trim() || null;

    if (isClientLiveBackend()) {
      setCreating(true);
      setCreateError(null);
      try {
        const saved = await persistProjectToDb({
          name: trimmedName,
          description: description.trim() || null,
          clientId,
          status,
          projectNumber: po,
          dueDate: dueIso,
          leadTeamMember: creatorName,
          leadVendor: null,
        });
        upsertLiveProject(saved);
        setProjects((prev) => mergeProjectLists(prev, [saved]));
        setCacheTick((t) => t + 1);
        closeModal();
        if (showCoverPage) openProjects();
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "Could not create project");
      } finally {
        setCreating(false);
      }
      return;
    }

    const nextId = Math.max(0, ...projects.map((p) => p.id)) + 1;
    const proj = {
      ...emptyProjectRecord(nextId, trimmedName, client, status, po, dueIso, description.trim() || null),
      po_number: po,
      lead_team_member: creatorName,
    };

    appendSessionProject(proj);
    setProjects((prev) => [...prev, proj]);
    closeModal();
    if (showCoverPage) openProjects();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Projects"
          onInfoClick={projectCount === 0 ? openCoverPage : undefined}
          infoLabel={projectCount === 0 ? "About Projects" : undefined}
          action={
            <button
              type="button"
              onClick={openModal}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90"
            >
              + New project
            </button>
          }
          kpis={
            showHero
              ? undefined
              : [
                  { label: "Total projects", value: k.total, tone: "accent" },
                  { label: "On track", value: k.onTrack, tone: "ok" },
                  { label: "At risk", value: k.atRisk, tone: "warn" },
                  { label: "Delayed", value: k.delayed, tone: "bad" },
                ]
          }
        />
      </div>
      {showHero ? (
        <ProjectsConnectHero
          onCreateProject={openModal}
          onDismiss={projectCount > 0 ? openProjectBoard : undefined}
        />
      ) : (
        <ProjectsBrowser projects={boardProjects} />
      )}

      <NewProjectModal
        open={modalOpen}
        name={name}
        onNameChange={setName}
        clientSelect={clientSelect}
        onClientSelectChange={setClientSelect}
        clientsSorted={clientsSorted}
        poNumber={poNumber}
        onPoNumberChange={(v) => {
          setPoTouched(true);
          setPoNumber(v);
        }}
        clientCodeNotice={clientCodeNotice}
        onUseResolvedClientCode={
          selectedClient
            ? async () => {
                try {
                  const resolution = clientCodeFromContact(selectedClient);
                  const updated: Contact = {
                    ...selectedClient,
                    company_code: resolution.resolvedCode,
                    company_code_confirmed: false,
                    updated_at: new Date().toISOString(),
                  };
                  const saved = await commitSingleContact(updated);
                  if (isClientLiveBackend()) upsertLiveContact(saved);
                  setContactsTick((t) => t + 1);
                  setPoTouched(false);
                } catch (err) {
                  setCreateError(
                    err instanceof Error ? err.message : "Could not update client code",
                  );
                }
              }
            : undefined
        }
        onSaveNewClient={saveNewClient}
        status={status}
        onStatusChange={(v) => setStatus(v as ProjectStatus)}
        statusOptions={PROJECT_STATUS_OPTIONS}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        description={description}
        onDescriptionChange={setDescription}
        onClose={closeModal}
        onSubmit={submit}
        submitError={createError}
        submitting={creating}
        projectNumberMessage={projectNumberMessage}
        projectNumberConflict={projectNumberConflict}
      />
    </div>
  );
}
