"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { DocumentKind, DocumentUploadFile } from "@/lib/types/documents";
import { MOCK_LS } from "@/lib/mock-local";
import {
  FolderIcon,
  NotesIcon,
  ProjectModalAside,
  ProjectModalBadge,
  ProjectModalField,
  ProjectModalOverlay,
  ProjectModalPanelFooter,
  ProjectModalPanelHeader,
  UserIcon,
  projectModalFieldClass,
} from "@/components/project-modal-ui";

export type DocumentDraft = {
  name: string;
  kind: DocumentKind;
  projectId: string;
  uploader: string;
  externalUrl: string;
  file: DocumentUploadFile | null;
};

function DocumentBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 12h8v2H8v-2zm0 4h8v2H8v-2z" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4 text-slate-400">
      <path d="M10 13a3.5 3.5 0 0 0 5 0l2-2a3.5 3.5 0 0 0-5-5l-1 1M14 11a3.5 3.5 0 0 0-5 0l-2 2a3.5 3.5 0 0 0 5 5l1-1" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type Props = {
  draft: DocumentDraft;
  onChange: (patch: Partial<DocumentDraft>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  projectChoices: { id: number; name: string }[];
  /** When true, project is fixed (project documents tab). */
  lockProject?: boolean;
  overlayClassName?: string;
};

export function NewDocumentModal({
  draft,
  onChange,
  onSubmit,
  onClose,
  projectChoices,
  lockProject = false,
  overlayClassName = "z-[150]",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasSource = Boolean(draft.file || draft.externalUrl.trim());
  const canSave = Boolean(draft.name.trim()) && hasSource;

  async function handleFileSelect(picked: FileList | null) {
    const file = picked?.[0];
    if (!file) return;
    setFileError(null);
    setReadingFile(true);
    try {
      const data_url =
        file.size <= 5 * 1024 * 1024 ? await readFileAsDataUrl(file) : undefined;
      const uploaded: DocumentUploadFile = {
        name: file.name,
        size_bytes: file.size,
        data_url,
      };
      const patch: Partial<DocumentDraft> = { file: uploaded };
      if (!draft.name.trim()) {
        patch.name = file.name.replace(/\.[^.]+$/, "") || file.name;
      }
      if (file.type.startsWith("image/")) {
        patch.kind = "image";
      }
      onChange(patch);
    } catch {
      setFileError("Could not read that file. Try again or paste a Dropbox link instead.");
    } finally {
      setReadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <ProjectModalOverlay
      titleId="new-document-title"
      onClose={onClose}
      overlayClassName={overlayClassName}
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <DocumentBadgeIcon />
            </ProjectModalBadge>
          }
          title={
            <>
              Add a file to
              <br />
              the library.
            </>
          }
          body={`Upload from your device or paste a Dropbox / Drive link. Saved in this browser (${MOCK_LS.documents}).`}
        />
      }
    >
      <ProjectModalPanelHeader
        title="New document"
        subtitle="Upload a file or add an external link — at least one is required."
        onClose={onClose}
      />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <ProjectModalField label="Upload file">
            <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4">
              {draft.file ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{draft.file.name}</p>
                    <p className="text-xs text-slate-500">{formatBytes(draft.file.size_bytes)}</p>
                    {!draft.file.data_url && draft.file.size_bytes > 5 * 1024 * 1024 ? (
                      <p className="mt-1 text-[11px] text-amber-700">
                        File is large — metadata only in this preview. Use a Dropbox link for the full file.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange({ file: null })}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-slate-600">PDF, spreadsheet, image, or pack file</p>
                  <button
                    type="button"
                    disabled={readingFile}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 rounded-xl bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#6d28d9] disabled:cursor-wait disabled:opacity-60"
                  >
                    {readingFile ? "Reading file…" : "Choose file"}
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => void handleFileSelect(e.target.files)}
              />
              {fileError ? <p className="mt-2 text-xs font-semibold text-red-600">{fileError}</p> : null}
            </div>
          </ProjectModalField>

          <ProjectModalField label="Dropbox / external link" icon={<LinkIcon />}>
            <input
              type="url"
              className={projectModalFieldClass}
              value={draft.externalUrl}
              onChange={(e) => onChange({ externalUrl: e.target.value })}
              placeholder="https://www.dropbox.com/s/…"
              autoComplete="off"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Paste a shared Dropbox, Google Drive, or WeTransfer link if the file lives elsewhere.
            </p>
          </ProjectModalField>

          <ProjectModalField label="Name" icon={<FolderIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Revised quote — Homeward"
              required
              autoComplete="off"
              autoFocus
            />
          </ProjectModalField>

          <div className="grid gap-4 sm:grid-cols-2">
            <ProjectModalField label="Kind" icon={<NotesIcon />}>
              <select
                className={projectModalFieldClass}
                value={draft.kind}
                onChange={(e) => onChange({ kind: e.target.value as DocumentKind })}
              >
                <option value="invoice">Invoice</option>
                <option value="quote">Quote</option>
                <option value="tech_pack">Tech pack</option>
                <option value="image">Image</option>
                <option value="other">Other</option>
              </select>
            </ProjectModalField>

            <ProjectModalField label="Project">
              {lockProject && projectChoices[0] ? (
                <p className={projectModalFieldClass}>{projectChoices[0].name}</p>
              ) : (
                <select
                  className={projectModalFieldClass}
                  value={draft.projectId}
                  onChange={(e) => onChange({ projectId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {projectChoices.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </ProjectModalField>
          </div>

          <ProjectModalField label="Uploaded by" icon={<UserIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.uploader}
              onChange={(e) => onChange({ uploader: e.target.value })}
              autoComplete="off"
            />
          </ProjectModalField>

          {!hasSource ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Add a file upload or an external link before saving.
            </p>
          ) : null}
        </div>

        <ProjectModalPanelFooter
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel="Add to library"
          primaryDisabled={!canSave}
        />
      </form>
    </ProjectModalOverlay>
  );
}
