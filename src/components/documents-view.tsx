"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import type { DocumentKind, DocumentRow } from "@/lib/types/documents";
import { clientInitials, formatFileSize, formatShortDate } from "@/lib/format";
import { MOCK_LS, readMockLs, writeMockLs } from "@/lib/mock-local";
import type { AttachmentComposerDraft } from "@/lib/attachment-composer-draft";
import { draftFromDocumentRow } from "@/lib/attachment-composer-draft";
import { MessageAttachmentComposer } from "@/components/message-attachment-composer";

type SortKey = "updated" | "name" | "uploaded_by";
type SortDir = "asc" | "desc";

/** Matches `DocumentsListView` type pill order (subset maps to web `DocumentKind`). */
const DOCUMENT_KIND_ORDER: DocumentKind[] = ["invoice", "quote", "tech_pack", "other"];

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

function projectKeyFromDoc(d: DocumentRow): string {
  return d.project_id == null ? "unassigned" : `p:${d.project_id}`;
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

export function DocumentsView({ documents: seedDocuments }: { documents: DocumentRow[] }) {
  const [extraDocs, setExtraDocs] = useState<DocumentRow[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<DocumentKind>("other");
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [newUploader, setNewUploader] = useState("Jerry M");
  const [newSizeMb, setNewSizeMb] = useState("0.5");

  useEffect(() => {
    const saved = readMockLs<DocumentRow[]>(MOCK_LS.documents);
    if (saved?.length) setExtraDocs(saved);
  }, []);

  const allDocuments = useMemo(() => [...seedDocuments, ...extraDocs], [seedDocuments, extraDocs]);

  function persistExtras(next: DocumentRow[]) {
    setExtraDocs(next);
    writeMockLs(MOCK_LS.documents, next);
  }

  function handleNewDoc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const pid = newProjectId === "" ? null : Number(newProjectId);
    const choice = projectChoices(seedDocuments).find((c) => c.id === pid);
    const row: DocumentRow = {
      id: Math.max(0, ...allDocuments.map((d) => d.id)) + 1,
      name,
      project_id: pid,
      project_name: pid == null ? null : choice?.name ?? null,
      kind: newKind,
      size_bytes: Math.max(1024, Math.round(Number(newSizeMb) * 1024 * 1024) || 512_000),
      uploaded_by: newUploader.trim() || "Connect Dots Ops",
      updated_at: new Date().toISOString(),
    };
    persistExtras([...extraDocs, row]);
    setNewOpen(false);
    setNewName("");
    setNewSizeMb("0.5");
  }

  const [projectKey, setProjectKey] = useState<string>("ALL");
  const [kindFilter, setKindFilter] = useState<DocumentKind | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [docComposerOpen, setDocComposerOpen] = useState(false);
  const [docComposerSessionKey, setDocComposerSessionKey] = useState(0);
  const [docComposerDraft, setDocComposerDraft] = useState<AttachmentComposerDraft | null>(null);
  const [docComposerRoom, setDocComposerRoom] = useState("Team");

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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updated" ? "desc" : "asc");
    }
  }

  function openDocComposer(doc: DocumentRow) {
    const room = doc.project_name?.trim() || doc.uploaded_by || "Team";
    setDocComposerRoom(room);
    setDocComposerDraft(draftFromDocumentRow(doc, room));
    setDocComposerSessionKey((k) => k + 1);
    setDocComposerOpen(true);
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
              setProjectKey("ALL");
            }}
            className="rounded-xl border border-border-light bg-white px-3 py-2.5 text-sm font-medium text-text-secondary shadow-sm hover:bg-slate-50"
          >
            Reset filters
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:thin]">
          {(
            [
              { label: "All", value: "ALL" as const },
              { label: "Invoices", value: "invoice" as const },
              { label: "Quotes", value: "quote" as const },
              { label: "Tech packs", value: "tech_pack" as const },
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
          <h2 className="text-base font-semibold text-text-primary">Recent</h2>
          <p className="mt-1 text-sm text-text-secondary">Latest uploads for your current folder and kind filters.</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {recent.length === 0 ? (
              <p className="col-span-full rounded-2xl border border-dashed border-border-light bg-surface-card px-4 py-8 text-center text-sm text-text-secondary">
                No files match these filters.
              </p>
            ) : (
              recent.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openDocComposer(d)}
                  className="flex min-h-[7.5rem] flex-col rounded-2xl border border-border-light bg-surface-card p-3 text-left shadow-sm transition hover:border-accent/40 hover:shadow-md"
                >
                  <FileGlyph className="shrink-0 text-text-secondary" />
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-text-primary">{d.name}</p>
                  <p className="mt-auto pt-2 text-xs text-text-secondary">
                    {formatShortDate(d.updated_at)} · {formatFileSize(d.size_bytes)}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-text-primary">All files</h2>
              <p className="mt-1 text-sm text-text-secondary">
                {tableRows.length} row{tableRows.length === 1 ? "" : "s"} · grouped by type (iOS order: invoices → quotes → tech packs → other), then{" "}
                {sortKey === "updated" && sortDir === "desc"
                  ? "newest first within each type"
                  : sortKey === "updated"
                    ? "oldest first within each type"
                    : `${sortKey.replace("_", " ")} (${sortDir}) within each type`}
              </p>
            </div>
          </div>
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
                  </tr>
                </thead>
                <tbody>
                  {(kindFilter === "ALL" ? DOCUMENT_KIND_ORDER : [kindFilter]).map((kind) => {
                    const group = tableRows.filter((d) => d.kind === kind);
                    if (group.length === 0) return null;
                    return (
                      <Fragment key={kind}>
                        <tr className="bg-slate-100/90">
                          <td colSpan={5} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            {kindLabel(kind)}
                            <span className="ml-2 font-normal normal-case text-text-secondary">({group.length})</span>
                          </td>
                        </tr>
                        {group.map((d) => (
                          <tr
                            key={d.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openDocComposer(d)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openDocComposer(d);
                              }
                            }}
                            className="cursor-pointer border-b border-border-light last:border-0 hover:bg-slate-50/80"
                          >
                            <td className="px-4 py-3">
                              <div className="flex min-w-0 items-start gap-2">
                                <FileGlyph className="mt-0.5 shrink-0 text-text-secondary" />
                                <div className="min-w-0">
                                  <span className="font-medium text-text-primary">{d.name}</span>
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
                            <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">{d.project_name ?? "—"}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-text-secondary">{formatShortDate(d.updated_at)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {newOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-4 sm:items-center"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNewOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-new-title"
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border-light bg-surface-card p-5 shadow-xl"
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <h2 id="doc-new-title" className="text-lg font-semibold text-text-primary">
              New document (mock)
            </h2>
            <p className="mt-1 text-xs text-text-secondary">Stored in this browser — {MOCK_LS.documents}</p>
            <form className="mt-4 space-y-3" onSubmit={handleNewDoc}>
              <label className="block text-xs font-medium text-text-secondary">
                Name
                <input
                  required
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Revised quote — Homeward"
                />
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                Kind
                <select
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as DocumentKind)}
                >
                  <option value="invoice">Invoice</option>
                  <option value="quote">Quote</option>
                  <option value="tech_pack">Tech pack</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                Project
                <select
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {projectChoices(seedDocuments).map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                Uploaded by
                <input
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={newUploader}
                  onChange={(e) => setNewUploader(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-text-secondary">
                Size (MB, approx)
                <input
                  type="number"
                  min={0.01}
                  step={0.1}
                  className="mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary"
                  value={newSizeMb}
                  onChange={(e) => setNewSizeMb(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-slate-100" onClick={() => setNewOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-95">
                  Add to library
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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
