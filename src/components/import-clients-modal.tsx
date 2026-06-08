"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readCsvFileAsText } from "@/lib/csv/read-csv-file";
import { IMPORT_ROW_LIMIT } from "@/lib/csv/import-limits";
import {
  chunkRowRange,
  planCsvImportChunks,
} from "@/lib/csv/split-csv-import-chunks";
import {
  buildImportPreviews,
  patchImportPreview,
  previewToContact,
  validateImportCodeForContact,
  type ImportContactRowPreview,
} from "@/lib/csv/import-client-rows";
import type { ParsedImportContactRow } from "@/lib/types/contact-import";
import { segmentLabel } from "@/lib/mock/people";
import type { PeopleSegment } from "@/lib/mock/people";
import { commitSingleContact } from "@/lib/data/commit-contacts";
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
  upload: "One .csv can mix labeled and unlabeled rows — you assign type on Review when needed.",
  review: "Scroll the list, edit fields, and mark Team / Client / Vendor for unlabeled rows.",
};

const SEGMENT_OPTIONS: PeopleSegment[] = ["client", "vendor", "team"];
const SAMPLE_CSV_URL = "/samples/people-import-test.csv";

const reviewFieldClass = `${projectModalFieldClass} !mt-1 !h-9 !py-1.5 text-sm`;
const reviewLabelClass = `${projectModalLabelClass} !text-[10px]`;

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

  const visibleSections = useMemo(() => {
    if (previews.length === 0) {
      return IMPORT_SECTIONS.filter((s) => s.id !== "review");
    }
    return IMPORT_SECTIONS;
  }, [previews.length]);

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
      setFileName(null);
      setError(null);
      setParseMeta(null);
      setPreviews([]);
      setChunkPlan(null);
      setBatchNotice(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  useEffect(() => {
    if (!visibleSections.some((s) => s.id === activeSection)) {
      setActiveSection("upload");
    }
  }, [visibleSections, activeSection]);

  const selectedReady = previews.filter((p) => p.selected && p.status === "ready");
  const readyCount = previews.filter((p) => p.status === "ready").length;
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

  async function analyzeCsvText(
    csvText: string,
    label: string,
    plan?: { chunks: string[]; chunkIndex: number; totalDataRows: number; fileName: string },
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

  function startImportSession(csvText: string, name: string) {
    const plan = planCsvImportChunks(csvText);
    if (plan.totalDataRows === 0) {
      setError("No data rows found — add contacts below the header row.");
      return;
    }
    void analyzeCsvText(csvText, name, {
      chunks: plan.chunks,
      chunkIndex: 0,
      totalDataRows: plan.totalDataRows,
      fileName: name,
    });
  }

  async function analyzeFile(file: File) {
    try {
      const csvText = await readCsvFileAsText(file);
      startImportSession(csvText, file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read CSV");
      setAnalyzing(false);
    }
  }

  async function loadSampleCsv() {
    try {
      const res = await fetch(SAMPLE_CSV_URL);
      if (!res.ok) throw new Error("Sample file not found");
      const csvText = await res.text();
      startImportSession(csvText, "people-import-test.csv");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sample CSV");
      setAnalyzing(false);
    }
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
      prev.map((p) => (p.rowKey === rowKey && p.status === "ready" ? { ...p, selected: !p.selected } : p)),
    );
  }

  function toggleAllReady(checked: boolean) {
    setPreviews((prev) =>
      prev.map((p) => (p.status === "ready" ? { ...p, selected: checked } : p)),
    );
  }

  async function handleImport() {
    if (selectedReady.length === 0) return;
    setImporting(true);
    setError(null);
    const working = [...loadContacts()];
    let saved = 0;
    const failures: string[] = [];

    try {
      for (const row of selectedReady) {
        const contact = previewToContact(row);
        const codeErr = validateImportCodeForContact(working, contact);
        if (codeErr) {
          failures.push(`${row.name}: ${codeErr}`);
          continue;
        }
        try {
          const persisted = await commitSingleContact(contact);
          working.push(persisted);
          saved++;
        } catch (e) {
          failures.push(
            `${row.name}: ${e instanceof Error ? e.message : "Save failed"}`,
          );
        }
      }

      if (saved === 0) {
        setError(failures[0] ?? "No contacts were imported.");
        return;
      }

      onImported();
      window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
      if (isClientLiveBackend()) router.refresh();

      const hasMoreBatches =
        chunkPlan != null && chunkPlan.chunkIndex + 1 < chunkPlan.chunks.length;

      if (hasMoreBatches) {
        const nextIndex = chunkPlan.chunkIndex + 1;
        const batchNum = chunkPlan.chunkIndex + 1;
        const totalBatches = chunkPlan.chunks.length;
        setBatchNotice(
          `Batch ${batchNum} of ${totalBatches} imported (${saved} contact${saved === 1 ? "" : "s"}). Review batch ${nextIndex + 1} next.`,
        );
        setPreviews([]);
        setParseMeta(null);
        setActiveSection("review");
        await analyzeCsvText(chunkPlan.chunks[nextIndex]!, chunkPlan.fileName, {
          chunks: chunkPlan.chunks,
          chunkIndex: nextIndex,
          totalDataRows: chunkPlan.totalDataRows,
          fileName: chunkPlan.fileName,
        });
        if (failures.length > 0) {
          console.warn("[import-clients] partial failures in batch", failures);
        }
        return;
      }

      onClose();
      if (failures.length > 0) {
        console.warn("[import-clients] partial failures", failures);
      }
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
          body={`Large lists are split into batches of ${IMPORT_ROW_LIMIT} automatically. Review and import each batch in order — no need to split your CSV.`}
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
              {fileName && !analyzing ? (
                <p className="mt-3 text-xs text-slate-600">
                  Last file: <span className="font-medium">{fileName}</span>
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-left text-xs text-violet-950">
              <p className="font-semibold">Large lists</p>
              <p className="mt-1 text-violet-900/90">
                Upload one CSV — we split it into batches of {IMPORT_ROW_LIMIT} contacts. You
                review and import batch 1, then batch 2, and so on until the file is done.
              </p>
            </div>
            <ul className="list-inside list-disc space-y-1 text-xs text-slate-500">
              <li>Include name, email, and a Type/Segment column when you have one.</li>
              <li>Unlabeled rows stay on Review until you pick Team, Client, or Vendor.</li>
              <li>
                Client codes must be unique — the master client list reserves codes like GG, VS, MC
                (edit Code on Review or use the sample file).
              </li>
              <li>Duplicate emails already in People are skipped on Review.</li>
            </ul>
          </div>

          <div hidden={activeSection !== "review"} className="space-y-4">
            {batchNotice ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-950">
                {batchNotice}
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

            {previews.length === 0 ? (
              <p className="text-sm text-slate-500">Upload a CSV first to see rows here.</p>
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
                        row.status === "ready"
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
                            disabled={row.status !== "ready"}
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
                            ) : null}
                            <label className={reviewLabelClass}>
                              Code
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
                            <label className={reviewLabelClass}>
                              Phone
                              <input
                                className={reviewFieldClass}
                                value={row.phone ?? ""}
                                onChange={(e) => patchRow(row.rowKey, { phone: e.target.value })}
                              />
                            </label>
                          </div>
                          {row.notes ? (
                            <p className="text-xs text-slate-500">
                              <span className="font-semibold text-slate-600">Notes:</span> {row.notes}
                            </p>
                          ) : null}
                          <p
                            className={`text-xs font-medium ${
                              row.status === "ready"
                                ? "text-emerald-700"
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
              : activeSection === "review"
                ? selectedReady.length === 0
                  ? "Import"
                  : isMultiBatch && !isLastBatch
                    ? `Import ${selectedReady.length} & next batch`
                    : isMultiBatch
                      ? `Import ${selectedReady.length} & finish`
                      : `Import ${selectedReady.length} contact${selectedReady.length === 1 ? "" : "s"}`
                : "Continue"
          }
          primaryIcon={importing || activeSection !== "review" ? undefined : <CheckMini />}
          primaryDisabled={
            analyzing ||
            importing ||
            (activeSection === "review"
              ? selectedReady.length === 0
              : previews.length === 0)
          }
        />
      </form>
    </ProjectModalOverlay>
  );
}
