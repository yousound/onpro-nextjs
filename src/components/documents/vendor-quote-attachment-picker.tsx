"use client";

import { useMemo } from "react";
import type { DocumentRow } from "@/lib/types/documents";
import { formatFileSize } from "@/lib/format";
import { kindLabel } from "@/lib/documents/document-kind-label";

export function VendorQuoteAttachmentPicker({
  documents,
  selectedIds,
  onChangeSelected,
  includeQuoteDocument,
  onIncludeQuoteDocument,
  quoteDocumentLabel = "Quote reference (HTML)",
}: {
  documents: DocumentRow[];
  selectedIds: Set<number>;
  onChangeSelected: (ids: Set<number>) => void;
  includeQuoteDocument: boolean;
  onIncludeQuoteDocument: (include: boolean) => void;
  quoteDocumentLabel?: string;
}) {
  const sorted = useMemo(
    () =>
      [...documents].sort((a, b) => {
        const ak = kindLabel(a.kind).localeCompare(kindLabel(b.kind));
        if (ak !== 0) return ak;
        return a.name.localeCompare(b.name);
      }),
    [documents],
  );

  function toggle(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeSelected(next);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Attachments
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Mockups and tech packs from the project document library. Spec is in the message body.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={includeQuoteDocument}
          onChange={(e) => onIncludeQuoteDocument(e.target.checked)}
        />
        <span>
          <span className="font-medium text-slate-900">{quoteDocumentLabel}</span>
        </span>
      </label>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          No job art in the document library yet. Mailroom images appear under Project → Documents
          after ingest — assign them to a job if needed.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {sorted.map((doc) => (
            <li key={doc.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedIds.has(doc.id)}
                  onChange={() => toggle(doc.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {doc.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {kindLabel(doc.kind)}
                    {doc.size_bytes ? ` · ${formatFileSize(doc.size_bytes)}` : ""}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
