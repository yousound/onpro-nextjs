"use client";

import { useMemo, useState } from "react";
import type { Contact } from "@/lib/types/contact";
import type { DecorationVariant, JobType, ProjectJob } from "@/lib/types/wip";
import { VendorFieldSelect } from "@/components/vendor-select";
import { DECORATION_VARIANT_OPTIONS, JOB_TYPE_OPTIONS } from "@/lib/reference/category-codes";
import { JobProductImageUpload } from "@/components/job-product-image-upload";
import {
  addWorkspaceCategory,
  deleteWorkspaceCategory,
  isBuiltinCategory,
  loadWorkspaceCategories,
  updateWorkspaceCategory,
} from "@/lib/workspace-categories";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-text-secondary";

const JOB_TYPE_SELECT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "print_production", label: "Print Production" },
  { value: "embroidery", label: "Embroidery" },
  ...JOB_TYPE_OPTIONS.filter(
    (o) => o.value !== "print_production" && o.value !== "decoration",
  ),
  { value: "decoration", label: "Decoration" },
];

function jobTypeSelectValue(job: ProjectJob): string {
  if (job.job_type === "decoration" && job.decoration_variant === "embroidery") {
    return "embroidery";
  }
  return job.job_type ?? "print_production";
}

export function jobTypePatchFromSelect(value: string): Partial<ProjectJob> {
  if (value === "embroidery") {
    return { job_type: "decoration", decoration_variant: "embroidery" };
  }
  if (value === "decoration") {
    return { job_type: "decoration" };
  }
  return {
    job_type: value as JobType,
    decoration_variant: null,
  };
}

export function shouldAutoOpenColorSizing(job: ProjectJob): boolean {
  return (
    job.job_type === "print_production" ||
    (job.job_type === "decoration" && job.decoration_variant === "embroidery")
  );
}

export function JobOverviewFields({
  draft,
  patch,
  vendors,
  categoryDropdown,
  onCategoryChange,
  onJobTypeChange,
  onDecorationVariantChange,
  fieldClass,
  textareaClass,
  showLeadTimesLink,
  onApplyTimelineTemplate,
}: {
  draft: ProjectJob;
  patch: (partial: Partial<ProjectJob>) => void;
  vendors: Contact[];
  categoryDropdown: string;
  onCategoryChange: (label: string) => void;
  onJobTypeChange: (partial: Partial<ProjectJob>) => void;
  onDecorationVariantChange?: (variant: DecorationVariant | null) => void;
  fieldClass: string;
  textareaClass: string;
  showLeadTimesLink?: boolean;
  onApplyTimelineTemplate?: () => void;
}) {
  const [categoryTick, setCategoryTick] = useState(0);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  const categoryList = useMemo(
    () => loadWorkspaceCategories(),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh after CRUD
    [categoryTick],
  );

  function patchStyleName(value: string) {
    patch({ name: value, style_name: value });
  }

  function refreshCategories() {
    setCategoryTick((n) => n + 1);
  }

  function handleAddCategory() {
    const entry = addWorkspaceCategory(newCategoryName);
    if (entry) {
      onCategoryChange(entry.dropdownLabel);
      setNewCategoryName("");
      setAddingCategory(false);
      refreshCategories();
    }
  }

  function handleSaveCategoryEdit() {
    if (!editingCategory) return;
    const entry = updateWorkspaceCategory(editingCategory, editCategoryName);
    if (entry) {
      onCategoryChange(entry.dropdownLabel);
      setEditingCategory(null);
      refreshCategories();
    }
  }

  function handleDeleteCategory() {
    if (!editingCategory || isBuiltinCategory(editingCategory)) return;
    deleteWorkspaceCategory(editingCategory);
    onCategoryChange(loadWorkspaceCategories()[0]?.dropdownLabel ?? "Tee");
    setEditingCategory(null);
    refreshCategories();
  }

  const showDecorationVariant =
    draft.job_type === "decoration" && jobTypeSelectValue(draft) !== "embroidery";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border-light bg-surface-body/30 px-4 py-3">
        <div className="min-w-0">
          <p className={labelClass}>Product image</p>
          <p className="mt-1 text-[11px] font-normal normal-case tracking-normal text-text-secondary">
            Sample, mockup, or product reference for this job.
          </p>
        </div>
        <JobProductImageUpload
          image={draft.product_image}
          onChange={(image) => patch({ product_image: image })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          Job type
          <select
            className={fieldClass}
            value={jobTypeSelectValue(draft)}
            onChange={(e) => onJobTypeChange(jobTypePatchFromSelect(e.target.value))}
          >
            {JOB_TYPE_SELECT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelClass} ${showDecorationVariant ? "" : "invisible pointer-events-none"}`}>
          Job variant
          <select
            className={fieldClass}
            value={draft.decoration_variant ?? ""}
            disabled={!showDecorationVariant}
            onChange={(e) =>
              onDecorationVariantChange?.(
                (e.target.value || null) as DecorationVariant | null,
              )
            }
          >
            <option value="">Select variant…</option>
            {DECORATION_VARIANT_OPTIONS.filter((o) => o.value !== "embroidery").map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-1">
          <label className={labelClass}>
            Category
            <select
              className={fieldClass}
              value={categoryDropdown}
              onChange={(e) => {
                if (e.target.value === "__add__") {
                  setAddingCategory(true);
                  return;
                }
                if (e.target.value === "__edit__") {
                  setEditingCategory(categoryDropdown);
                  setEditCategoryName(categoryDropdown);
                  return;
                }
                onCategoryChange(e.target.value);
              }}
            >
              {categoryList.map((c) => (
                <option key={c.code + c.dropdownLabel} value={c.dropdownLabel}>
                  {c.dropdownLabel}
                </option>
              ))}
              <option value="__add__">+ Add category…</option>
              {!isBuiltinCategory(categoryDropdown) ? (
                <option value="__edit__">Edit / delete…</option>
              ) : null}
            </select>
          </label>
          {addingCategory ? (
            <div className="flex gap-1">
              <input
                className={`${fieldClass} min-w-0 flex-1`}
                value={newCategoryName}
                placeholder="New category"
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg bg-accent px-2 text-xs font-semibold text-white"
                onClick={handleAddCategory}
              >
                Add
              </button>
            </div>
          ) : null}
          {editingCategory ? (
            <div className="flex flex-wrap gap-1">
              <input
                className={`${fieldClass} min-w-0 flex-1`}
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
              />
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 text-xs font-semibold"
                onClick={handleSaveCategoryEdit}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-200 px-2 text-xs font-semibold text-red-700"
                onClick={handleDeleteCategory}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Brand
          <input
            className={fieldClass}
            value={draft.garment_brand ?? ""}
            placeholder="Manufacturer or brand"
            onChange={(e) => patch({ garment_brand: e.target.value })}
          />
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

      {showLeadTimesLink && onApplyTimelineTemplate ? (
        <button
          type="button"
          onClick={onApplyTimelineTemplate}
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Lead times — apply template for this job type
        </button>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Style number
          <input
            className={fieldClass}
            value={draft.style_number ?? ""}
            placeholder="e.g. GGT01"
            onChange={(e) => patch({ style_number: e.target.value.toUpperCase() })}
          />
        </label>
        <label className={labelClass}>
          Style name
          <input
            className={fieldClass}
            value={draft.name}
            placeholder="Product or style name"
            onChange={(e) => patchStyleName(e.target.value)}
          />
        </label>
      </div>

      <label className={labelClass}>
        Item description
        <textarea
          className={textareaClass}
          rows={2}
          value={draft.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="What we are making — decoration, materials, notes for the client quote"
        />
      </label>
    </div>
  );
}
