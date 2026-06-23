"use client";

import type { Contact } from "@/lib/types/contact";
import type { JobType, ProjectJob } from "@/lib/types/wip";
import { VendorFieldSelect } from "@/components/vendor-select";
import { CATEGORY_CODES, JOB_TYPE_OPTIONS } from "@/lib/reference/category-codes";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-text-secondary";

export function JobOverviewFields({
  draft,
  patch,
  vendors,
  categoryDropdown,
  onCategoryChange,
  onJobTypeChange,
  isPrimaryJob,
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
  onJobTypeChange: (jobType: JobType) => void;
  isPrimaryJob: boolean;
  fieldClass: string;
  textareaClass: string;
  showLeadTimesLink?: boolean;
  onApplyTimelineTemplate?: () => void;
}) {
  function patchStyleName(value: string) {
    patch({ name: value, style_name: value });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          Job type
          <select
            className={fieldClass}
            value={draft.job_type ?? "print_production"}
            onChange={(e) => onJobTypeChange(e.target.value as JobType)}
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
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            {CATEGORY_CODES.map((c) => (
              <option key={c.code} value={c.dropdownLabel}>
                {c.dropdownLabel}
              </option>
            ))}
          </select>
        </label>
        {!isPrimaryJob ? (
          <div className="flex flex-col justify-end">
            <VendorFieldSelect
              label="Supplier"
              vendors={vendors}
              value={draft.lead_vendor}
              onChange={(name) => patch({ lead_vendor: name ?? "" })}
            />
          </div>
        ) : (
          <div />
        )}
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
