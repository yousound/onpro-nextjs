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
  JobType,
  ProjectJob,
  wipStepToSection,
} from "@/lib/types/wip";
import { jobTimelineEditorLabel } from "@/lib/types/wip";
import { VendorFieldSelect } from "@/components/vendor-select";
import { normalizeJob } from "@/lib/job-defaults";
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
  updateBulkTrack,
  updateDyeTrack,
  updatePrintEmbTrack,
} from "@/lib/project-repeatable-tracks";
import { generatePoForJob } from "@/lib/po-context";
import {
  COMMON_COLORWAY_NAMES,
  generateStyleNumber,
  resolveColorCode,
  styleColorCode,
} from "@/lib/style-number";
import { wipStepLabel } from "@/lib/wip-project-timeline";
import { JobTimelineStepsEditor } from "@/components/job-timeline-steps-editor";
import { WipTimeline } from "@/components/wip-timeline";
import { JobLabelsSection } from "@/components/job-labels-section";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const labelClass = "block text-xs font-medium text-text-secondary";

const readOnlyFieldClass =
  "mt-1 w-full rounded-lg border border-border-light bg-slate-50 px-3 py-2 text-sm text-text-secondary";

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

const SECTION_LABELS: Record<JobDetailsSection, string> = {
  overview: "Overview",
  estimate: "Estimate",
  development: "Development",
  costing: "Costing",
  approvals: "Approvals",
  bulk: "Bulk production",
};

const ACCORDION_SECTIONS: JobDetailsSection[] = [
  "estimate",
  "development",
  "costing",
  "approvals",
  "bulk",
];

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
    tech_pack: job.tech_pack ? { ...job.tech_pack } : undefined,
    fulfillment: job.fulfillment ? { ...job.fulfillment } : undefined,
    bulk_production_tracks: job.bulk_production_tracks?.map((t) => ({ ...t })),
    addon_shirt_sizes: job.addon_shirt_sizes ? [...job.addon_shirt_sizes] : undefined,
    addon_pant_sizes: job.addon_pant_sizes ? [...job.addon_pant_sizes] : undefined,
    label_files: job.label_files?.map((f) => ({ ...f })),
    label_lines: job.label_lines?.map((l) => ({ ...l })),
  };
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
      className={`rounded-2xl border border-border-light bg-white p-4 shadow-sm transition-shadow ${
        highlight ? "ring-2 ring-accent/70 ring-offset-2" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{title}</h3>
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

function AccordionSection({
  id,
  title,
  open,
  onToggle,
  highlight,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={`overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition-shadow ${
        highlight ? "ring-2 ring-accent/70 ring-offset-2" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[13px] font-semibold uppercase tracking-wide text-text-secondary">{title}</span>
        <span
          className={`shrink-0 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? <div className="space-y-4 border-t border-border-light px-4 py-4">{children}</div> : null}
    </div>
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
  clientCode: string;
  vendors: Contact[];
  focus?: JobDetailsFocus;
  isNew?: boolean;
  /** When nested inside another modal (e.g. message attachment composer). */
  overlayClassName?: string;
  onClose: () => void;
  onSave: (job: ProjectJob) => void;
};

export function JobDetailsModal({
  project,
  job,
  allJobs,
  clientCode,
  vendors,
  focus,
  isNew,
  overlayClassName = "z-[100]",
  onClose,
  onSave,
}: JobDetailsModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(() => cloneJob(normalizeJob(job, isNew ? undefined : project)));
  const [categoryDropdown, setCategoryDropdown] = useState(() =>
    isNew ? "" : resolveCategoryDropdown(job.category),
  );
  const [expanded, setExpanded] = useState<Record<JobDetailsSection, boolean>>(() => ({
    overview: true,
    estimate: focus?.section === "estimate",
    development: focus?.section === "development",
    costing: focus?.section === "costing",
    approvals: focus?.section === "approvals",
    bulk: focus?.section === "bulk",
  }));
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const existingStyles = useMemo(
    () =>
      allJobs
        .filter((j) => j.id !== draft.id)
        .map((j) => j.style_number)
        .filter(Boolean),
    [allJobs, draft.id],
  );

  const autoStyleNumber = useMemo(
    () => generateStyleNumber(clientCode, categoryDropdown, existingStyles),
    [clientCode, categoryDropdown, existingStyles],
  );

  useEffect(() => {
    setDraft((prev) => ({ ...prev, style_number: autoStyleNumber }));
  }, [autoStyleNumber]);

  useEffect(() => {
    if (!focus) return;
    setExpanded((prev) => ({ ...prev, [focus.section]: true }));
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
    setDraft((prev) => ({
      ...prev,
      tech_pack: { ...prev.tech_pack!, ...partial },
    }));
  }, []);

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

  const siblingJobs = useMemo(
    () => allJobs.filter((j) => j.project_id === project.id && j.id !== draft.id),
    [allJobs, project.id, draft.id],
  );

  function handleGeneratePo() {
    patch({ po_number: generatePoForJob(project) });
  }

  function handleLinkPo(fromJobId: string) {
    const source = allJobs.find((j) => j.id === fromJobId);
    if (source?.po_number) patch({ po_number: source.po_number });
  }

  function handleTimelineStepClick(stepId: string) {
    const step = draft.timeline.find((s) => s.id === stepId);
    const section = wipStepToSection(stepId, step?.opensIn);
    setExpanded((prev) => ({ ...prev, [section]: true }));
    const targetId = `job-step-${stepId}`;
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
    const po = draft.po_number?.trim() || null;
    const saved: ProjectJob = {
      ...draft,
      category: categoryDropdown,
      po_number: po,
      scope_note: draft.scope_note?.trim() || undefined,
      updated_at: new Date().toISOString(),
    };
    onSave(normalizeJob(saved, project));
  }

  const estimate = draft.estimate!;
  const costing = draft.costing!;
  const approvals = draft.approvals!;
  const techPack = draft.tech_pack!;
  const fulfillment = draft.fulfillment!;
  const bulkTracks = draft.bulk_production_tracks ?? [];
  const primaryBulk = bulkTracks[0]!;

  const dyeTracks = costing.dye_costing_tracks;
  const printTracks = costing.print_embroidery_costing_tracks;
  const colorways = costing.colorways;

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

  const title = isNew ? "New job" : "Job Details";

  return (
    <div
      className={`fixed inset-0 flex items-end justify-center bg-black/45 p-4 sm:items-center ${overlayClassName}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-details-modal-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-light bg-surface-card shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border-light px-5 py-4">
          <h2 id="job-details-modal-title" className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            {project.name} · Saved in this browser only (mock)
          </p>
        </div>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSave}>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <SectionCard
              id="job-section-overview"
              title="Overview"
              highlight={highlightId === "job-section-overview"}
            >
              <label className={labelClass}>
                Due date
                <input
                  type="date"
                  className={fieldClass}
                  value={isoToDateInput(draft.due_date)}
                  onChange={(e) => patch({ due_date: dateInputToIso(e.target.value) })}
                />
              </label>

              <label className={labelClass}>
                Job name
                <input
                  className={fieldClass}
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>

              <label className={labelClass}>
                Subtitle
                <input
                  className={fieldClass}
                  value={draft.subtitle}
                  onChange={(e) => patch({ subtitle: e.target.value })}
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>

              <label className={labelClass}>
                Style #
                <input className={readOnlyFieldClass} readOnly value={draft.style_number} aria-readonly />
              </label>

              <label className={labelClass}>
                Colorway
                <input
                  className={fieldClass}
                  list="job-colorway-options"
                  value={draft.colorway ?? ""}
                  placeholder="e.g. Black, Baby pink"
                  onChange={(e) => patch({ colorway: e.target.value })}
                />
                <datalist id="job-colorway-options">
                  {COMMON_COLORWAY_NAMES.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Pick a standard name or type your own. Code preview:{" "}
                  <span className="font-mono font-semibold text-text-primary">
                    {resolveColorCode(draft.colorway ?? "", draft.color_code) || "—"}
                  </span>
                </p>
              </label>

              <label className={labelClass}>
                Color code (3 letters)
                <input
                  className={fieldClass}
                  value={draft.color_code ?? ""}
                  placeholder="Auto from colorway, or e.g. BLK"
                  maxLength={3}
                  onChange={(e) =>
                    patch({
                      color_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3),
                    })
                  }
                />
                <p className="mt-1 text-[11px] text-text-secondary">
                  Override when the colorway name is custom (Heather grey → HGR, etc.).
                </p>
              </label>

              <div className="rounded-xl border border-border-light bg-surface-body/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">PO #</p>
                <label className={`${labelClass} mt-2`}>
                  Purchase order
                  <input
                    className={fieldClass}
                    value={draft.po_number ?? ""}
                    onChange={(e) => patch({ po_number: e.target.value.trim() || null })}
                    placeholder="Auto-assigned on create"
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleGeneratePo}
                    className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-violet-50"
                  >
                    Generate new PO
                  </button>
                  {siblingJobs.length > 0 ? (
                    <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                      Link to job PO
                      <select
                        className="rounded-lg border border-border-light bg-white px-2 py-1.5 text-xs font-semibold text-text-primary"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) handleLinkPo(e.target.value);
                          e.target.value = "";
                        }}
                      >
                        <option value="">Select…</option>
                        {siblingJobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.name || j.style_number} {j.po_number ? `(${j.po_number})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Style-color code
                  <input
                    className={fieldClass}
                    value={draft.barcode ?? ""}
                    placeholder={styleColorPreview || "GGT148-BLK"}
                    onChange={(e) => patch({ barcode: e.target.value.toUpperCase() })}
                  />
                </label>
                <p className="mt-1 text-[11px] text-text-secondary">
                  Full SKU base: style # + color code. This is not the 6-digit barcode scan ID on stickers.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateBarcode}
                  className="mt-2 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-violet-50"
                >
                  Apply from colorway ({styleColorPreview || "set color first"})
                </button>
              </div>

              {draft.scope_kind === "addon" ? (
                <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-950">Add-on scope</p>
                  <div className="mt-3 space-y-3">
                    <label className={labelClass}>
                      Add-on category
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
                        className={fieldClass}
                        rows={2}
                        value={draft.addon_custom_note ?? ""}
                        onChange={(e) => patch({ addon_custom_note: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-border-light bg-surface-body/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Vendor & garment</p>
                <div className="mt-3 space-y-3">
                  <VendorFieldSelect
                    label="Lead vendor"
                    vendors={vendors}
                    value={draft.lead_vendor}
                    onChange={(name) => patch({ lead_vendor: name ?? "" })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={labelClass}>
                      Garment brand
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
              </div>

              <div className="space-y-3 border-t border-border-light pt-4">
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">Job timeline</h4>
                  <p className="mt-1 text-xs text-text-secondary">
                    Tap a step to jump to its fields; durations are editable.
                  </p>
                </div>
                <WipTimeline
                  steps={draft.timeline}
                  editableDurations
                  onDurationChange={handleJobDurationChange}
                  onStepClick={handleTimelineStepClick}
                />
              </div>

              <JobTimelineStepsEditor
                jobLabel={jobTimelineEditorLabel(draft)}
                steps={draft.timeline}
                onChange={(timeline) => patch({ timeline })}
              />
            </SectionCard>

            <SectionCard
              id="job-section-labels"
              title="Labels & barcodes"
              highlight={highlightId === "job-section-labels"}
            >
              <JobLabelsSection draft={draft} allJobs={allJobs} onPatch={patch} />
            </SectionCard>

            {ACCORDION_SECTIONS.map((section) => (
              <AccordionSection
                key={section}
                id={`job-section-${section}`}
                title={SECTION_LABELS[section]}
                open={expanded[section]}
                highlight={highlightId === `job-section-${section}`}
                onToggle={() => setExpanded((prev) => ({ ...prev, [section]: !prev[section] }))}
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
                            className={fieldClass}
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
                          C&S tech pack request
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(techPack.cs_tech_pack_request_date)}
                            onChange={(e) =>
                              patchTechPack({ cs_tech_pack_request_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          C&S tech pack due
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(techPack.cs_tech_pack_due_date)}
                            onChange={(e) =>
                              patchTechPack({ cs_tech_pack_due_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Artwork tech pack request
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(techPack.artwork_tech_pack_request_date)}
                            onChange={(e) =>
                              patchTechPack({ artwork_tech_pack_request_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Artwork tech pack due
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(techPack.artwork_tech_pack_due_date)}
                            onChange={(e) =>
                              patchTechPack({ artwork_tech_pack_due_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock
                      stepId="blanks_lab_dip"
                      highlight={highlightId === "job-step-blanks_lab_dip"}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Blanks purchased / PG requested
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          Blanks purchased
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(costing.blanks_purchased_date)}
                            onChange={(e) =>
                              patchCosting({ blanks_purchased_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          PG requested
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(costing.pg_requested_date)}
                            onChange={(e) =>
                              patchCosting({ pg_requested_date: dateInputToIso(e.target.value) })
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
                                    patchCosting({
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
                                patchCosting({
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
                                    patchCosting({
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
                                    patchCosting({
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
                                    patchCosting({
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
                                  patchCosting({
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
                            patchCosting({ dye_costing_tracks: [...dyeTracks, defaultDyeCostingTrack()] })
                          }
                          className="w-full rounded-xl border border-dashed border-accent/45 py-2.5 text-sm font-semibold text-accent hover:bg-violet-50/90"
                        >
                          + Add dye line
                        </button>
                      </div>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="order_trims" highlight={highlightId === "job-step-order_trims"}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Trims & appliques ordered
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          New product request
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(primaryBulk.new_product_request_date)}
                            onChange={(e) =>
                              updateBulkTracks(
                                updateBulkTrack(bulkTracks, primaryBulk.id, {
                                  new_product_request_date: dateInputToIso(e.target.value),
                                }),
                              )
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Barcodes sent to vendor
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(primaryBulk.barcodes_sent_to_vendor_date)}
                            onChange={(e) =>
                              updateBulkTracks(
                                updateBulkTrack(bulkTracks, primaryBulk.id, {
                                  barcodes_sent_to_vendor_date: dateInputToIso(e.target.value),
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
                      </div>
                    </WipStepFieldBlock>
                  </>
                ) : null}

                {section === "costing" ? (
                  <>
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
                          onChange={(e) =>
                            patchCosting({ costing_approved: e.target.checked ? true : false })
                          }
                        />
                        Deposit / payment received (costing approved)
                      </label>
                    </WipStepFieldBlock>

                    <WipStepFieldBlock stepId="tp_completion" highlight={highlightId === "job-step-tp_completion"}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={labelClass}>
                          C&S tech pack complete
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(techPack.cs_tech_pack_complete_date)}
                            onChange={(e) =>
                              patchTechPack({ cs_tech_pack_complete_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                        <label className={labelClass}>
                          Artwork tech pack complete
                          <input
                            type="date"
                            className={fieldClass}
                            value={isoToDateInput(techPack.artwork_tech_pack_complete_date)}
                            onChange={(e) =>
                              patchTechPack({ artwork_tech_pack_complete_date: dateInputToIso(e.target.value) })
                            }
                          />
                        </label>
                      </div>
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
                                      className={fieldClass}
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
                    <WipStepFieldBlock stepId="trimming" highlight={highlightId === "job-step-trimming"}>
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
              </AccordionSection>
            ))}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border-light px-5 py-4">
            <button
              type="button"
              onClick={onClose}
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
      </div>
    </div>
  );
}
