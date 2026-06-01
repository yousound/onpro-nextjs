"use client";

import Image from "next/image";
import { useMemo } from "react";
import type { LabelStationSheet, ProjectJob } from "@/lib/types/wip";
import {
  MOBILE_STATION_SIZES,
  normalizeLabelStation,
  totalUnitsFromStation,
} from "@/lib/label-station";
import {
  downloadMobileStationPdf,
  printMobileStationSheet,
} from "@/lib/label-station-print";

const LABEL_LOGO_SRC = "/cd-label-logo.png";

const sheetFont = "font-['Arial_Black','Helvetica_Neue',Helvetica,Arial,sans-serif]";

const underlineInput =
  "w-full min-w-0 border-0 border-b-[3px] border-black bg-transparent px-1 pb-1 text-xl font-black uppercase tracking-tight text-black outline-none focus:border-violet-600 sm:text-2xl";

const qtyInput =
  "h-full w-full border-0 bg-transparent p-0 text-center text-3xl font-black tabular-nums text-black outline-none focus:ring-2 focus:ring-violet-500/40 sm:text-4xl";

type Props = {
  draft: ProjectJob;
  sheet: LabelStationSheet;
  onChange: (sheet: LabelStationSheet) => void;
};

function ConnectDotsLogo() {
  return (
    <div className="relative h-[7.5rem] w-[8.5rem] shrink-0 sm:h-[8.75rem] sm:w-[10rem]" aria-hidden>
      <Image
        src={LABEL_LOGO_SRC}
        alt=""
        fill
        className="object-contain object-left"
        sizes="160px"
        priority
      />
    </div>
  );
}

function UnderlineField({
  label,
  value,
  editable,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  editable: boolean;
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`flex min-h-[2.75rem] items-end gap-3 ${className}`}>
      <span
        className={`shrink-0 pb-1 text-lg font-black uppercase tracking-wide text-black sm:text-xl ${sheetFont}`}
      >
        {label}
      </span>
      {editable && onChange ? (
        <input
          className={underlineInput}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
      ) : (
        <span className={`flex-1 border-b-[3px] border-black pb-1 text-xl font-black text-black sm:text-2xl ${sheetFont}`}>
          {value || "\u00a0"}
        </span>
      )}
    </div>
  );
}

function StationSheetPreview({
  sheet,
  editable,
  onPatch,
}: {
  sheet: LabelStationSheet;
  editable: boolean;
  onPatch: (partial: Partial<LabelStationSheet>) => void;
}) {
  const computedTotal = totalUnitsFromStation(sheet);

  function patchQty(key: string, value: string) {
    onPatch({ size_qty: { ...sheet.size_qty, [key]: value.replace(/[^\d]/g, "") } });
  }

  return (
    <div
      className={`mx-auto w-full max-w-4xl bg-white px-5 py-6 text-black shadow-md ring-1 ring-black/10 sm:px-8 sm:py-8 ${sheetFont}`}
    >
      <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <ConnectDotsLogo />
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-3.5">
          <UnderlineField
            label="BRAND"
            value={sheet.brand}
            editable={editable}
            onChange={(v) => onPatch({ brand: v })}
          />
          <UnderlineField
            label="STYLE"
            value={sheet.style}
            editable={editable}
            onChange={(v) => onPatch({ style: v })}
          />
          <UnderlineField
            label="COLOR"
            value={sheet.color}
            editable={editable}
            onChange={(v) => onPatch({ color: v })}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 sm:mt-8 sm:grid-cols-8 sm:gap-2.5">
        {MOBILE_STATION_SIZES.map(({ key, display }) => (
          <div key={key} className="text-center">
            <div className="text-base font-black uppercase tracking-wide text-black sm:text-lg">{display}</div>
            <div className="mt-1 flex min-h-[4.5rem] items-center justify-center border-[3px] border-black sm:min-h-[5.25rem]">
              {editable ? (
                <input
                  className={qtyInput}
                  inputMode="numeric"
                  placeholder=""
                  value={sheet.size_qty[key] ?? ""}
                  onChange={(e) => patchQty(key, e.target.value)}
                  aria-label={`${display} quantity`}
                />
              ) : (
                <span className="text-3xl font-black tabular-nums sm:text-4xl">
                  {sheet.size_qty[key] || "\u00a0"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:mt-8 sm:grid-cols-2 sm:gap-8">
        <UnderlineField
          label="PO#"
          value={sheet.po_number}
          editable={editable}
          onChange={(v) => onPatch({ po_number: v })}
        />
        <div>
          <UnderlineField
            label="TOTAL UNITS"
            value={sheet.total_units}
            placeholder={computedTotal > 0 ? String(computedTotal) : undefined}
            editable={editable}
            onChange={(v) => onPatch({ total_units: v.replace(/[^\d]/g, "") })}
            className="[&_input]:text-center [&_input]:placeholder:text-black/35"
          />
          {editable && !sheet.total_units.trim() && computedTotal > 0 ? (
            <p className="mt-1 text-[10px] font-semibold text-slate-500">
              From sizes: {computedTotal} (enter to override)
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8">
        <div className="flex min-h-[2.75rem] items-end gap-2 sm:gap-3">
          <span className={`shrink-0 pb-1 text-lg font-black uppercase sm:text-xl ${sheetFont}`}>BOX</span>
          {editable ? (
            <input
              className={`${underlineInput} max-w-[4.5rem] text-center`}
              value={sheet.box_number}
              onChange={(e) => onPatch({ box_number: e.target.value })}
              aria-label="Box number"
            />
          ) : (
            <span className={`max-w-[4.5rem] flex-1 border-b-[3px] border-black pb-1 text-center text-xl font-black sm:text-2xl`}>
              {sheet.box_number || "\u00a0"}
            </span>
          )}
          <span className={`shrink-0 pb-1 text-base font-black uppercase sm:text-lg ${sheetFont}`}>OF</span>
          {editable ? (
            <input
              className={`${underlineInput} max-w-[4.5rem] text-center`}
              value={sheet.box_total}
              onChange={(e) => onPatch({ box_total: e.target.value.replace(/[^\d]/g, "") })}
              aria-label="Box total"
            />
          ) : (
            <span className={`max-w-[4.5rem] flex-1 border-b-[3px] border-black pb-1 text-center text-xl font-black sm:text-2xl`}>
              {sheet.box_total || "\u00a0"}
            </span>
          )}
        </div>
        <UnderlineField
          label="WEIGHT"
          value={sheet.weight}
          editable={editable}
          onChange={(v) => onPatch({ weight: v })}
        />
      </div>
    </div>
  );
}

export function LabelMobileStationSheet({ draft, sheet, onChange }: Props) {
  const docTitle = `${draft.name || "Job"} — Connect Dots label`;

  function patch(partial: Partial<LabelStationSheet>) {
    onChange({ ...sheet, ...partial });
  }

  function syncFromJob() {
    onChange(normalizeLabelStation(sheet, draft));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-sm font-semibold text-text-primary">Mobile station label</p>
        <p className="mt-1 text-xs text-text-secondary">
          Matches your Connect Dots sheet — large type for warehouse use. Fill in app, then print or save as PDF.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={syncFromJob}
            className="rounded-lg border border-border-light bg-white px-3 py-2 text-xs font-semibold text-text-primary hover:bg-slate-50"
          >
            Sync from job
          </button>
          <button
            type="button"
            onClick={() => printMobileStationSheet(sheet, docTitle)}
            className="rounded-lg border border-accent/40 bg-white px-3 py-2 text-xs font-semibold text-accent hover:bg-violet-50"
          >
            Print sheet
          </button>
          <button
            type="button"
            onClick={() => downloadMobileStationPdf(sheet, docTitle)}
            className="rounded-lg border border-accent/40 bg-white px-3 py-2 text-xs font-semibold text-accent hover:bg-violet-50"
          >
            Download PDF
          </button>
        </div>
      </div>

      <StationSheetPreview sheet={sheet} editable onPatch={patch} />
    </div>
  );
}

export function useLabelStationSheet(draft: ProjectJob): LabelStationSheet {
  return useMemo(() => normalizeLabelStation(draft.label_station, draft), [draft]);
}
