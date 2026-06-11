"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCompanyFilterText } from "@/lib/csv/filter-import-by-companies";
import {
  clearImportCsvSession,
  loadImportCsvSession,
  saveImportCsvSession,
  updateImportCsvCompanyFilter,
  type SavedImportCsvSession,
} from "@/lib/csv/import-csv-session";
import { importBatchHint, IMPORT_ROW_LIMIT } from "@/lib/csv/import-limits";
import { readCsvFileAsText } from "@/lib/csv/read-csv-file";
import { clientCodeByName, resolveClientCode } from "@/lib/reference/client-codes";
import {
  chunkRowRange,
  planCsvImportChunks,
} from "@/lib/csv/split-csv-import-chunks";
import {
  buildImportPreviews,
  patchImportPreview,
  type ImportContactRowPreview,
} from "@/lib/csv/import-client-rows";
import type { ContactLocation } from "@/lib/types/contact";
import type { ParsedImportContactRow } from "@/lib/types/contact-import";
import { segmentLabel } from "@/lib/mock/people";
import type { PeopleSegment } from "@/lib/mock/people";
import { commitImportRows } from "@/lib/csv/import-commit";
import { loadContacts } from "@/lib/contacts-store";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  ModalSectionLayout,
  ModalSectionNavList,
  type ModalSectionItem,
} from "@/components/modal-section-layout";
import {
  CheckMini,
  ProjectModalAside,
  ProjectModalBadge,
  ProjectModalOverlay,
  ProjectModalPanelFooter,
  ProjectModalPanelHeader,
  UserIcon,
  projectModalFieldClass,
  projectModalLabelClass,
} from "@/components/project-modal-ui";
import type { ParseContactsCsvResponse } from "@/lib/types/contact-import";

const IMPORT_SECTIONS: ModalSectionItem[] = [
  { id: "upload", label: "Upload CSV" },
  { id: "review", label: "Review" },
];

const SECTION_SUBTITLES: Record<string, string> = {
  upload: "Upload once, save your CSV, then pull only the companies you need — no re-uploading.",
  review: "Scroll the list, edit fields, and mark Team / Client / Vendor for unlabeled rows.",
};

const SEGMENT_OPTIONS: PeopleSegment[] = ["client", "vendor", "team"];
const SAMPLE_CSV_URL = "/samples/people-import-test.csv";

const reviewFieldClass = `${projectModalFieldClass} !mt-1 !h-9 !py-1.5 text-sm`;
const reviewLabelClass = `${projectModalLabelClass} !text-[10px]`;
const reviewTextareaClass = `${projectModalFieldClass} !mt-1 !h-auto min-h-[4.5rem] resize-y !py-2 text-sm`;

function patchImportLocation(
  locations: ContactLocation[] | undefined,
  index: number,
  patch: Partial<ContactLocation>,
): ContactLocation[] {
  const list = [...(locations ?? [])];
  list[index] = { ...list[index], ...patch };
  return list;
}

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function ImportClientsModal({ open, onClose, onImported }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseMeta, setParseMeta] = useState<ParseContactsCsvResponse | null>(null);
  const [previews, setPreviews] = useState<ImportContactRowPreview[]>([]);
  const [chunkPlan, setChunkPlan] = useState<{
    chunks: string[];
    chunkIndex: number;
    totalDataRows: number;
    fileName: string;
  } | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [savedSession, setSavedSession] = useState<SavedImportCsvSession | null>(null);
  const [companyFilter, setCompanyFilter] = useState("");

  const visibleSections = useMemo(() => {
    const showReview = analyzing || previews.length > 0 || parseMeta != null || Boolean(batchNotice);
    if (!showReview) {
      return IMPORT_SECTIONS.filter((s) => s.id !== "review");
    }
    return IMPORT_SECTIONS;
  }, [analyzing, previews.length, parseMeta, batchNotice]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !analyzing && !importing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, analyzing, importing]);

  useEffect(() => {
    if (!open) {
      setActiveSection("upload");
      setError(null);
      setParseMeta(null);
      setPreviews([]);
      setChunkPlan(null);
      setBatchNotice(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const session = loadImportCsvSession();
    if (session) {
      setSavedSession(session);
      setCompanyFilter(session.companyFilter);
      setFileName(session.fileName);
    }
  }, [open]);

  const companyFilterNames = useMemo(() => parseCompanyFilterText(companyFilter), [companyFilter]);

  useEffect(() => {
    if (!visibleSections.some((s) => s.id === activeSection)) {
      setActiveSection("upload");
    }
  }, [visibleSections, activeSection]);

  const isImportable = (p: ImportContactRowPreview) =>
    p.status === "ready" || p.status === "update";
  const selectedReady = previews.filter((p) => p.selected && isImportable(p));
  const readyCount = previews.filter((p) => isImportable(p)).length;
  const needsSegmentCount = previews.filter((p) => p.status === "needs_segment").length;

  const chunkCount = chunkPlan?.chunks.length ?? parseMeta?.chunkCount ?? 1;
  const chunkIndex = chunkPlan?.chunkIndex ?? parseMeta?.chunkIndex ?? 0;
  const totalRowsInFile = chunkPlan?.totalDataRows ?? parseMeta?.rowsInFile;
  const isMultiBatch = chunkCount > 1;
  const isLastBatch = !isMultiBatch || chunkIndex >= chunkCount - 1;
  const rowRange =
    totalRowsInFile != null && isMultiBatch
      ? chunkRowRange(chunkIndex, IMPORT_ROW_LIMIT, totalRowsInFile)
      : null;

  function persistCsvSession(csvText: string, name: string, filter = companyFilter) {
    const session = saveImportCsvSession({
      fileName: name,
      csvText,
      companyFilter: filter,
    });
    setSavedSession(session);
    setFileName(session.fileName);
    setCompanyFilter(session.companyFilter);
    setPreviews([]);
    setParseMeta(null);
    setChunkPlan(null);
    setBatchNotice(null);
    setActiveSection("upload");
  }

  async function analyzeCsvText(
    csvText: string,
    label: string,
    plan?: { chunks: string[]; chunkIndex: number; totalDataRows: number; fileName: string },
    filter?: string,
  ) {
    setError(null);
    setAnalyzing(true);
    setBatchNotice(null);
    const chunkIndex = plan?.chunkIndex ?? 0;
    const chunks = plan?.chunks ?? [csvText];
    const chunkCount = chunks.length;
    const totalRowsInFile = plan?.totalDataRows ?? 0;
    const chunkCsv = chunks[chunkIndex] ?? csvText;
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: chunkCsv,
          companyFilter: filter?.trim() || undefined,
          batch:
            chunkCount > 1
              ? {
                  chunkIndex,
                  chunkCount,
                  totalRowsInFile,
                }
              : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as ParseContactsCsvResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not analyze CSV");
      }
      const built = buildImportPreviews(data.rows ?? [], loadContacts());
      setPreviews(built);
      setParseMeta(data);
      setFileName(plan?.fileName ?? label);
      if (plan) {
        setChunkPlan({
          chunks: plan.chunks,
          chunkIndex: plan.chunkIndex,
          totalDataRows: plan.totalDataRows,
          fileName: plan.fileName,
        });
      }
      setActiveSection("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze CSV");
    } finally {
      setAnalyzing(false);
    }
  }

  function startImportSession(csvText: string, name: string, filter?: string) {
    const plan = planCsvImportChunks(csvText);
    if (plan.totalDataRows === 0) {
      setError("No data rows found — add contacts below the header row.");
      return;
    }
    saveImportCsvSession({ fileName: name, csvText, companyFilter: filter ?? companyFilter });
    void analyzeCsvText(
      csvText,
      name,
      {
        chunks: plan.chunks,
        chunkIndex: 0,
        totalDataRows: plan.totalDataRows,
        fileName: name,
      },
      filter ?? companyFilter,
    );
  }

  async function analyzeFile(file: File) {
    try {
      const csvText = await readCsvFileAsText(file);
      persistCsvSession(csvText, file.name);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read CSV");
    }
  }

  async function loadSampleCsv() {
    try {
      const res = await fetch(SAMPLE_CSV_URL);
      if (!res.ok) throw new Error("Sample file not found");
      const csvText = await res.text();
      persistCsvSession(csvText, "people-import-test.csv");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sample CSV");
    }
  }

  function runFilteredImport() {
    if (!savedSession) {
      setError("Upload a CSV first — we save it here so you can import in batches.");
      return;
    }
    setError(null);
    startImportSession(savedSession.csvText, savedSession.fileName, companyFilter);
  }

  function handleCompanyFilterChange(value: string) {
    setCompanyFilter(value);
    updateImportCsvCompanyFilter(value);
  }

  function handleClearSavedCsv() {
    clearImportCsvSession();
    setSavedSession(null);
    setFileName(null);
    setCompanyFilter("");
    setPreviews([]);
    setParseMeta(null);
    setChunkPlan(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function patchRow(rowKey: string, patch: Partial<ParsedImportContactRow>) {
    const contacts = loadContacts();
    setPreviews((prev) =>
      prev.map((p) => (p.rowKey === rowKey ? patchImportPreview(p, patch, contacts) : p)),
    );
  }

  function onFileChange(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    void analyzeFile(file);
  }

  function toggleRow(rowKey: string) {
    setPreviews((prev) =>
      prev.map((p) =>
        p.rowKey === rowKey && isImportable(p) ? { ...p, selected: !p.selected } : p,
      ),
    );
  }

  function toggleAllReady(checked: boolean) {
    setPreviews((prev) =>
      prev.map((p) => (isImportable(p) ? { ...p, selected: checked } : p)),
    );
  }

  async function handleImport() {
    if (selectedReady.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      const { saved, failures } = await commitImportRows(selectedReady, loadContacts());

      if (saved === 0) {
        setError(failures[0] ?? "No contacts were imported.");
        return;
      }

      onImported();
      window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
      if (isClientLiveBackend()) router.refresh();

      const hasMoreBatches =
        chunkPlan != null && chunkPlan.chunkIndex + 1 < chunkPlan.chunks.length;

      const failureNote =
        failures.length > 0
          ? `${failures.length} row${failures.length === 1 ? "" : "s"} could not be imported: ${failures.slice(0, 3).join(" · ")}${failures.length > 3 ? ` · +${failures.length - 3} more` : ""}`
          : null;

      if (hasMoreBatches) {
        const nextIndex = chunkPlan.chunkIndex + 1;
        const batchNum = chunkPlan.chunkIndex + 1;
        const totalBatches = chunkPlan.chunks.length;
        setBatchNotice(
          [
            `Batch ${batchNum} of ${totalBatches} imported (${saved} contact${saved === 1 ? "" : "s"}). Review batch ${nextIndex + 1} next.`,
            failureNote,
          ]
            .filter(Boolean)
            .join(" "),
        );
        await analyzeCsvText(
          chunkPlan.chunks[nextIndex]!,
          chunkPlan.fileName,
          {
            chunks: chunkPlan.chunks,
            chunkIndex: nextIndex,
            totalDataRows: chunkPlan.totalDataRows,
            fileName: chunkPlan.fileName,
          },
          companyFilter,
        );
        return;
      }

      if (failureNote) {
        setError(failureNote);
        return;
      }

      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <ProjectModalOverlay
      titleId="import-clients-title"
      onClose={onClose}
      overlayClassName="z-[225]"
      size="wide-tall"
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <UserIcon />
            </ProjectModalBadge>
          }
          title={
            <>
              Import People
              <br />
              from CSV.
            </>
          }
          body={`Upload your master CSV once. Name the companies you want, pull matches anytime, and edit client/vendor codes to match your catalog.`}
          nav={
            <ModalSectionNavList
              sections={visibleSections}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
              navLabel="Import steps"
              variant="polished"
              tone="aside"
            />
          }
        />
      }
    >
      <ProjectModalPanelHeader
        title="Import from CSV"
        subtitle={SECTION_SUBTITLES[activeSection] ?? "People directory import"}
        onClose={onClose}
      />

      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (activeSection === "review") void handleImport();
          else if (savedSession) runFilteredImport();
          else if (previews.length > 0) setActiveSection("review");
        }}
      >
        <ModalSectionLayout
          sections={visibleSections}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          navLabel="Import steps"
          variant="polished"
          sidebar="none"
        >
          <div hidden={activeSection !== "upload"} className="space-y-4">
            <div
              className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 px-6 py-10 text-center"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void analyzeFile(file);
              }}
            >
              <p className="text-sm font-semibold text-slate-900">Drop a .csv file here</p>
              <p className="mt-1 text-xs text-slate-500">
                Or choose a file — we send column data to AI when configured, with a header-based
                fallback.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => onFileChange(e.target.files)}
              />
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl bg-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                >
                  {analyzing ? "Analyzing…" : "Choose CSV file"}
                </button>
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => void loadSampleCsv()}
                  className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#6d28d9] hover:bg-violet-50 disabled:opacity-50"
                >
                  Load sample CSV
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                <a
                  href={SAMPLE_CSV_URL}
                  download
                  className="font-semibold text-[#7c3aed] hover:underline"
                >
                  Download test file
                </a>
                {" "}
                (12 rows: clients, vendors, team)
              </p>
            </div>

            {savedSession ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-left">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-emerald-950">Saved CSV</p>
                    <p className="mt-1 text-xs text-emerald-900">
                      <span className="font-medium">{savedSession.fileName}</span>
                      {" · "}
                      {importBatchHint(savedSession.totalDataRows)}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-800/80">
                      Stays on this device — change company names below and pull again without
                      re-uploading.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-700 hover:underline"
                    onClick={handleClearSavedCsv}
                  >
                    Clear saved file
                  </button>
                </div>
              </div>
            ) : null}

            <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className={reviewLabelClass}>
                Which companies should we pull from your CSV?
              </span>
              <textarea
                className={`${reviewTextareaClass} !min-h-[5.5rem]`}
                value={companyFilter}
                onChange={(e) => handleCompanyFilterChange(e.target.value)}
                placeholder={'Glo Gang, LNQ, Millworks Collective\n(one per line or comma-separated)'}
                disabled={!savedSession}
              />
              <p className="mt-2 text-xs text-slate-500">
                {savedSession
                  ? companyFilterNames.length > 0
                    ? `We'll search your saved CSV for ${companyFilterNames.join(", ")} and everyone at those companies.`
                    : "Leave blank to pull every row from your saved CSV."
                  : "Upload a CSV first, then list the company names you want to import."}
              </p>
            </label>

            <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-left text-xs text-violet-950">
              <p className="font-semibold">How it works</p>
              <p className="mt-1 text-violet-900/90">
                1. Upload your master list once. 2. Type company names above. 3. Pull matches and
                review — client/vendor codes auto-match your catalog (edit on Review if needed).
              </p>
            </div>
            <ul className="list-inside list-disc space-y-1 text-xs text-slate-500">
              <li>Include name, email, and a Type/Segment column when you have one.</li>
              <li>Unlabeled rows stay on Review until you pick Team, Client, or Vendor.</li>
              <li>
                Client and vendor codes are editable on Review — clients auto-suggest master-list
                codes like GG, LNQ, MC.
              </li>
              <li>Duplicate emails already in People are skipped on Review.</li>
              <li>
                Location columns (location 1, location 2, billing, shipping, etc.) import as unlimited
                sites — edit or add more on Review.
              </li>
            </ul>
          </div>

          <div hidden={activeSection !== "review"} className="space-y-4">
            {batchNotice ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-950">
                {batchNotice}
              </p>
            ) : null}
            {companyFilterNames.length > 0 ? (
              <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-medium text-violet-950">
                Pulled from saved CSV for: {companyFilterNames.join(", ")}
              </p>
            ) : savedSession ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                Showing all matches from saved file{" "}
                <span className="font-medium">{savedSession.fileName}</span>
              </p>
            ) : null}

            {parseMeta ? (
              <div className="space-y-2">
                {isMultiBatch && rowRange ? (
                  <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-medium text-violet-950">
                    Batch {chunkIndex + 1} of {chunkCount} · rows {rowRange.start}–{rowRange.end}{" "}
                    of {totalRowsInFile} in {fileName ?? "your file"}
                  </p>
                ) : null}
                {parseMeta.truncated && !isMultiBatch ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-950">
                    This file has {parseMeta.rowsInFile ?? "?"} rows — only the first{" "}
                    {parseMeta.rowLimit ?? IMPORT_ROW_LIMIT} are shown in this batch.
                  </p>
                ) : null}
                {parseMeta.aiInputTruncated ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Very large file — AI read the first portion only. Column mapping fallback may
                    apply to the full file if AI fails.
                  </p>
                ) : null}
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {parseMeta.summary}
                  <span className="ml-2 text-slate-400">
                    ({parseMeta.source === "openai" ? "AI parse" : "Column mapping"}
                    {parseMeta.rowsReturned != null && parseMeta.rowsInFile != null
                      ? ` · ${parseMeta.rowsReturned} of ${parseMeta.rowsInFile} rows`
                      : ""}
                    )
                  </span>
                </p>
              </div>
            ) : null}

            {analyzing ? (
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-violet-950">Scanning your CSV…</p>
                <p className="mt-1 text-xs text-violet-800">
                  Reading every column for contacts — this may take a moment on large files.
                </p>
              </div>
            ) : null}

            {previews.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                {parseMeta?.summary ? (
                  <>
                    <p className="font-semibold text-slate-900">Scan complete — no rows to review in this batch.</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{parseMeta.summary}</p>
                    {companyFilterNames.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Try a broader company name, leave the filter blank for all rows, or check the next batch if
                        your file is large.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p>Upload a CSV and click Pull to scan rows for review.</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    {readyCount} ready
                    {needsSegmentCount > 0 ? ` · ${needsSegmentCount} need type` : ""}
                    {previews.length - readyCount - needsSegmentCount > 0
                      ? ` · ${previews.length - readyCount - needsSegmentCount} skipped or errors`
                      : ""}
                  </span>
                  {readyCount > 0 ? (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-[#7c3aed]"
                        checked={selectedReady.length === readyCount}
                        onChange={(e) => toggleAllReady(e.target.checked)}
                      />
                      Select all ready
                    </label>
                  ) : null}
                </div>
                <ul
                  className="max-h-[min(520px,58vh)] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-3"
                  aria-label="Import review list"
                >
                  {previews.map((row, index) => (
                    <li
                      key={row.rowKey}
                      className={`rounded-xl border bg-white p-4 shadow-sm ${
                        row.status === "ready" || row.status === "update"
                          ? "border-slate-200"
                          : row.status === "needs_segment"
                            ? "border-violet-300 ring-1 ring-violet-200"
                            : row.status === "skip"
                              ? "border-amber-200"
                              : "border-red-200"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                          <span className="text-[10px] font-bold text-slate-400">
                            #
                            {chunkIndex * IMPORT_ROW_LIMIT + index + 1}
                          </span>
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-[#7c3aed] disabled:opacity-30"
                            checked={row.selected}
                            disabled={row.status !== "ready" && row.status !== "update"}
                            onChange={() => toggleRow(row.rowKey)}
                            aria-label={`Import ${row.name}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <label className={reviewLabelClass}>
                              Type
                              <select
                                className={`${reviewFieldClass} ${
                                  row.status === "needs_segment"
                                    ? "!border-violet-400 !bg-violet-50 font-semibold text-violet-900"
                                    : ""
                                }`}
                                value={row.segment ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  patchRow(row.rowKey, {
                                    segment: v ? (v as PeopleSegment) : null,
                                  });
                                }}
                              >
                                <option value="">Mark type…</option>
                                {SEGMENT_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {segmentLabel(s)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className={reviewLabelClass}>
                              Name
                              <input
                                className={reviewFieldClass}
                                value={row.name}
                                onChange={(e) => patchRow(row.rowKey, { name: e.target.value })}
                              />
                            </label>
                            <label className={reviewLabelClass}>
                              Email
                              <input
                                type="email"
                                className={reviewFieldClass}
                                value={row.email}
                                onChange={(e) => patchRow(row.rowKey, { email: e.target.value })}
                              />
                            </label>
                            {(row.segment === "client" || row.segment === "vendor") &&
                            row.kind === "company" ? (
                              <label className={reviewLabelClass}>
                                Contact name
                                <input
                                  className={reviewFieldClass}
                                  value={row.contact_name ?? ""}
                                  onChange={(e) =>
                                    patchRow(row.rowKey, { contact_name: e.target.value })
                                  }
                                />
                              </label>
                            ) : row.contact_name ? (
                              <label className={reviewLabelClass}>
                                Contact name
                                <input
                                  className={reviewFieldClass}
                                  value={row.contact_name ?? ""}
                                  onChange={(e) =>
                                    patchRow(row.rowKey, { contact_name: e.target.value })
                                  }
                                />
                              </label>
                            ) : null}
                            {(row.segment === "client" || row.segment === "vendor") ? (
                              <label className={reviewLabelClass}>
                                Company code
                                {row.segment === "client" && clientCodeByName(row.name) ? (
                                  <span className="ml-1 font-normal normal-case text-violet-700">
                                    · master list {resolveClientCode(row.name)}
                                  </span>
                                ) : null}
                                <input
                                  className={reviewFieldClass}
                                  value={row.company_code ?? ""}
                                  maxLength={3}
                                  onChange={(e) =>
                                    patchRow(row.rowKey, {
                                      company_code: e.target.value.toUpperCase(),
                                    })
                                  }
                                />
                              </label>
                            ) : null}
                            <label className={reviewLabelClass}>
                              Phone
                              <input
                                className={reviewFieldClass}
                                value={row.phone ?? ""}
                                onChange={(e) => patchRow(row.rowKey, { phone: e.target.value })}
                              />
                            </label>
                            {row.team_role ? (
                              <label className={reviewLabelClass}>
                                Team role
                                <input
                                  className={`${reviewFieldClass} bg-slate-50`}
                                  value={row.team_role}
                                  readOnly
                                />
                              </label>
                            ) : null}
                            {row.business_structure ? (
                              <label className={reviewLabelClass}>
                                Business structure
                                <input
                                  className={`${reviewFieldClass} bg-slate-50`}
                                  value={row.business_structure}
                                  readOnly
                                />
                              </label>
                            ) : null}
                            {row.other_emails?.length ? (
                              <label className={`${reviewLabelClass} sm:col-span-2`}>
                                Other emails
                                <input
                                  className={`${reviewFieldClass} bg-slate-50`}
                                  value={row.other_emails.join(", ")}
                                  readOnly
                                />
                              </label>
                            ) : null}
                            <label className={`${reviewLabelClass} sm:col-span-2 lg:col-span-3`}>
                              Notes
                              <textarea
                                className={reviewTextareaClass}
                                value={row.notes ?? ""}
                                placeholder="Notes from CSV or add your own"
                                onChange={(e) => patchRow(row.rowKey, { notes: e.target.value })}
                              />
                            </label>
                          </div>
                          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Locations
                                {(row.locations?.length ?? 0) > 0
                                  ? ` (${row.locations!.length})`
                                  : ""}
                              </p>
                              <button
                                type="button"
                                className="text-xs font-semibold text-[#7c3aed] hover:underline"
                                onClick={() =>
                                  patchRow(row.rowKey, {
                                    locations: [...(row.locations ?? []), { label: "" }],
                                  })
                                }
                              >
                                + Add location
                              </button>
                            </div>
                            {(row.locations?.length ?? 0) === 0 ? (
                              <p className="text-xs text-slate-500">
                                No locations yet — add warehouses, offices, billing, or shipping sites.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {row.locations!.map((loc, locIndex) => (
                                  <li
                                    key={`${row.rowKey}-loc-${locIndex}`}
                                    className="rounded-lg border border-slate-200 bg-white p-3"
                                  >
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                      <label className={`${reviewLabelClass} flex-1`}>
                                        Label
                                        <input
                                          className={reviewFieldClass}
                                          value={loc.label ?? ""}
                                          placeholder={`Location ${locIndex + 1}`}
                                          onChange={(e) =>
                                            patchRow(row.rowKey, {
                                              locations: patchImportLocation(row.locations, locIndex, {
                                                label: e.target.value,
                                              }),
                                            })
                                          }
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        className="mt-4 shrink-0 text-xs font-semibold text-red-600 hover:underline"
                                        onClick={() =>
                                          patchRow(row.rowKey, {
                                            locations: row.locations!.filter((_, i) => i !== locIndex),
                                          })
                                        }
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      <label className={`${reviewLabelClass} sm:col-span-2 lg:col-span-3`}>
                                        Street
                                        <input
                                          className={reviewFieldClass}
                                          value={loc.line1 ?? ""}
                                          onChange={(e) =>
                                            patchRow(row.rowKey, {
                                              locations: patchImportLocation(row.locations, locIndex, {
                                                line1: e.target.value,
                                              }),
                                            })
                                          }
                                        />
                                      </label>
                                      <label className={`${reviewLabelClass} sm:col-span-2 lg:col-span-3`}>
                                        Line 2
                                        <input
                                          className={reviewFieldClass}
                                          value={loc.line2 ?? ""}
                                          onChange={(e) =>
                                            patchRow(row.rowKey, {
                                              locations: patchImportLocation(row.locations, locIndex, {
                                                line2: e.target.value,
                                              }),
                                            })
                                          }
                                        />
                                      </label>
                                      <label className={reviewLabelClass}>
                                        City
                                        <input
                                          className={reviewFieldClass}
                                          value={loc.city ?? ""}
                                          onChange={(e) =>
                                            patchRow(row.rowKey, {
                                              locations: patchImportLocation(row.locations, locIndex, {
                                                city: e.target.value,
                                              }),
                                            })
                                          }
                                        />
                                      </label>
                                      <label className={reviewLabelClass}>
                                        State
                                        <input
                                          className={reviewFieldClass}
                                          value={loc.state ?? ""}
                                          onChange={(e) =>
                                            patchRow(row.rowKey, {
                                              locations: patchImportLocation(row.locations, locIndex, {
                                                state: e.target.value,
                                              }),
                                            })
                                          }
                                        />
                                      </label>
                                      <label className={reviewLabelClass}>
                                        Postal
                                        <input
                                          className={reviewFieldClass}
                                          value={loc.postal_code ?? ""}
                                          onChange={(e) =>
                                            patchRow(row.rowKey, {
                                              locations: patchImportLocation(row.locations, locIndex, {
                                                postal_code: e.target.value,
                                              }),
                                            })
                                          }
                                        />
                                      </label>
                                      <label className={reviewLabelClass}>
                                        Country
                                        <input
                                          className={reviewFieldClass}
                                          value={loc.country ?? ""}
                                          onChange={(e) =>
                                            patchRow(row.rowKey, {
                                              locations: patchImportLocation(row.locations, locIndex, {
                                                country: e.target.value,
                                              }),
                                            })
                                          }
                                        />
                                      </label>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <p
                            className={`text-xs font-medium ${
                              row.status === "ready" || row.status === "update"
                                ? row.status === "update"
                                  ? "text-sky-800"
                                  : "text-emerald-700"
                                : row.status === "needs_segment"
                                  ? "text-violet-800"
                                  : row.status === "skip"
                                    ? "text-amber-800"
                                    : "text-red-600"
                            }`}
                          >
                            {row.statusMessage ?? row.status}
                            {row.warnings?.length ? ` · ${row.warnings.join(" ")}` : ""}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        </ModalSectionLayout>

        <ProjectModalPanelFooter
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel={
            importing
              ? "Importing…"
              : analyzing
                ? "Finding matches…"
                : activeSection === "review"
                  ? selectedReady.length === 0
                    ? "Import"
                    : isMultiBatch && !isLastBatch
                      ? `Import ${selectedReady.length} & next batch`
                      : isMultiBatch
                        ? `Import ${selectedReady.length} & finish`
                        : `Import ${selectedReady.length} contact${selectedReady.length === 1 ? "" : "s"}`
                  : companyFilterNames.length > 0
                    ? `Find ${companyFilterNames.slice(0, 2).join(", ")}${companyFilterNames.length > 2 ? "…" : ""}`
                    : savedSession
                      ? "Pull all rows"
                      : "Upload CSV first"
          }
          primaryIcon={importing || analyzing || activeSection !== "review" ? undefined : <CheckMini />}
          primaryDisabled={
            analyzing ||
            importing ||
            (activeSection === "review"
              ? selectedReady.length === 0
              : !savedSession)
          }
        />
      </form>
    </ProjectModalOverlay>
  );
}
