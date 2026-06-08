"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  isImageDataUrl,
  isImageDocument,
  isImageHttpUrl,
  projectRowHref,
  resolveDocumentPreviewSrc,
} from "@/lib/documents/document-preview";
import { formatFileSize, formatShortDate } from "@/lib/format";
import type { DocumentRow } from "@/lib/types/documents";

export function DocumentPreviewModal({
  doc,
  open,
  onClose,
  onDelete,
  canDelete = false,
}: {
  doc: DocumentRow | null;
  open: boolean;
  onClose: () => void;
  onDelete?: () => void | Promise<void>;
  canDelete?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !doc) {
      setSrc(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void resolveDocumentPreviewSrc(doc).then((url) => {
      if (cancelled) return;
      setSrc(url);
      if (!url) {
        setError(
          doc.blob_ref || doc.source_ref?.startsWith("mailroom:")
            ? "Image file is missing from local storage. Reload Mailroom (with the thread linked to this project) or re-import from Gmail."
            : "No preview available for this file.",
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, doc?.id, doc?.blob_ref, doc?.file_data_url, doc?.external_url]);

  if (!open || !doc || !mounted) return null;

  const showImage =
    src &&
    (isImageDataUrl(src) || isImageHttpUrl(src) || isImageDocument(doc));
  const projectHref = projectRowHref(doc);

  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(90vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border-light px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-text-primary">{doc.name}</h3>
              <p className="mt-0.5 text-xs text-text-secondary">
                {doc.project_name ?? "Unassigned"} · {formatShortDate(doc.updated_at)} ·{" "}
                {formatFileSize(doc.size_bytes)}
                {doc.uploaded_by ? ` · ${doc.uploaded_by}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-text-secondary hover:bg-slate-100"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/80 px-5 py-4">
          {loading ? (
            <p className="py-16 text-center text-sm text-text-secondary">Loading preview…</p>
          ) : error ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-950">{error}</p>
          ) : showImage ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={doc.name}
                className="max-h-[min(70vh,720px)] max-w-full rounded-xl border border-border-light bg-white object-contain shadow-sm"
              />
            </div>
          ) : src ? (
            <div className="space-y-3 text-sm text-text-primary">
              <p>This file is not an image. Open the link below in a new tab.</p>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex font-semibold text-accent hover:underline"
              >
                Open file →
              </a>
            </div>
          ) : null}
          {doc.external_url && src !== doc.external_url ? (
            <p className="mt-4 text-center text-xs text-text-secondary">
              <a
                href={doc.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                External link
              </a>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-light bg-white px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {canDelete && onDelete ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  const label = doc.name.trim() || "this image";
                  if (
                    !window.confirm(
                      `Delete "${label}"? This removes it from Documents and local storage. This cannot be undone.`,
                    )
                  ) {
                    return;
                  }
                  setDeleting(true);
                  void Promise.resolve(onDelete()).finally(() => setDeleting(false));
                }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : isImageDocument(doc) ? "Delete image" : "Delete file"}
              </button>
            ) : null}
            {projectHref && doc.project_name ? (
              <Link
                href={projectHref}
                className="rounded-lg border border-accent/40 bg-violet-50 px-4 py-2 text-sm font-semibold text-accent hover:bg-violet-100"
              >
                Open {doc.project_name} →
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
