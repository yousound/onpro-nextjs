"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import Link from "next/link";
import { NewDocumentModal, type DocumentDraft } from "@/components/new-document-modal";
import type { DocumentKind, DocumentRow, DocumentUploadFile } from "@/lib/types/documents";
import { clientInitials, formatFileSize, formatShortDate } from "@/lib/format";
import { MOCK_LS } from "@/lib/mock-local";
import {
  deleteExtraDocumentsByIds,
  listOrphanedWorkspaceDocuments,
} from "@/lib/documents/delete-documents";
import { loadExtraDocuments, persistExtraDocuments } from "@/lib/documents/document-storage";
import { DOCUMENTS_CHANGED_EVENT, PROJECT_DELETED_EVENT, dispatchDocumentsChanged } from "@/lib/onpro-events";
import type { AttachmentComposerDraft } from "@/lib/attachment-composer-draft";
import { draftFromDocumentRow } from "@/lib/attachment-composer-draft";
import {
  isImageDocument,
  normalizeDocumentRow,
  opensInAttachmentComposer,
  projectRowHref,
} from "@/lib/documents/document-preview";
import { DocumentPreviewModal } from "@/components/document-preview-modal";
import { DocumentThumb } from "@/components/document-thumb";
import { MessageAttachmentComposer } from "@/components/message-attachment-composer";

type SortKey = "updated" | "name" | "uploaded_by";
type SortDir = "asc" | "desc";
type DocumentFilter = DocumentKind | "ALL";

/** Matches `DocumentsListView` type pill order (subset maps to web `DocumentKind`). */
const DOCUMENT_KIND_ORDER: DocumentKind[] = ["invoice", "quote", "tech_pack", "image", "other"];

function kindRank(kind: DocumentKind): number {
  const i = DOCUMENT_KIND_ORDER.indexOf(kind);
  return i === -1 ? 99 : i;
}

function kindLabel(k: DocumentKind): string {
  switch (k) {
    case "invoice":
      return "Invoice";
    case "quote":
      return "Quote";
    case "tech_pack":
      return "Tech pack";
    case "image":
      return "Images";
    default:
      return "Other";
  }
}

function FileGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function projectKeyFromDoc(d: DocumentRow): string {
  return d.project_id == null ? "unassigned" : `p:${d.project_id}`;
}

function stopRowNavigate(e: MouseEvent) {
  e.stopPropagation();
}

function DocumentProjectLink({ doc }: { doc: DocumentRow }) {
  const href = projectRowHref(doc);
  if (!href || !doc.project_name) {
    return <span className="text-text-secondary">—</span>;
  }
  return (
    <Link
      href={href}
      onClick={stopRowNavigate}
      className="font-semibold text-accent hover:underline"
    >
      {doc.project_name}
    </Link>
  );
}

function docSourceLabel(d: DocumentRow): string | null {
  if (d.source_ref?.startsWith("mailroom:")) return "Mailroom";
  if (d.external_url) return "Link";
  if (d.file_name || d.file_data_url || d.blob_ref) return "Upload";
  return null;
}

function aggregateProjectFolders(docs: DocumentRow[]) {
  const map = new Map<string, { label: string; count: number; bytes: number }>();
  for (const d of docs) {
    const key = projectKeyFromDoc(d);
    const label = d.project_name ?? "Unassigned";
    const cur = map.get(key);
    if (cur) {
      cur.count += 1;
      cur.bytes += d.size_bytes;
    } else {
      map.set(key, { label, count: 1, bytes: d.size_bytes });
    }
  }
  const rows = [...map.entries()].map(([key, v]) => ({ key, ...v }));
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

function cmp(a: string, b: string, dir: SortDir): number {
  const n = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? n : -n;
}

function cmpTime(a: string, b: string, dir: SortDir): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  const n = ta - tb;
  return dir === "asc" ? n : -n;
}

function projectChoices(seed: DocumentRow[]): { id: number; name: string }[] {
  const m = new Map<number, string>();
  for (const d of seed) {
    if (d.project_id != null && d.project_name) m.set(d.project_id, d.project_name);
  }
  return [...m.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type DocumentsProjectScope = {
  projectId: number;
  projectName: string;
};

export function DocumentsView({
  documents: seedDocuments,
  openNewSignal = 0,
  onDocumentsChange,
  projectScope,
}: {
  documents: DocumentRow[];
  openNewSignal?: number;
  onDocumentsChange?: (extraCount: number) => void;
  /** When set, shows the workspace documents UI scoped to one project only. */
  projectScope?: DocumentsProjectScope;
}) {
  const [extraDocs, setExtraDocs] = useState<DocumentRow[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<DocumentKind>("other");
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [newUploader, setNewUploader] = useState("Jerry M");
  const [newExternalUrl, setNewExternalUrl] = useState("");
  const [newFile, setNewFile] = useState<DocumentUploadFile | null>(null);

  const reloadExtras = useCallback(() => {
    void loadExtraDocuments().then(setExtraDocs);
  }, []);

  useEffect(() => {
    reloadExtras();
  }, [reloadExtras]);

  useEffect(() => {
    const onChanged = () => reloadExtras();
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, onChanged);
    window.addEventListener(PROJECT_DELETED_EVENT, onChanged);
    return () => {
      window.removeEventListener(DOCUMENTS_CHANGED_EVENT, onChanged);
      window.removeEventListener(PROJECT_DELETED_EVENT, onChanged);
    };
  }, [reloadExtras]);

  useEffect(() => {
    if (openNewSignal > 0) setNewOpen(true);
  }, [openNewSignal]);

  useEffect(() => {
    onDocumentsChange?.(extraDocs.length);
  }, [extraDocs.length, onDocumentsChange]);

  const allDocuments = useMemo(
    () => [...seedDocuments, ...extraDocs].map(normalizeDocumentRow),
    [seedDocuments, extraDocs],
  );

  useEffect(() => {
    if (projectScope) {
      setProjectKey(`p:${projectScope.projectId}`);
      setNewProjectId(String(projectScope.projectId));
    }
  }, [projectScope?.projectId]);

  const projects = useMemo(() => {
    if (projectScope) return [{ id: projectScope.projectId, name: projectScope.projectName }];
    return projectChoices(seedDocuments);
  }, [seedDocuments, projectScope]);

  const patchNewDraft = useCallback((patch: Partial<DocumentDraft>) => {
    if (patch.name !== undefined) setNewName(patch.name);
    if (patch.kind !== undefined) setNewKind(patch.kind);
    if (patch.projectId !== undefined) setNewProjectId(patch.projectId);
    if (patch.uploader !== undefined) setNewUploader(patch.uploader);
    if (patch.externalUrl !== undefined) setNewExternalUrl(patch.externalUrl);
    if (patch.file !== undefined) setNewFile(patch.file);
  }, []);

  const newDraft = useMemo<DocumentDraft>(
    () => ({
      name: newName,
      kind: newKind,
      projectId: newProjectId,
      uploader: newUploader,
      externalUrl: newExternalUrl,
      file: newFile,
    }),
    [newName, newKind, newProjectId, newUploader, newExternalUrl, newFile],
  );

  async function persistExtras(next: DocumentRow[]) {
    const previous = await loadExtraDocuments().catch(() => [] as DocumentRow[]);
    const ok = await persistExtraDocuments(next);
    if (!ok) {
      window.alert(
        "Could not save — browser storage is full. Remove old documents or clear site data for this app, then try again.",
      );
      setExtraDocs(previous);
      return;
    }
    const loaded = await loadExtraDocuments();
    setExtraDocs(loaded);
    dispatchDocumentsChanged();
  }

  function resetNewDocForm() {
    setNewName("");
    setNewExternalUrl("");
    setNewFile(null);
  }

  async function handleNewDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    const externalUrl = newExternalUrl.trim();
    if (!name || (!newFile && !externalUrl)) return;
    const pid =
      projectScope != null
        ? projectScope.projectId
        : newProjectId === ""
          ? null
          : Number(newProjectId);
    const choice = projects.find((c) => c.id === pid);
    const row = normalizeDocumentRow({
      id: Math.max(0, ...allDocuments.map((d) => d.id)) + 1,
      name,
      project_id: pid,
      project_name: pid == null ? null : choice?.name ?? projectScope?.projectName ?? null,
      kind: newFile?.data_url?.startsWith("data:image/") ? "image" : newKind,
      size_bytes: newFile?.size_bytes ?? 512_000,
      uploaded_by: newUploader.trim() || "Connect Dots Ops",
      updated_at: new Date().toISOString(),
      file_name: newFile?.name ?? null,
      file_data_url: newFile?.data_url ?? null,
      external_url: externalUrl || null,
    });
    await persistExtras([...extraDocs, row]);
    setNewOpen(false);
    resetNewDocForm();
  }

  const scopedProjectKey = projectScope ? `p:${projectScope.projectId}` : "ALL";
  const [projectKey, setProjectKey] = useState<string>(scopedProjectKey);
  const [kindFilter, setKindFilter] = useState<DocumentFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [docComposerOpen, setDocComposerOpen] = useState(false);
  const [docComposerSessionKey, setDocComposerSessionKey] = useState(0);
  const [docComposerDraft, setDocComposerDraft] = useState<AttachmentComposerDraft | null>(null);
  const [docComposerRoom, setDocComposerRoom] = useState("Team");
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [deletingOrphans, setDeletingOrphans] = useState(false);

  const workspaceDocIds = useMemo(() => new Set(extraDocs.map((d) => d.id)), [extraDocs]);

  const orphanedDocs = useMemo(() => listOrphanedWorkspaceDocuments(), [extraDocs]);

  const folders = useMemo(() => aggregateProjectFolders(allDocuments), [allDocuments]);

  const baseFiltered = useMemo(() => {
    return allDocuments.filter((d) => {
      if (kindFilter !== "ALL" && d.kind !== kindFilter) return false;
      if (projectKey === "ALL") return true;
      if (projectKey === "unassigned") return d.project_id == null;
      if (projectKey.startsWith("p:")) {
        const id = Number(projectKey.slice(2));
        return d.project_id === id;
      }
      return true;
    });
  }, [allDocuments, kindFilter, projectKey]);

  const recent = useMemo(() => {
    return [...baseFiltered]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6);
  }, [baseFiltered]);

  const tableRows = useMemo(() => {
    const rows = [...baseFiltered];
    rows.sort((a, b) => {
      const byKind = kindRank(a.kind) - kindRank(b.kind);
      if (byKind !== 0) return byKind;
      if (sortKey === "name") return cmp(a.name, b.name, sortDir);
      if (sortKey === "uploaded_by") return cmp(a.uploaded_by, b.uploaded_by, sortDir);
      return cmpTime(a.updated_at, b.updated_at, sortDir);
    });
    return rows;
  }, [baseFiltered, sortKey, sortDir]);

  const tableGroups = useMemo(() => {
    if (kindFilter === "ALL") {
      return DOCUMENT_KIND_ORDER.map((kind) => ({
        key: kind,
        label: kindLabel(kind),
        rows: tableRows.filter((d) => d.kind === kind),
      })).filter((g) => g.rows.length > 0);
    }
    return [{ key: kindFilter, label: kindLabel(kindFilter), rows: tableRows }];
  }, [kindFilter, tableRows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updated" ? "desc" : "asc");
    }
  }

  function canDeleteDocument(doc: DocumentRow): boolean {
    return workspaceDocIds.has(doc.id);
  }

  async function handleDeleteDocument(doc: DocumentRow, options?: { skipConfirm?: boolean }) {
    if (!canDeleteDocument(doc)) {
      window.alert("Demo library files can't be removed here.");
      return;
    }
    if (!options?.skipConfirm) {
      const label = doc.name.trim() || "this file";
      const noun = doc.kind === "image" ? "image" : "file";
      if (
        !window.confirm(
          `Delete "${label}"? This removes the ${noun} from Documents and local storage. This cannot be undone.`,
        )
      ) {
        return;
      }
    }
    setDeletingDocId(doc.id);
    const { removed, quotaExceeded } = await deleteExtraDocumentsByIds([doc.id]);
    setDeletingDocId(null);
    if (quotaExceeded) {
      window.alert("Could not delete — browser storage update failed. Try again.");
      return;
    }
    if (removed > 0) {
      if (previewDoc?.id === doc.id) setPreviewDoc(null);
      await reloadExtras();
    }
  }

  async function handleDeleteOrphanedDocuments() {
    if (orphanedDocs.length === 0) return;
    const imageCount = orphanedDocs.filter((d) => d.kind === "image").length;
    const detail =
      imageCount > 0 && imageCount < orphanedDocs.length
        ? ` (${imageCount} image${imageCount === 1 ? "" : "s"})`
        : imageCount === orphanedDocs.length
          ? imageCount === 1
            ? " image"
            : " images"
          : "";
    if (
      !window.confirm(
        `Delete ${orphanedDocs.length} file${orphanedDocs.length === 1 ? "" : "s"}${detail} linked to deleted projects? This removes them from Documents and local storage. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingOrphans(true);
    const { removed, quotaExceeded } = await deleteExtraDocumentsByIds(orphanedDocs.map((d) => d.id));
    setDeletingOrphans(false);
    if (quotaExceeded) {
      window.alert("Could not delete — browser storage update failed. Try again.");
      return;
    }
    if (removed > 0) {
      if (previewDoc && orphanedDocs.some((d) => d.id === previewDoc.id)) setPreviewDoc(null);
      await reloadExtras();
    }
  }

  function openDocument(doc: DocumentRow) {
    if (opensInAttachmentComposer(doc)) {
      const room = doc.project_name?.trim() || doc.uploaded_by || "Team";
      setDocComposerRoom(room);
      setDocComposerDraft(draftFromDocumentRow(doc, room));
      setDocComposerSessionKey((k) => k + 1);
      setDocComposerOpen(true);
      return;
    }
    setPreviewDoc(doc);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto max-w-[1600px] space-y-8 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
          >
            + New
          </button>

          {projectScope ? (
            <div className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1 sm:max-w-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Project</span>
              <p className="rounded-xl border border-accent/30 bg-violet-50/50 px-3 py-2.5 text-sm font-semibold text-text-primary ring-1 ring-accent/20">
                {projectScope.projectName}
                <span className="ml-2 font-normal text-text-secondary">
                  ({baseFiltered.length} file{baseFiltered.length === 1 ? "" : "s"})
                </span>
              </p>
            </div>
          ) : (
            <label className="relative flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1 sm:max-w-xs">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Project</span>
              <div className="relative">
                <select
                  aria-label="Filter by project"
                  className={`w-full cursor-pointer appearance-none rounded-xl border bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/30 ${
                    projectKey === "ALL" ? "border-border-light" : "border-accent/50 ring-1 ring-accent/20"
                  }`}
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value)}
                >
                  <option value="ALL">
                    All projects ({allDocuments.length} file{allDocuments.length === 1 ? "" : "s"})
                  </option>
                  {folders.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label} ({f.count} file{f.count === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              </div>
            </label>
          )}

          <div className="relative inline-flex items-center gap-1 rounded-xl border border-border-light bg-white px-3 py-2 text-sm text-text-primary shadow-sm">
            <span className="text-text-secondary">Then by:</span>
            <select
              aria-label="Sort within each document type"
              className="cursor-pointer appearance-none bg-transparent pr-6 font-medium focus:outline-none"
              value={`${sortKey}:${sortDir}`}
              onChange={(e) => {
                const [k, d] = e.target.value.split(":") as [SortKey, SortDir];
                setSortKey(k);
                setSortDir(d);
              }}
            >
              <option value="updated:desc">Latest</option>
              <option value="updated:asc">Oldest</option>
              <option value="name:asc">Name (A–Z)</option>
              <option value="name:desc">Name (Z–A)</option>
              <option value="uploaded_by:asc">Uploaded by (A–Z)</option>
              <option value="uploaded_by:desc">Uploaded by (Z–A)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary" />
          </div>

          <button
            type="button"
            onClick={() => {
              setKindFilter("ALL");
              setProjectKey(projectScope ? `p:${projectScope.projectId}` : "ALL");
            }}
            className="rounded-xl border border-border-light bg-white px-3 py-2.5 text-sm font-medium text-text-secondary shadow-sm hover:bg-slate-50"
          >
            Reset filters
          </button>
        </div>

        {orphanedDocs.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p>
              <span className="font-semibold">
                {orphanedDocs.length} file{orphanedDocs.length === 1 ? "" : "s"}
              </span>{" "}
              {orphanedDocs.length === 1 ? "is" : "are"} linked to deleted projects.
            </p>
            <button
              type="button"
              disabled={deletingOrphans}
              onClick={() => void handleDeleteOrphanedDocuments()}
              className="shrink-0 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deletingOrphans ? "Deleting…" : "Delete all"}
            </button>
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:thin]">
          {(
            [
              { label: "All", value: "ALL" as const },
              { label: "Invoices", value: "invoice" as const },
              { label: "Quotes", value: "quote" as const },
              { label: "Tech packs", value: "tech_pack" as const },
              { label: "Images", value: "image" as const },
              { label: "Other", value: "other" as const },
            ] as const
          ).map((pill) => (
            <button
              key={pill.value}
              type="button"
              onClick={() => setKindFilter(pill.value)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                kindFilter === pill.value
                  ? "border-accent bg-violet-100 text-text-primary ring-1 ring-accent/30"
                  : "border-border-light bg-white text-text-secondary hover:border-slate-300 hover:text-text-primary"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <section>
          {recent.length > 0 ? (
            <>
              <h2 className="text-base font-semibold text-text-primary">Recent</h2>
              <p className="mt-1 text-sm text-text-secondary">Latest uploads for your current folder and kind filters.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {recent.map((d) => (
                  <div
                    key={d.id}
                    className="relative flex min-h-[7.5rem] flex-col overflow-hidden rounded-2xl border border-border-light bg-surface-card p-3 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md"
                  >
                    {canDeleteDocument(d) ? (
                      <button
                        type="button"
                        aria-label={`Delete ${d.name}`}
                        disabled={deletingDocId === d.id}
                        onClick={(e) => {
                          stopRowNavigate(e);
                          void handleDeleteDocument(d);
                        }}
                        className="absolute right-2 top-2 z-10 rounded-lg bg-white/90 p-1.5 text-red-600 shadow-sm ring-1 ring-slate-200 hover:bg-red-50 disabled:opacity-50"
                      >
                        <TrashIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openDocument(d)}
                      className="flex min-h-0 flex-1 flex-col text-left"
                    >
                    <DocumentThumb doc={d} className="h-20 w-full rounded-lg object-cover bg-slate-100" />
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-text-primary">{d.name}</p>
                    {d.project_id != null && d.project_name ? (
                      <p className="mt-1 truncate text-xs">
                        <Link
                          href={projectRowHref(d) ?? "#"}
                          onClick={stopRowNavigate}
                          className="font-semibold text-accent hover:underline"
                        >
                          {d.project_name}
                        </Link>
                      </p>
                    ) : null}
                    <p className="mt-auto pt-2 text-xs text-text-secondary">
                      {formatShortDate(d.updated_at)} · {formatFileSize(d.size_bytes)}
                      {docSourceLabel(d) ? ` · ${docSourceLabel(d)}` : ""}
                    </p>
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section>
          <h2 className="text-base font-semibold text-text-primary">All files</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border-light bg-surface-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border-light bg-slate-50 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">
                      <button type="button" className="inline-flex items-center gap-1 hover:text-text-primary" onClick={() => toggleSort("name")}>
                        Name
                        {sortKey === "name" ? <ChevronDown className={sortDir === "asc" ? "rotate-180" : ""} /> : null}
                      </button>
                    </th>
                    <th className="hidden px-4 py-3 sm:table-cell">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-text-primary"
                        onClick={() => toggleSort("uploaded_by")}
                      >
                        Uploaded by
                        {sortKey === "uploaded_by" ? <ChevronDown className={sortDir === "asc" ? "rotate-180" : ""} /> : null}
                      </button>
                    </th>
                    <th className="hidden px-4 py-3 md:table-cell">Kind</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Project</th>
                    <th className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-text-primary"
                        onClick={() => toggleSort("updated")}
                      >
                        Updated
                        {sortKey === "updated" ? <ChevronDown className={sortDir === "asc" ? "rotate-180" : ""} /> : null}
                      </button>
                    </th>
                    <th className="w-12 px-2 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableGroups.map((group) => (
                      <Fragment key={group.key}>
                        <tr className="bg-slate-100/90">
                          <td
                            colSpan={6}
                            className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-secondary"
                          >
                            {group.label}
                            <span className="ml-2 font-normal normal-case text-text-secondary">({group.rows.length})</span>
                          </td>
                        </tr>
                        {group.rows.map((d) => (
                          <tr
                            key={d.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openDocument(d)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openDocument(d);
                              }
                            }}
                            className="cursor-pointer border-b border-border-light last:border-0 hover:bg-slate-50/80"
                          >
                            <td className="px-4 py-3">
                              <div className="flex min-w-0 items-start gap-2">
                                <div className="mt-0.5 h-10 w-10 shrink-0 overflow-hidden rounded-md bg-slate-100">
                                  <DocumentThumb doc={d} className="h-10 w-10 object-cover" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-medium text-text-primary">{d.name}</span>
                                  {docSourceLabel(d) ? (
                                    <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                                      {docSourceLabel(d)}
                                    </span>
                                  ) : null}
                                  <p className="mt-1 text-xs text-text-secondary sm:hidden">{d.uploaded_by}</p>
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 sm:table-cell">
                              <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                                  {clientInitials(d.uploaded_by)}
                                </span>
                                <span className="text-text-primary">{d.uploaded_by}</span>
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 text-text-secondary md:table-cell">{kindLabel(d.kind)}</td>
                            <td className="hidden px-4 py-3 lg:table-cell">
                              <DocumentProjectLink doc={d} />
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-text-secondary">{formatShortDate(d.updated_at)}</td>
                            <td className="px-2 py-3 text-right">
                              {canDeleteDocument(d) ? (
                                <button
                                  type="button"
                                  aria-label={`Delete ${d.name}`}
                                  disabled={deletingDocId === d.id}
                                  onClick={(e) => {
                                    stopRowNavigate(e);
                                    void handleDeleteDocument(d);
                                  }}
                                  className="inline-flex rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  <TrashIcon />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {newOpen ? (
        <NewDocumentModal
          draft={newDraft}
          onChange={patchNewDraft}
          onSubmit={handleNewDoc}
          onClose={() => setNewOpen(false)}
          projectChoices={projects}
          lockProject={projectScope != null}
        />
      ) : null}
      <DocumentPreviewModal
        doc={previewDoc}
        open={previewDoc != null}
        onClose={() => setPreviewDoc(null)}
        canDelete={previewDoc != null && canDeleteDocument(previewDoc)}
        onDelete={
          previewDoc
            ? async () => {
                await handleDeleteDocument(previewDoc, { skipConfirm: true });
              }
            : undefined
        }
      />
      <MessageAttachmentComposer
        open={docComposerOpen}
        sessionKey={docComposerSessionKey}
        initialDraft={docComposerDraft}
        mode="edit"
        roomTitle={docComposerRoom}
        onClose={() => setDocComposerOpen(false)}
        onSend={(_attachment, _timeLabel) => {
          setDocComposerOpen(false);
        }}
      />
    </div>
  );
}
