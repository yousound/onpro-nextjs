"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  ApprovalStatus,
  BulkProductionTrack,
  Colorway,
  Project,
  Sample,
  SampleStatus,
  SampleType,
} from "@/lib/types/project";
import type { Contact } from "@/lib/types/contact";
import {
  JobDetailsFocus,
  JobDetailsSection,
  JobScopeKind,
  JobType,
  ProjectJob,
  ProjectOrder,
  wipStepToSection,
} from "@/lib/types/wip";
import { findDuplicateSku } from "@/lib/sku";
import { jobTimelineEditorLabel } from "@/lib/types/wip";
import { JobShareMenu } from "@/components/job-share-menu";
import { ModalSectionLayout, ModalSectionNavList } from "@/components/modal-section-layout";
import {
  CheckMini,
  ProjectModalAside,
  ProjectModalBadge,
  ProjectModalOverlay,
  ProjectModalPanelFooter,
  ProjectModalPanelHeader,
  projectModalFieldClass,
  projectModalLabelClass,
  projectModalTextareaClass,
} from "@/components/project-modal-ui";
import { VendorFieldSelect } from "@/components/vendor-select";
import { sanitizeJobDisplayName } from "@/lib/job-display-name";
import { normalizeJob } from "@/lib/job-defaults";
import {
  applyDevelopmentPatch,
  applyTechPackPatch,
  barcodesSentDate,
  developmentFromJob,
  patchBarcodesSentDate,
  techPackCompleteDate,
  techPackDueDate,
  updateSampleStage,
  updateTrimLineTrack,
  sampleApprovalFieldLabels,
} from "@/lib/job-development";
import { duplicateJobSeed } from "@/lib/project-job-create";
import { DuplicateJobDialog, type DuplicateJobFormValues } from "@/components/duplicate-job-dialog";
import {
  accordionSectionsFor,
  buildUpcomingJobTimelineForType,
} from "@/lib/job-timeline-templates";
import { dateInputToIso, isoToDateInput } from "@/lib/format";
import {
  ADDON_CATEGORY_OPTIONS,
  CATEGORY_CODES,
  JOB_TYPE_OPTIONS,
  PANT_SIZE_ALPHA,
  PANT_SIZE_NUMERIC,
  SHIRT_SIZE_OPTIONS,
  dropdownLabelForCategoryCode,
} from "@/lib/reference/category-codes";
import {
  defaultBulkProductionTrack,
  defaultDyeCostingTrack,
  defaultPrintEmbroideryTrack,
  defaultTrimLineTrack,
  updateBulkTrack,
  updateDyeTrack,
  updatePrintEmbTrack,
} from "@/lib/project-repeatable-tracks";
import { generatePoForJob } from "@/lib/po-context";
import { COMMON_COLORWAY_NAMES, resolveColorCode, styleColorCode } from "@/lib/style-number";
import { wipStepLabel } from "@/lib/wip-project-timeline";
import { JobTimelineStepsEditor } from "@/components/job-timeline-steps-editor";
import { WipTimeline } from "@/components/wip-timeline";
import { JobLabelsSection } from "@/components/job-labels-section";
import { TechPackArtworkSection } from "@/components/tech-pack-artwork-section";
import { CostingSheetEditor } from "@/components/costing-sheet-editor";
import { JobColorwayEditor } from "@/components/job-colorway-editor";
import { useCurrentUser } from "@/components/profile-provider";
import { normalizeColorwayRows, syncLegacyColorwayFields } from "@/lib/job-colorways";
import { effectiveJobPrice, priceFromCostingSheet } from "@/lib/job-price";
import { isApparelWorkspace } from "@/lib/workspace-industry";
import { VendorQuotesSection } from "@/components/vendor-quotes-section";
import { EstimatesList } from "@/components/estimates-list";
import {
  costingLineFromVendorQuote,
  emptyCostingSheet,
  generateEstimateFromSheet,
} from "@/lib/costing-sheet";
import type {
  CostingSheet,
  Estimate,
  VendorQuote,
} from "@/lib/types/wip";
import {
  isJobLate,
  JOB_STATUS_SELECT_OPTIONS,
  jobStatusDisplay,
} from "@/lib/job-status";
import { JobStatusBadge } from "@/components/job-status-badge";

const fieldClass = projectModalFieldClass;
const labelClass = projectModalLabelClass;
const textareaClass = projectModalTextareaClass;

const SAMPLE_STATUS_OPTIONS: SampleStatus[] = [
  "PENDING",
  "RECEIVED",
  "APPROVED",
  "REJECTED",
  "IN REVIEW",
];

const SAMPLE_TYPE_OPTIONS: SampleType[] = [
  "1ST SAMPLE",
  "2ND SAMPLE",
  "3RD SAMPLE",
  "PP SAMPLE",
  "2ND PP SAMPLE",
];

type JobModalSection = "overview" | "labels" | "timeline" | JobDetailsSection;

const SECTION_LABEL: Record<JobModalSection, string> = {
  overview: "Overview",
  labels: "Labels & barcodes",
  timeline: "Job timeline",
  estimate: "Estimate",
  development: "Development",
  costing: "Costing",
  approvals: "Approvals",
  bulk: "Bulk production",
};

function accordionSectionsForJob(jobType?: JobType): JobDetailsSection[] {
  return accordionSectionsFor(jobType) as JobDetailsSection[];
}

function visibleModalSections(jobType?: JobType): JobModalSection[] {
  return ["overview", "labels", "timeline", ...accordionSectionsForJob(jobType)];
}

function resolveCategoryDropdown(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) return CATEGORY_CODES[0]?.dropdownLabel ?? "Tee";
  const byLabel = CATEGORY_CODES.find(
    (c) => c.dropdownLabel.toLowerCase() === trimmed.toLowerCase(),
  );
  if (byLabel) return byLabel.dropdownLabel;
  const byCode = CATEGORY_CODES.find((c) => c.code.toLowerCase() === trimmed.toLowerCase());
  if (byCode) return byCode.dropdownLabel;
  const byFullLabel = CATEGORY_CODES.find((c) => c.label.toLowerCase() === trimmed.toLowerCase());
  if (byFullLabel) return byFullLabel.dropdownLabel;
  return dropdownLabelForCategoryCode(trimmed) !== "Custom" ? dropdownLabelForCategoryCode(trimmed) : trimmed;
}

function jobTypeLabel(jobType: JobType | undefined): string {
  const hit = JOB_TYPE_OPTIONS.find((o) => o.value === jobType);
  return hit?.label ?? "Print Production";
}

function cloneJob(job: ProjectJob): ProjectJob {
  return {
    ...job,
    timeline: job.timeline.map((s) => ({ ...s })),
    estimate: job.estimate ? { ...job.estimate } : undefined,
    costing: job.costing
      ? {
          ...job.costing,
          dye_costing_tracks: job.costing.dye_costing_tracks.map((t) => ({ ...t })),
          print_embroidery_costing_tracks: job.costing.print_embroidery_costing_tracks.map((t) => ({ ...t })),
          costing_extra_tracks: job.costing.costing_extra_tracks.map((t) => ({ ...t })),
          colorways: job.costing.colorways.map((cw) => ({
            ...cw,
            samples: cw.samples.map((s) => ({ ...s })),
          })),
        }
      : undefined,
    approvals: job.approvals ? { ...job.approvals } : undefined,
    tech_pack: job.tech_pack
      ? {
          ...job.tech_pack,
          artwork_files: job.tech_pack.artwork_files?.map((f) => ({ ...f })),
          dropbox_links: job.tech_pack.dropbox_links?.map((l) => ({ ...l })),
        }
      : undefined,
    fulfillment: job.fulfillment ? { ...job.fulfillment } : undefined,
    bulk_production_tracks: job.bulk_production_tracks?.map((t) => ({ ...t })),
    addon_shirt_sizes: job.addon_shirt_sizes ? [...job.addon_shirt_sizes] : undefined,
    addon_pant_sizes: job.addon_pant_sizes ? [...job.addon_pant_sizes] : undefined,
    label_files: job.label_files?.map((f) => ({ ...f })),
    label_lines: job.label_lines?.map((l) => ({ ...l })),
    vendor_quotes: job.vendor_quotes?.map((q) => ({ ...q })),
    costing_sheet: job.costing_sheet
      ? {
          ...job.costing_sheet,
          lines: job.costing_sheet.lines.map((l) => ({ ...l })),
        }
      : undefined,
    estimates: job.estimates?.map((e) => ({
      ...e,
      costing_sheet_snapshot: {
        ...e.costing_sheet_snapshot,
        lines: e.costing_sheet_snapshot.lines.map((l) => ({ ...l })),
      },
    })),
  };
}

function JobBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M10 2h4a2 2 0 0 1 2 2v2h4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6h4V4a2 2 0 0 1 2-2zm2 4V4h-4v2h4z" />
    </svg>
  );
}

function SectionCard({
  title,
  id,
  headerExtra,
  children,
  highlight,
}: {
  title: string;
  id?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      id={id}
      className={`rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-shadow ${
        highlight ? "ring-2 ring-[#7c3aed]/40 ring-offset-2" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function GrayRow({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} className="rounded-xl bg-slate-50 px-4 py-3">
      {children}
    </div>
  );
}

function SectionPanel({
  id,
  title,
  highlight,
  children,
}: {
  id: string;
  title: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-shadow ${
        highlight ? "ring-2 ring-[#7c3aed]/40 ring-offset-2" : ""
      }`}
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      </div>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </section>
  );
}

function SizeChipGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(size: string) {
    onChange(selected.includes(size) ? selected.filter((s) => s !== size) : [...selected, size]);
  }

  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                on
                  ? "bg-accent text-white shadow-sm"
                  : "bg-slate-100 text-text-secondary ring-1 ring-border-light hover:text-text-primary"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FocusHighlight({
  id,
  highlight,
  children,
}: {
  id?: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={`rounded-xl transition-shadow ${highlight ? "ring-2 ring-accent/70 ring-offset-2" : ""}`}
    >
      {children}
    </div>
  );
}

function WipStepFieldBlock({
  stepId,
  title,
  highlight,
  children,
}: {
  stepId: string;
  title?: string;
  highlight: boolean;
  children: ReactNode;
}) {
  return (
    <FocusHighlight id={`job-step-${stepId}`} highlight={highlight}>
      <div className="space-y-3 rounded-xl border border-violet-100/90 bg-surface-body/35 px-4 py-3">
        <p className="text-xs font-semibold leading-snug text-text-primary">{title ?? wipStepLabel(stepId)}</p>
        {children}
      </div>
    </FocusHighlight>
  );
}

export type JobDetailsModalProps = {
  project: Project;
  job: ProjectJob;
  allJobs: ProjectJob[];
  orders?: ProjectOrder[];
  clientCode: string;
  operatorCode?: string;
  vendors: Contact[];
  focus?: JobDetailsFocus;
  isNew?: boolean;
  /** When nested inside another modal (e.g. message attachment composer). */
  overlayClassName?: string;
  onClose: () => void;
  onSave: (job: ProjectJob) => void;
  onDelete?: () => void;
  deleting?: boolean;
};

export function JobDetailsModal({
  project,
  job,
  allJobs,
  orders = [],
  clientCode,
  operatorCode = "MAT",
  vendors,
  focus,
  isNew,
  overlayClassName = "z-[100]",
  onClose,
  onSave,
  onDelete,
  deleting = false,
}: JobDetailsModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(() => {
    const normalized = cloneJob(normalizeJob(job, isNew ? undefined : project));
    return { ...normalized, name: sanitizeJobDisplayName(normalized.name) };
  });
  const [categoryDropdown, setCategoryDropdown] = useState(() =>
    isNew ? "" : resolveCategoryDropdown(job.category),
  );
  const [activeSection, setActiveSection] = useState<JobModalSection>(
    () => (focus?.section ?? "overview") as JobModalSection,
  );
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user: currentUser } = useCurrentUser();
  const apparelWorkspace = isApparelWorkspace(currentUser?.businessType);
  const colorwayRows = useMemo(
    () => draft.colorway_rows ?? normalizeColorwayRows(draft),
    [draft.colorway_rows, draft.colorway, draft.color_code],
  );
  const costingPrice = useMemo(
    () => priceFromCostingSheet(draft.costing_sheet),
    [draft.costing_sheet],
  );
  const displayPrice = useMemo(() => effectiveJobPrice(draft), [draft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!focus) return;
    setActiveSection(focus.section as JobModalSection);
    const targetId = focus.focusStepId ? `job-step-${focus.focusStepId}` : `job-section-${focus.section}`;
    setHighlightId(targetId);
    const t = window.setTimeout(() => {
      const root = scrollRef.current;
      const el = root?.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => setHighlightId(null), 1800);
    }, 80);
    return () => window.clearTimeout(t);
  }, [focus]);

  const patch = useCallback((partial: Partial<ProjectJob>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchEstimate = useCallback((partial: Partial<NonNullable<ProjectJob["estimate"]>>) => {
    setDraft((prev) => ({
      ...prev,
      estimate: { ...prev.estimate!, ...partial },
    }));
  }, []);

  const patchCosting = useCallback((partial: Partial<NonNullable<ProjectJob["costing"]>>) => {
    setDraft((prev) => ({
      ...prev,
      costing: { ...prev.costing!, ...partial },
    }));
  }, []);

  const patchApprovals = useCallback((partial: Partial<NonNullable<ProjectJob["approvals"]>>) => {
    setDraft((prev) => ({
      ...prev,
      approvals: { ...prev.approvals!, ...partial },
    }));
  }, []);

  const patchTechPack = useCallback((partial: Partial<NonNullable<ProjectJob["tech_pack"]>>) => {
    setDraft((prev) => applyTechPackPatch(prev, partial));
  }, []);

  const patchDevelopment = useCallback(
    (partial: Partial<import("@/lib/types/wip").JobDevelopmentFields>) => {
      setDraft((prev) => applyDevelopmentPatch(prev, partial));
    },
    [],
  );

  const patchVendorQuotes = useCallback((next: VendorQuote[]) => {
    setDraft((prev) => ({ ...prev, vendor_quotes: next }));
  }, []);

  const patchCostingSheet = useCallback((next: CostingSheet) => {
    setDraft((prev) => {
      const priceFromSheet = priceFromCostingSheet(next);
      return {
        ...prev,
        costing_sheet: next,
        ...(prev.price_manual_override || !priceFromSheet
          ? {}
          : { price: priceFromSheet }),
      };
    });
  }, []);

  const patchEstimates = useCallback((next: Estimate[]) => {
    setDraft((prev) => ({ ...prev, estimates: next }));
  }, []);

  function pullVendorQuoteIntoSheet(quoteId: string) {
    const q = (draft.vendor_quotes ?? []).find((vq) => vq.id === quoteId);
    if (!q) return;
    const sheet = draft.costing_sheet ?? emptyCostingSheet();
    patchCostingSheet({ ...sheet, lines: [...sheet.lines, costingLineFromVendorQuote(q)] });
  }

  function handleGenerateEstimate() {
    const sheet = draft.costing_sheet;
    if (!sheet || sheet.lines.length === 0) return;
    const est = generateEstimateFromSheet(draft, sheet, draft.estimates ?? []);
    patchEstimates([...(draft.estimates ?? []), est]);
  }

  const patchFulfillment = useCallback((partial: Partial<NonNullable<ProjectJob["fulfillment"]>>) => {
    setDraft((prev) => ({
      ...prev,
      fulfillment: { ...prev.fulfillment!, ...partial },
    }));
  }, []);

  function handleCategoryChange(label: string) {
    setCategoryDropdown(label);
    patch({ category: label });
  }

  function handleJobTypeChange(jobType: JobType) {
    patch({
      job_type: jobType,
      type: jobTypeLabel(jobType).toUpperCase(),
    });
  }

  function applyTimelineTemplateForType() {
    const type = draft.job_type;
    if (!type) return;
    const template = buildUpcomingJobTimelineForType(type);
    setDraft((prev) => ({ ...prev, timeline: template }));
  }

  const siblingJobs = useMemo(
    () => allJobs.filter((j) => j.project_id === project.id && j.id !== draft.id),
    [allJobs, project.id, draft.id],
  );

  function handleGeneratePo() {
    patch({ po_number: generatePoForJob(project, draft) });
  }

  function handleLinkPo(fromJobId: string) {
    const source = allJobs.find((j) => j.id === fromJobId);
    if (source?.po_number) patch({ po_number: source.po_number });
  }

  function handleJumpToSection(section: JobModalSection) {
    setActiveSection(section);
    const id = `job-section-${section}`;
    setHighlightId(id);
    window.setTimeout(() => {
      const root = scrollRef.current;
      if (root) root.scrollTop = 0;
      window.setTimeout(() => setHighlightId(null), 1800);
    }, 80);
  }

  function handleTimelineStepClick(stepId: string) {
    const step = draft.timeline.find((s) => s.id === stepId);
    const section = wipStepToSection(stepId, step?.opensIn);
    setActiveSection(section as JobModalSection);
    const focusStepId = stepId.startsWith("sample_") ? "sample_approvals" : stepId;
    const targetId = `job-step-${focusStepId}`;
    setHighlightId(targetId);
    window.setTimeout(() => {
      const root = scrollRef.current;
      const el = root?.querySelector<HTMLElement>(`#${CSS.escape(targetId)}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => setHighlightId(null), 1800);
    }, 80);
  }

  function handleJobDurationChange(stepId: string, durationShort: string) {
    patch({
      timeline: draft.timeline.map((step) =>
        step.id === stepId ? { ...step, durationShort: durationShort || undefined } : step,
      ),
    });
  }

  const styleColorPreview = useMemo(
    () => styleColorCode(draft.style_number, draft.colorway ?? "", draft.color_code),
    [draft.style_number, draft.colorway, draft.color_code],
  );

  function handleGenerateBarcode() {
    patch({
      barcode: styleColorPreview,
      color_code: draft.color_code?.trim() || resolveColorCode(draft.colorway ?? ""),
    });
  }

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const sku = draft.sku?.trim() || null;
    if (sku) {
      const dup = findDuplicateSku(sku, allJobs, draft.id);
      if (dup) {
        window.alert(`SKU ${sku} is already used on “${dup.name || dup.style_number}”.`);
        return;
      }
    }
    const saved: ProjectJob = {
      ...draft,
      ...syncLegacyColorwayFields(draft),
      category: categoryDropdown,
      sku: sku || null,
      scope_note: draft.scope_note?.trim() || undefined,
      price: displayPrice || draft.price || null,
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    try {
      onSave(normalizeJob(saved, project));
    } catch (err) {
      console.error("Job save failed", err);
      window.alert("Could not save job. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDuplicate() {
    if (isNew) return;
    setDuplicateOpen(true);
  }

  function confirmDuplicate(values: DuplicateJobFormValues) {
    const color_code =
      values.color_code.trim() || resolveColorCode(values.colorway, draft.color_code) || "";
    const dup = duplicateJobSeed(draft, project, allJobs, {
      name: values.name,
      colorway: values.colorway,
      style_number: values.style_number,
      color_code,
    });
    setDuplicateOpen(false);
    onSave(normalizeJob(dup, project));
  }

  const estimate = draft.estimate!;
  const costing = draft.costing!;
  const approvals = draft.approvals!;
  const techPack = draft.tech_pack!;
  const fulfillment = draft.fulfillment!;
  const bulkTracks = draft.bulk_production_tracks ?? [];
  const primaryBulk = bulkTracks[0]!;

  const development = developmentFromJob(draft);
  const dyeTracks = development.dye_costing_tracks;
  const trimLineTracks = development.trim_line_tracks;
  const sampleStages = development.sample_approval_stages;
  const barcodesDate = barcodesSentDate(draft);
  const printTracks = costing.print_embroidery_costing_tracks;
  const colorways = costing.colorways;
  const visibleSections = accordionSectionsForJob(draft.job_type);

  function patchColorway(colorwayId: number, partial: Partial<Colorway>) {
    patchCosting({
      colorways: colorways.map((cw) => (cw.id === colorwayId ? { ...cw, ...partial } : cw)),
    });
  }

  function patchSample(colorwayId: number, sampleId: number, partial: Partial<Sample>) {
    patchCosting({
      colorways: colorways.map((cw) =>
        cw.id !== colorwayId
          ? cw
          : {
              ...cw,
              samples: cw.samples.map((s) => (s.id === sampleId ? { ...s, ...partial } : s)),
            },
      ),
    });
  }

  function addColorway() {
    const maxId = colorways.reduce((m, c) => Math.max(m, c.id), 0);
    patchCosting({
      colorways: [...colorways, { id: maxId + 1, name: `Colorway ${colorways.length + 1}`, samples: [] }],
    });
  }

  function nextSampleType(colorwayId: number): SampleType {
    const cw = colorways.find((c) => c.id === colorwayId);
    const used = new Set(cw?.samples.map((s) => s.type) ?? []);
    return SAMPLE_TYPE_OPTIONS.find((t) => !used.has(t)) ?? "1ST SAMPLE";
  }

  function addSample(colorwayId: number) {
    const cw = colorways.find((c) => c.id === colorwayId);
    if (!cw) return;
    const maxId = colorways.flatMap((c) => c.samples).reduce((m, s) => Math.max(m, s.id), 0);
    patchColorway(colorwayId, {
      samples: [
        ...cw.samples,
        {
          id: maxId + 1,
          type: nextSampleType(colorwayId),
          requested_date: null,
          due_date: null,
          received_date: null,
          comments_sent_date: null,
          status: "PENDING",
          comments: null,
        },
      ],
    });
  }

  function removeBulkTrack(id: string) {
    patch({ bulk_production_tracks: bulkTracks.filter((t) => t.id !== id) });
  }

  function updateBulkTracks(tracks: BulkProductionTrack[]) {
    patch({ bulk_production_tracks: tracks });
  }

  const linkedOrder = useMemo(
    () =>
      draft.order_id
        ? orders.find((o) => o.id === draft.order_id)
        : orders[0],
    [draft.order_id, orders],
  );
  const orderDueYmd = linkedOrder?.due_date ?? null;
  const statusLabel = jobStatusDisplay(draft, orderDueYmd);

  const subtitleParts = [
    project.name,
    draft.job_number ? `Job ${draft.job_number}` : null,
    statusLabel,
  ].filter(Boolean);
  const sectionNavItems = visibleModalSections(draft.job_type).map((id) => ({
    id,
    label: SECTION_LABEL[id],
  }));

  return (
    <ProjectModalOverlay
      titleId="job-details-modal-title"
      onClose={onClose}
      overlayClassName={overlayClassName}
      size="wide-tall"
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <JobBadgeIcon />
            </ProjectModalBadge>
          }
          title={
            <>
              Track every step
              <br />
              of the run.
            </>
          }
          body="Update timeline dates, costing, approvals, and production details — all tied to this job’s WIP."
          nav={
            <ModalSectionNavList
              sections={sectionNavItems}
              activeSection={activeSection}
              onSectionChange={(id) => handleJumpToSection(id as JobModalSection)}
              navLabel="Job sections"
              variant="polished"
              tone="aside"
            />
          }
        />
      }
    >
      <ProjectModalPanelHeader
        title={draft.name.trim() || (isNew ? "New job" : "Job details")}
        subtitle={subtitleParts.join(" · ")}
        titleId="job-details-modal-title"
        onClose={onClose}
      />
      {!isNew ? (
        <div className="flex shrink-0 justify-end border-b border-slate-100 px-5 py-2 sm:px-6">
          <JobShareMenu project={project} job={draft} />
        </div>
      ) : null}
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSave} noValidate>
        <ModalSectionLayout
          sections={sectionNavItems}
          activeSection={activeSection}
          onSectionChange={(id) => handleJumpToSection(id as JobModalSection)}
          navLabel="Job sections"
          variant="polished"
          sidebar="none"
          contentRef={scrollRef}
        >
          <div className="space-y-4">
              <div hidden={activeSection !== "overview"}>
            <SectionCard
              id="job-section-overview"
              title="Job details"
              highlight={highlightId === "job-section-overview"}
            >
              <label className={labelClass}>
                Job name
                <input
                  className={fieldClass}
                  value={draft.name}
                  placeholder="Style name"
                  onChange={(e) => {
                    const name = e.target.value;
                    if (!apparelWorkspace && !draft.style_name?.trim()) {
                      patch({ name, style_name: name });
                    } else {
                      patch({ name });
                    }
                  }}
                />
              </label>

              <label className={labelClass}>
                Style name
                <input
                  className={fieldClass}
                  value={draft.style_name ?? draft.name ?? ""}
                  placeholder={apparelWorkspace ? "Product or style name" : "Defaults from job name"}
                  onChange={(e) => patch({ style_name: e.target.value })}
                />
              </label>

              {apparelWorkspace ? (
                <label className={labelClass}>
                  Style #
                  <input
                    className={fieldClass}
                    value={draft.style_number}
                    placeholder="e.g. GGT01"
                    onChange={(e) => patch({ style_number: e.target.value.toUpperCase() })}
                  />
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  <span className="flex items-center gap-2">
                    Status
                    <JobStatusBadge job={draft} orderDueYmd={orderDueYmd} />
                  </span>
                  <select
                    className={fieldClass}
                    value={draft.status}
                    onChange={(e) =>
                      patch({ status: e.target.value as ProjectJob["status"] })
                    }
                  >
                    {JOB_STATUS_SELECT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {isJobLate(draft, orderDueYmd) ? (
                    <p className="mt-1 text-xs text-red-600">
                      Past due — shows as Late until marked Completed.
                    </p>
                  ) : null}
                </label>
                <label className={labelClass}>
                  Job due date
                  <input
                    type="date"
                    className={fieldClass}
                    value={isoToDateInput(draft.due_date)}
                    onChange={(e) =>
                      patch({ due_date: dateInputToIso(e.target.value) })
                    }
                  />
                </label>
              </div>

              {orders.length > 0 ? (
                <label className={labelClass}>
                  Order
                  <select
                    className={fieldClass}
                    value={draft.order_id ?? ""}
                    onChange={(e) => patch({ order_id: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_number}
                        {o.due_date ? ` · due ${isoToDateInput(o.due_date)}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <label className={labelClass}>
                  Job type
                  <select
                    className={fieldClass}
                    value={draft.job_type ?? "print_production"}
                    onChange={(e) => handleJobTypeChange(e.target.value as JobType)}
                  >
                    {JOB_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Category
                  <select
                    className={fieldClass}
                    value={categoryDropdown}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    {CATEGORY_CODES.map((c) => (
                      <option key={c.code} value={c.dropdownLabel}>
                        {c.dropdownLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col justify-end">
                  <VendorFieldSelect
                    label="Supplier"
                    vendors={vendors}
                    value={draft.lead_vendor}
                    onChange={(name) => patch({ lead_vendor: name ?? "" })}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={applyTimelineTemplateForType}
                className="text-[11px] font-semibold text-accent hover:underline"
              >
                Lead times — apply template for this job type
              </button>

              <label className={labelClass}>
                Scope
                <select
                  className={fieldClass}
                  value={draft.scope_kind ?? "original"}
                  onChange={(e) => patch({ scope_kind: e.target.value as JobScopeKind })}
                >
                  <option value="original">Original deliverable</option>
                  <option value="addon">Reorder</option>
                </select>
              </label>

              <div>
                <p className={labelClass}>Colorways & size breakdown</p>
                <div className="mt-2">
                  <JobColorwayEditor
                    rows={colorwayRows}
                    onChange={(rows) => patch(syncLegacyColorwayFields({ ...draft, colorway_rows: rows }))}
                  />
                </div>
              </div>

              <label className={labelClass}>
                Description
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={draft.description ?? ""}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </label>

              <label className={labelClass}>
                Price
                <input
                  className={fieldClass}
                  value={displayPrice}
                  readOnly={Boolean(costingPrice && !draft.price_manual_override)}
                  onChange={(e) =>
                    patch({ price: e.target.value, price_manual_override: true })
                  }
                  placeholder="Unit or line price"
                />
                {costingPrice ? (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    {draft.price_manual_override
                      ? "Manual override — clear override to use costing tab again."
                      : `From costing sheet · $${costingPrice}`}
                    {!draft.price_manual_override ? null : (
                      <button
                        type="button"
                        className="ml-2 font-semibold text-accent hover:underline"
                        onClick={() =>
                          patch({
                            price_manual_override: false,
                            price: costingPrice,
                          })
                        }
                      >
                        Use costing
                      </button>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    Enter manually or add lines on the Costing tab.
                  </p>
                )}
              </label>

              <label className={labelClass}>
                SKU #
                <input
                  className={fieldClass}
                  value={draft.sku ?? ""}
                  placeholder="Unique SKU (optional)"
                  onChange={(e) => patch({ sku: e.target.value.toUpperCase() })}
                />
                <p className="mt-1 text-[11px] text-text-secondary">
                  Must be unique across your workspace.
                </p>
              </label>

              {(draft.custom_fields ?? []).map((cf, idx) => (
                <div key={cf.id ?? `custom-field-${idx}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    className={fieldClass}
                    value={cf.key}
                    placeholder="Field name"
                    onChange={(e) => {
                      const next = [...(draft.custom_fields ?? [])];
                      next[idx] = { ...cf, key: e.target.value };
                      patch({ custom_fields: next });
                    }}
                  />
                  <input
                    className={fieldClass}
                    value={cf.value}
                    placeholder="Value"
                    onChange={(e) => {
                      const next = [...(draft.custom_fields ?? [])];
                      next[idx] = { ...cf, value: e.target.value };
                      patch({ custom_fields: next });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        custom_fields: (draft.custom_fields ?? []).filter((_, i) => i !== idx),
                      })
                    }
                    className="text-xs font-semibold text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <p className="text-[11px] text-text-secondary">
                Optional extra fields for this job (e.g. fabric content, decoration notes).
              </p>
              <button
                type="button"
                onClick={() =>
                  patch({
                    custom_fields: [
                      ...(draft.custom_fields ?? []),
                      {
                        id: `cf-${Date.now().toString(36)}`,
                        key: "",
                        value: "",
                      },
                    ],
                  })
                }
                className="rounded-lg border border-dashed border-border-light px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-accent hover:text-accent"
              >
                + Add field
              </button>

              {draft.scope_kind === "addon" ? (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950">Reorder scope</p>
                  <div className="mt-3 space-y-3">
                    <label className={labelClass}>
                      Reorder category
                      <select
                        className={fieldClass}
                        value={draft.addon_category ?? ""}
                        onChange={(e) => patch({ addon_category: e.target.value })}
                      >
                        <option value="">Select…</option>
                        {ADDON_CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </label>

                    <SizeChipGroup
                      label="Shirt sizes"
                      options={SHIRT_SIZE_OPTIONS}
                      selected={draft.addon_shirt_sizes ?? []}
                      onChange={(sizes) => patch({ addon_shirt_sizes: sizes })}
                    />

                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={labelClass}>Pant sizes</p>
                        <div className="flex rounded-lg border border-border-light bg-white p-0.5 text-[11px] font-semibold">
                          {(["alpha", "numeric"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                patch({
                                  addon_pant_size_mode: mode,
                                  addon_pant_sizes: [],
                                })
                              }
                              className={`rounded-md px-2.5 py-1 capitalize ${
                                (draft.addon_pant_size_mode ?? "alpha") === mode
                                  ? "bg-accent text-white"
                                  : "text-text-secondary"
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                      <SizeChipGroup
                        label=""
                        options={
                          (draft.addon_pant_size_mode ?? "alpha") === "numeric"
                            ? PANT_SIZE_NUMERIC
                            : PANT_SIZE_ALPHA
                        }
                        selected={draft.addon_pant_sizes ?? []}
                        onChange={(sizes) => patch({ addon_pant_sizes: sizes })}
                      />
                    </div>

                    <label className={labelClass}>
                      Custom note
                      <textarea
                        className={textareaClass}
                        rows={2}
                        value={draft.addon_custom_note ?? ""}
                        onChange={(e) => patch({ addon_custom_note: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-border-light bg-surface-body/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                  Brand & garment style
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className={labelClass}>
                      Brand
                      <input
                        className={fieldClass}
                        value={draft.garment_brand ?? ""}
                        onChange={(e) => patch({ garment_brand: e.target.value })}
                      />
                    </label>
                    <label className={labelClass}>
                      Garment style #
                      <input
                        className={fieldClass}
                        value={draft.garment_style_number ?? ""}
                        onChange={(e) => patch({ garment_style_number: e.target.value })}
                      />
                    </label>
                    <label className={labelClass}>
                      Garment color
                      <input
                        className={fieldClass}
                        value={draft.garment_color ?? ""}
                        onChange={(e) => patch({ garment_color: e.target.value })}
                      />
                    </label>
                    <label className={labelClass}>
                      Garment size
                      <input
                        className={fieldClass}
                        value={draft.garment_size ?? ""}
                        onChange={(e) => patch({ garment_size: e.target.value })}
                      />
                    </label>
                </div>
              </div>

            </SectionCard>
              </div>

              <div hidden={activeSection !== "labels"}>
                <SectionCard
                  id="job-section-labels"
                  title="Labels & barcodes"
                  highlight={highlightId === "job-section-labels"}
                >
                  <JobLabelsSection draft={draft} allJobs={allJobs} onPatch={patch} />
                </SectionCard>
              </div>

              <div hidden={activeSection !== "timeline"}>
                <SectionCard
                  id="job-section-timeline"
                  title="Job timeline"
                  highlight={highlightId === "job-section-timeline"}
                >
                  <p className="text-xs text-text-secondary">
                    Tap a step to jump to its fields; durations are editable.
                  </p>
                  <WipTimeline
                    steps={draft.timeline}
                    editableDurations
                    onDurationChange={handleJobDurationChange}
                    onStepClick={handleTimelineStepClick}
                  />
                  <JobTimelineStepsEditor
                    jobLabel={jobTimelineEditorLabel(draft)}
                    steps={draft.timeline}
                    onChange={(timeline) => patch({ timeline })}
                  />
                </SectionCard>
              </div>

            {visibleSections.map((section) => (
              <div key={section} hidden={activeSection !== section}>
              <SectionPanel
                id={`job-section-${section}`}
                title={SECTION_LABEL[section]}
                highlight={highlightId === `job-section-${section}`}
              >
                {section === "estimate" ? (
                  <>
                    <WipStepFieldBlock
                      stepId="vendor_inquiries"
                      highlight={highlightId === "job-step-vendor_inquiries"}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                          <label className={labelClass}>
                            Quote requested
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(estimate.quote_requested_date)}
                              onChange={(e) =>
                                patchEstimate({ quote_requested_date: dateInputToIso(e.target.value) })
                              }
                            />
                          </label>
                          <label className={labelClass}>
                            Vendor costing received
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(estimate.vendor_costing_received_date)}
                              onChange={(e) =>
                                patchEstimate({ vendor_costing_received_date: dateInputToIso(e.target.value) })
                              }
                            />
                          </label>
                        </div>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="mock_up" highlight={highlightId === "job-step-mock_up"}>
                      <label className={labelClass}>
                          References sent
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(estimate.references_sent_date)}
                            onChange={(e) =>
                              patchEstimate({ references_sent_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={`${labelClass} mt-3 block`}>
                          Mock-up notes
                          <textarea
                            className={textareaClass}
                            rows={3}
                            value={estimate.mock_up_notes ?? ""}
                            onChange={(e) =>
                              patchEstimate({ mock_up_notes: e.target.value.trim() || null })
                            }
                        />
                      </label>
                    </WipStepFieldBlock>
                  </>
                ) : null}

                {section === "development" ? (
                  <>
                    <WipStepFieldBlock stepId="tp_setup" highlight={highlightId === "job-step-tp_setup"}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          Tech pack due
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(techPackDueDate(techPack))}
                            onChange={(e) =>
                              patchTechPack({ tech_pack_due_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Tech pack complete
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(techPackCompleteDate(techPack))}
                            onChange={(e) =>
                              patchTechPack({ tech_pack_complete_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                      <div className="mt-4">
                        <TechPackArtworkSection
                          files={techPack.artwork_files ?? []}
                          links={techPack.dropbox_links ?? []}
                          onChangeFiles={(artwork_files) => patchTechPack({ artwork_files })}
                          onChangeLinks={(dropbox_links) => patchTechPack({ dropbox_links })}
                        />
                      </div>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock
                      stepId="blanks_lab_dip"
                      highlight={highlightId === "job-step-blanks_lab_dip"}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Blanks purchasing
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          Blanks purchased
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(development.blanks_purchased_date)}
                            onChange={(e) =>
                              patchDevelopment({ blanks_purchased_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Products Go blanks requested
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(development.pg_requested_date)}
                            onChange={(e) =>
                              patchDevelopment({ pg_requested_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Blanks received
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(development.blanks_received_date)}
                            onChange={(e) =>
                              patchDevelopment({ blanks_received_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                      </div>

                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Lab dip requested
                      </p>
                      <div className="mt-3 space-y-3">
                        {dyeTracks.map((t, i) => (
                          <SectionCard
                            key={t.id}
                            title={dyeTracks.length > 1 ? `Dye line ${i + 1}` : "Dye line"}
                            headerExtra={
                              dyeTracks.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchDevelopment({
                                      dye_costing_tracks: dyeTracks.filter((x) => x.id !== t.id),
                                    })
                                  }
                                  className="text-[11px] font-semibold text-red-600 hover:underline"
                                >
                                  Remove
                                </button>
                              ) : undefined
                            }
                          >
                            <VendorFieldSelect
                              label="Vendor"
                              vendors={vendors}
                              value={t.dye_vendor}
                              onChange={(name) =>
                                patchDevelopment({
                                  dye_costing_tracks: updateDyeTrack(dyeTracks, t.id, {
                                    dye_vendor: name,
                                  }),
                                })
                              }
                            />
                            <div className="grid gap-3 sm:grid-cols-3">
                              <label className={labelClass}>
                                Lab dip requested
                                <input
                                  type="date"
                                  className={fieldClass}
                                  value={isoToDateInput(t.lab_dip_request_date)}
                                  onChange={(e) =>
                                    patchDevelopment({
                                      dye_costing_tracks: updateDyeTrack(dyeTracks, t.id, {
                                        lab_dip_request_date: dateInputToIso(e.target.value),
                                      }),
                                    })
                                  }
                                />
                              </label>
                              <label className={labelClass}>
                                Lab dip due
                                <input
                                  type="date"
                                  className={fieldClass}
                                  value={isoToDateInput(t.lab_dip_due_date)}
                                  onChange={(e) =>
                                    patchDevelopment({
                                      dye_costing_tracks: updateDyeTrack(dyeTracks, t.id, {
                                        lab_dip_due_date: dateInputToIso(e.target.value),
                                      }),
                                    })
                                  }
                                />
                              </label>
                              <label className={labelClass}>
                                Lab dip received
                                <input
                                  type="date"
                                  className={fieldClass}
                                  value={isoToDateInput(t.lab_dip_received_date)}
                                  onChange={(e) =>
                                    patchDevelopment({
                                      dye_costing_tracks: updateDyeTrack(dyeTracks, t.id, {
                                        lab_dip_received_date: dateInputToIso(e.target.value),
                                      }),
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <label className={labelClass}>
                              Lab dip status
                              <select
                                className={fieldClass}
                                value={t.lab_dip_approval_status ?? "PENDING"}
                                onChange={(e) =>
                                  patchDevelopment({
                                    dye_costing_tracks: updateDyeTrack(dyeTracks, t.id, {
                                      lab_dip_approval_status: e.target.value as ApprovalStatus,
                                    }),
                                  })
                                }
                              >
                                {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </SectionCard>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            patchDevelopment({ dye_costing_tracks: [...dyeTracks, defaultDyeCostingTrack()] })
                          }
                          className="w-full rounded-xl border border-dashed border-accent/45 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50/90"
                        >
                          + Add dye line
                        </button>
                      </div>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="order_trims" highlight={highlightId === "job-step-order_trims"}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Trims
                      </p>
                      <div className="mt-3 space-y-3">
                        {trimLineTracks.map((t, i) => (
                          <SectionCard
                            key={t.id}
                            title={trimLineTracks.length > 1 ? `Trim line ${i + 1}` : "Trim line"}
                            headerExtra={
                              trimLineTracks.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    patchDevelopment({
                                      trim_line_tracks: trimLineTracks.filter((x) => x.id !== t.id),
                                    })
                                  }
                                  className="text-[11px] font-semibold text-red-600 hover:underline"
                                >
                                  Remove
                                </button>
                              ) : undefined
                            }
                          >
                            <VendorFieldSelect
                              label="Vendor"
                              vendors={vendors}
                              value={t.vendor}
                              onChange={(name) =>
                                patchDevelopment({
                                  trim_line_tracks: updateTrimLineTrack(trimLineTracks, t.id, {
                                    vendor: name,
                                  }),
                                })
                              }
                            />
                            <label className={labelClass}>
                              Trim type
                              <input
                                className={fieldClass}
                                value={t.trim_type ?? ""}
                                placeholder="e.g. woven label, hang tag"
                                onChange={(e) =>
                                  patchDevelopment({
                                    trim_line_tracks: updateTrimLineTrack(trimLineTracks, t.id, {
                                      trim_type: e.target.value.trim() || null,
                                    }),
                                  })
                                }
                              />
                            </label>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className={labelClass}>
                                Trim ordered
                                <input
                                  type="date"
                                  className={fieldClass}
                                  value={isoToDateInput(t.trim_ordered_date)}
                                  onChange={(e) =>
                                    patchDevelopment({
                                      trim_line_tracks: updateTrimLineTrack(trimLineTracks, t.id, {
                                        trim_ordered_date: dateInputToIso(e.target.value),
                                      }),
                                    })
                                  }
                                />
                              </label>
                              <label className={labelClass}>
                                Trim received
                                <input
                                  type="date"
                                  className={fieldClass}
                                  value={isoToDateInput(t.trim_received_date)}
                                  onChange={(e) =>
                                    patchDevelopment({
                                      trim_line_tracks: updateTrimLineTrack(trimLineTracks, t.id, {
                                        trim_received_date: dateInputToIso(e.target.value),
                                      }),
                                    })
                                  }
                                />
                              </label>
                            </div>
                          </SectionCard>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            patchDevelopment({
                              trim_line_tracks: [...trimLineTracks, defaultTrimLineTrack()],
                            })
                          }
                          className="w-full rounded-xl border border-dashed border-accent/45 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50/90"
                        >
                          + Add trim line
                        </button>
                      </div>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock
                      stepId="sample_approvals"
                      title="SAMPLE APPROVALS"
                      highlight={highlightId === "job-step-sample_approvals"}
                    >
                      <div className="space-y-5">
                        {sampleStages.map((stage) => {
                          const fieldLabels = sampleApprovalFieldLabels(stage.key);
                          return (
                            <div
                              key={stage.key}
                              className="grid gap-3 border-t border-border-light pt-4 first:border-t-0 first:pt-0 sm:grid-cols-3"
                            >
                              <label className={labelClass}>
                                {fieldLabels.requested}
                                <input
                                  type="date"
                                  className={fieldClass}
                                  value={isoToDateInput(stage.requested_date)}
                                  onChange={(e) =>
                                    patchDevelopment({
                                      sample_approval_stages: updateSampleStage(
                                        sampleStages,
                                        stage.key,
                                        { requested_date: dateInputToIso(e.target.value) },
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <label className={labelClass}>
                                {fieldLabels.due}
                                <input
                                  type="date"
                                  className={fieldClass}
                                  value={isoToDateInput(stage.due_date)}
                                  onChange={(e) =>
                                    patchDevelopment({
                                      sample_approval_stages: updateSampleStage(
                                        sampleStages,
                                        stage.key,
                                        { due_date: dateInputToIso(e.target.value) },
                                      ),
                                    })
                                  }
                                />
                              </label>
                              <label className={labelClass}>
                                {fieldLabels.status}
                                <select
                                  className={fieldClass}
                                  value={stage.status ?? "PENDING"}
                                  onChange={(e) =>
                                    patchDevelopment({
                                      sample_approval_stages: updateSampleStage(
                                        sampleStages,
                                        stage.key,
                                        { status: e.target.value as ApprovalStatus },
                                      ),
                                    })
                                  }
                                >
                                  {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </WipStepFieldBlock>
                  </>
                ) : null}

                {section === "costing" ? (
                  <>
                    <SectionCard title="Vendor quotes (their cost to us)">
                      <VendorQuotesSection
                        quotes={draft.vendor_quotes ?? []}
                        vendors={vendors}
                        onChange={patchVendorQuotes}
                        onPullToCosting={pullVendorQuoteIntoSheet}
                      />
                    </SectionCard>

                    <SectionCard title="Costing sheet (internal worksheet)">
                      <CostingSheetEditor
                        job={draft}
                        sheet={draft.costing_sheet ?? emptyCostingSheet()}
                        vendors={vendors}
                        vendorQuotes={draft.vendor_quotes ?? []}
                        onChange={patchCostingSheet}
                        onGenerateEstimate={handleGenerateEstimate}
                      />
                    </SectionCard>

                    <SectionCard title="Estimates (client-facing snapshots)">
                      <EstimatesList
                        estimates={draft.estimates ?? []}
                        onChange={patchEstimates}
                        job={draft}
                        clientName={project.client.name}
                      />
                    </SectionCard>

                    <WipStepFieldBlock stepId="cost_sheets" highlight={highlightId === "job-step-cost_sheets"}>
                      <label className={labelClass}>
                        Cost sheet prepared
                        <input
                          type="date"
                          className={fieldClass}
                          value={isoToDateInput(costing.cost_sheet_prepared_date)}
                          onChange={(e) =>
                            patchCosting({ cost_sheet_prepared_date: dateInputToIso(e.target.value) })
                          }
                        />
                      </label>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock
                      stepId="costing_summary"
                      highlight={highlightId === "job-step-costing_summary"}
                    >
                      <label className={labelClass}>
                        Estimate sent
                        <input
                          type="date"
                          className={fieldClass}
                          value={isoToDateInput(costing.estimate_sent_date)}
                          onChange={(e) =>
                            patchCosting({ estimate_sent_date: dateInputToIso(e.target.value) })
                          }
                        />
                      </label>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock
                      stepId="deposit_payment"
                      highlight={highlightId === "job-step-deposit_payment"}
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text-primary">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-border-light text-accent focus:ring-accent"
                          checked={costing.costing_approved === true}
                          ref={(el) => {
                            if (el) el.indeterminate = costing.costing_approved === null;
                          }}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            patchCosting({
                              costing_approved: checked ? true : false,
                              costing_approved_at: checked
                                ? dateInputToIso(new Date().toISOString().slice(0, 10))
                                : null,
                            });
                          }}
                        />
                        Deposit / payment received (costing approved)
                      </label>
                    </WipStepFieldBlock>

                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Print / embroidery
                      </p>
                      {printTracks.map((t, i) => (
                        <SectionCard
                          key={t.id}
                          title={printTracks.length > 1 ? `Print line ${i + 1}` : "Print line"}
                          headerExtra={
                            printTracks.length > 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  patchCosting({
                                    print_embroidery_costing_tracks: printTracks.filter((x) => x.id !== t.id),
                                  })
                                }
                                className="text-[11px] font-semibold text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            ) : undefined
                          }
                        >
                          <VendorFieldSelect
                            label="Vendor"
                            vendors={vendors}
                            value={t.print_embroidery_vendor}
                            onChange={(name) =>
                              patchCosting({
                                print_embroidery_costing_tracks: updatePrintEmbTrack(printTracks, t.id, {
                                  print_embroidery_vendor: name,
                                }),
                              })
                            }
                          />
                          <div className="grid gap-3 sm:grid-cols-3">
                            <label className={labelClass}>
                              Strike off requested
                              <input
                                type="date"
                                className={fieldClass}
                                value={isoToDateInput(t.strike_off_request_date)}
                                onChange={(e) =>
                                  patchCosting({
                                    print_embroidery_costing_tracks: updatePrintEmbTrack(printTracks, t.id, {
                                      strike_off_request_date: dateInputToIso(e.target.value),
                                    }),
                                  })
                                }
                              />
                            </label>
                            <label className={labelClass}>
                              Strike off due
                              <input
                                type="date"
                                className={fieldClass}
                                value={isoToDateInput(t.strike_off_due_date)}
                                onChange={(e) =>
                                  patchCosting({
                                    print_embroidery_costing_tracks: updatePrintEmbTrack(printTracks, t.id, {
                                      strike_off_due_date: dateInputToIso(e.target.value),
                                    }),
                                  })
                                }
                              />
                            </label>
                            <label className={labelClass}>
                              Strike off received
                              <input
                                type="date"
                                className={fieldClass}
                                value={isoToDateInput(t.strike_off_received_date)}
                                onChange={(e) =>
                                  patchCosting({
                                    print_embroidery_costing_tracks: updatePrintEmbTrack(printTracks, t.id, {
                                      strike_off_received_date: dateInputToIso(e.target.value),
                                    }),
                                  })
                                }
                              />
                            </label>
                          </div>
                          <label className={labelClass}>
                            Strike off status
                            <select
                              className={fieldClass}
                              value={t.strike_off_approval_status ?? "PENDING"}
                              onChange={(e) =>
                                patchCosting({
                                  print_embroidery_costing_tracks: updatePrintEmbTrack(printTracks, t.id, {
                                    strike_off_approval_status: e.target.value as ApprovalStatus,
                                  }),
                                })
                              }
                            >
                              {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                        </SectionCard>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          patchCosting({
                            print_embroidery_costing_tracks: [...printTracks, defaultPrintEmbroideryTrack()],
                          })
                        }
                        className="w-full rounded-xl border border-dashed border-accent/45 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50/90"
                      >
                        + Add print / embroidery line
                      </button>
                    </div>

                    <div className="space-y-3 border-t border-border-light pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                          Cut & sew · colorways & samples
                        </p>
                        <button
                          type="button"
                          onClick={addColorway}
                          className="text-xs font-semibold text-accent hover:underline"
                        >
                          + Add colorway
                        </button>
                      </div>
                      {colorways.map((cw) => (
                        <SectionCard
                          key={cw.id}
                          title={cw.name}
                          headerExtra={
                            colorways.length > 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  patchCosting({ colorways: colorways.filter((c) => c.id !== cw.id) })
                                }
                                className="text-[11px] font-semibold text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            ) : undefined
                          }
                        >
                          <label className={labelClass}>
                            Colorway name
                            <input
                              className={fieldClass}
                              value={cw.name}
                              onChange={(e) => patchColorway(cw.id, { name: e.target.value })}
                            />
                          </label>
                          {cw.samples.length === 0 ? (
                            <p className="text-sm text-text-secondary">No samples yet.</p>
                          ) : (
                            cw.samples.map((s) => (
                              <GrayRow key={s.id}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <label className={`${labelClass} min-w-[10rem] flex-1`}>
                                    Sample stage
                                    <select
                                      className={fieldClass}
                                      value={s.type}
                                      onChange={(e) =>
                                        patchSample(cw.id, s.id, {
                                          type: e.target.value as SampleType,
                                        })
                                      }
                                    >
                                      {SAMPLE_TYPE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchColorway(cw.id, {
                                        samples: cw.samples.filter((x) => x.id !== s.id),
                                      })
                                    }
                                    className="text-[11px] font-semibold text-red-600 hover:underline"
                                  >
                                    Remove sample
                                  </button>
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                  <label className={labelClass}>
                                    Requested
                                    <input
                                      type="date"
                                      className={fieldClass}
                                      value={isoToDateInput(s.requested_date)}
                                      onChange={(e) =>
                                        patchSample(cw.id, s.id, {
                                          requested_date: dateInputToIso(e.target.value),
                                        })
                                      }
                                    />
                                  </label>
                                  <label className={labelClass}>
                                    Due
                                    <input
                                      type="date"
                                      className={fieldClass}
                                      value={isoToDateInput(s.due_date)}
                                      onChange={(e) =>
                                        patchSample(cw.id, s.id, {
                                          due_date: dateInputToIso(e.target.value),
                                        })
                                      }
                                    />
                                  </label>
                                  <label className={labelClass}>
                                    Received
                                    <input
                                      type="date"
                                      className={fieldClass}
                                      value={isoToDateInput(s.received_date)}
                                      onChange={(e) =>
                                        patchSample(cw.id, s.id, {
                                          received_date: dateInputToIso(e.target.value),
                                        })
                                      }
                                    />
                                  </label>
                                  <label className={labelClass}>
                                    Comments sent
                                    <input
                                      type="date"
                                      className={fieldClass}
                                      value={isoToDateInput(s.comments_sent_date)}
                                      onChange={(e) =>
                                        patchSample(cw.id, s.id, {
                                          comments_sent_date: dateInputToIso(e.target.value),
                                        })
                                      }
                                    />
                                  </label>
                                  <label className={`${labelClass} sm:col-span-2`}>
                                    Status
                                    <select
                                      className={fieldClass}
                                      value={s.status}
                                      onChange={(e) =>
                                        patchSample(cw.id, s.id, {
                                          status: e.target.value as SampleStatus,
                                        })
                                      }
                                    >
                                      {SAMPLE_STATUS_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className={`${labelClass} sm:col-span-2`}>
                                    Comments
                                    <textarea
                                      className={textareaClass}
                                      rows={2}
                                      value={s.comments ?? ""}
                                      onChange={(e) =>
                                        patchSample(cw.id, s.id, {
                                          comments: e.target.value.trim() || null,
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                              </GrayRow>
                            ))
                          )}
                          <button
                            type="button"
                            onClick={() => addSample(cw.id)}
                            className="text-xs font-semibold text-accent hover:underline"
                          >
                            + Add sample
                          </button>
                        </SectionCard>
                      ))}
                    </div>
                  </>
                ) : null}

                {section === "approvals" ? (
                  <>
                    <WipStepFieldBlock
                      stepId="sent_to_contractors"
                      highlight={highlightId === "job-step-sent_to_contractors"}
                    >
                      <label className={labelClass}>
                        Blanks, trims & TPs sent to contractors
                        <input
                          type="date"
                          className={fieldClass}
                          value={isoToDateInput(approvals.sent_to_contractors_date)}
                          onChange={(e) =>
                            patchApprovals({ sent_to_contractors_date: dateInputToIso(e.target.value) })
                          }
                        />
                      </label>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="strike_off" highlight={highlightId === "job-step-strike_off"}>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className={labelClass}>
                          Strike-off request
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(approvals.strike_off_request_date)}
                            onChange={(e) =>
                              patchApprovals({ strike_off_request_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Strike-off due
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(approvals.strike_off_due_date)}
                            onChange={(e) =>
                              patchApprovals({ strike_off_due_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Strike-off received
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(approvals.strike_off_received_date)}
                            onChange={(e) =>
                              patchApprovals({ strike_off_received_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                      <label className={`${labelClass} mt-3 block`}>
                        Strike-off status
                        <select
                          className={fieldClass}
                          value={approvals.strike_off_approval_status ?? "PENDING"}
                          onChange={(e) =>
                            patchApprovals({
                              strike_off_approval_status: e.target.value as ApprovalStatus,
                            })
                          }
                        >
                          {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                    </WipStepFieldBlock>
                  </>
                ) : null}

                {section === "bulk" ? (
                  <>
                    <WipStepFieldBlock
                      stepId="barcodes"
                      title="Barcodes sent to vendor"
                      highlight={highlightId === "job-step-barcodes"}
                    >
                      <label className={labelClass}>
                        Barcodes sent to vendor
                        <input
                          type="date"
                          className={fieldClass}
                          value={isoToDateInput(barcodesDate)}
                          onChange={(e) =>
                            setDraft((prev) =>
                              patchBarcodesSentDate(prev, dateInputToIso(e.target.value)),
                            )
                          }
                        />
                      </label>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="trimming" highlight={highlightId === "job-step-trimming"}>
                      {draft.job_type === "cut_sew" ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className={labelClass}>
                            Bulk fabric approved
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(primaryBulk.bulk_fabric_approval_date)}
                              onChange={(e) =>
                                updateBulkTracks(
                                  updateBulkTrack(bulkTracks, primaryBulk.id, {
                                    bulk_fabric_approval_date: dateInputToIso(e.target.value),
                                  }),
                                )
                              }
                            />
                          </label>
                          <label className={labelClass}>
                            Bulk trim approved
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(primaryBulk.bulk_trim_approval_date)}
                              onChange={(e) =>
                                updateBulkTracks(
                                  updateBulkTrack(bulkTracks, primaryBulk.id, {
                                    bulk_trim_approval_date: dateInputToIso(e.target.value),
                                  }),
                                )
                              }
                            />
                          </label>
                          <label className={labelClass}>
                            TOP due
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(primaryBulk.top_due_date)}
                              onChange={(e) =>
                                updateBulkTracks(
                                  updateBulkTrack(bulkTracks, primaryBulk.id, {
                                    top_due_date: dateInputToIso(e.target.value),
                                  }),
                                )
                              }
                            />
                          </label>
                          <label className={labelClass}>
                            TOP approved
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(primaryBulk.top_approved_date)}
                              onChange={(e) =>
                                updateBulkTracks(
                                  updateBulkTrack(bulkTracks, primaryBulk.id, {
                                    top_approved_date: dateInputToIso(e.target.value),
                                  }),
                                )
                              }
                            />
                          </label>
                        </div>
                      ) : (
                        <label className={labelClass}>
                          Trimming completed
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(primaryBulk.trimming_completed_date)}
                            onChange={(e) =>
                              updateBulkTracks(
                                updateBulkTrack(bulkTracks, primaryBulk.id, {
                                  trimming_completed_date: dateInputToIso(e.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                      )}
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="packing" highlight={highlightId === "job-step-packing"}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          Packing list received
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(fulfillment.packing_list_received_date)}
                            onChange={(e) =>
                              patchFulfillment({ packing_list_received_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Packing list sent to client
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(fulfillment.packing_list_sent_to_client_date)}
                            onChange={(e) =>
                              patchFulfillment({
                                packing_list_sent_to_client_date: dateInputToIso(e.target.value),
                              })
                            }
                          />
                        </label>
                      </div>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="arrange_delivery" highlight={highlightId === "job-step-arrange_delivery"}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          Bulk target delivery
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(primaryBulk.bulk_target_delivery_date)}
                            onChange={(e) =>
                              updateBulkTracks(
                                updateBulkTrack(bulkTracks, primaryBulk.id, {
                                  bulk_target_delivery_date: dateInputToIso(e.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Ex-factory date
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(primaryBulk.ex_factory_date)}
                            onChange={(e) =>
                              updateBulkTracks(
                                updateBulkTrack(bulkTracks, primaryBulk.id, {
                                  ex_factory_date: dateInputToIso(e.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                      </div>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="completion" highlight={highlightId === "job-step-completion"}>
                      <label className={labelClass}>
                        Client received
                        <input
                          type="date"
                          className={fieldClass}
                          value={isoToDateInput(fulfillment.client_received_date)}
                          onChange={(e) =>
                            patchFulfillment({ client_received_date: dateInputToIso(e.target.value) })
                          }
                        />
                      </label>
                    </WipStepFieldBlock>

                    {bulkTracks.length > 1 ? (
                      <div className="space-y-3 border-t border-border-light pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                          Additional production schedules
                        </p>
                        {bulkTracks.slice(1).map((t) => (
                          <SectionCard
                            key={t.id}
                            title={t.title}
                            headerExtra={
                              <button
                                type="button"
                                onClick={() => removeBulkTrack(t.id)}
                                className="text-[11px] font-semibold text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            }
                          >
                            <label className={labelClass}>
                              Schedule name
                              <input
                                className={fieldClass}
                                value={t.title}
                                onChange={(e) =>
                                  updateBulkTracks(
                                    updateBulkTrack(bulkTracks, t.id, { title: e.target.value }),
                                  )
                                }
                              />
                            </label>
                          </SectionCard>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        updateBulkTracks([
                          ...bulkTracks,
                          defaultBulkProductionTrack(`Production schedule ${bulkTracks.length + 1}`),
                        ])
                      }
                      className="w-full rounded-xl border border-dashed border-accent/45 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50/90"
                    >
                      + Add production schedule
                    </button>
                  </>
                ) : null}
              </SectionPanel>
              </div>
            ))}
          </div>
        </ModalSectionLayout>

        <ProjectModalPanelFooter
          deleteLabel={
            !isNew && onDelete ? (deleting ? "Deleting…" : "Delete job") : undefined
          }
          onDelete={!isNew ? onDelete : undefined}
          deleteDisabled={deleting || saving}
          extraLeftLabel={!isNew ? "Duplicate job" : undefined}
          onExtraLeft={!isNew ? handleDuplicate : undefined}
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel={saving ? "Saving…" : "Save job"}
          primaryIcon={<CheckMini />}
          primaryDisabled={deleting || saving}
        />
      </form>

      <DuplicateJobDialog
        open={duplicateOpen}
        source={draft}
        onClose={() => setDuplicateOpen(false)}
        onConfirm={confirmDuplicate}
      />
    </ProjectModalOverlay>
  );
}
