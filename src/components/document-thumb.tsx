"use client";

import { useEffect, useState } from "react";
import { resolveDocumentPreviewSrc, isImageDocument } from "@/lib/documents/document-preview";
import type { DocumentRow } from "@/lib/types/documents";

function FileGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

export function DocumentThumb({
  doc,
  className = "h-14 w-full rounded-lg object-cover",
}: {
  doc: DocumentRow;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(() => {
    if (doc.file_data_url && isImageDocument(doc)) return doc.file_data_url;
    if (doc.external_url && isImageDocument(doc)) return doc.external_url;
    return null;
  });

  useEffect(() => {
    if (src || !isImageDocument(doc)) return;
    let cancelled = false;
    void resolveDocumentPreviewSrc(doc).then((url) => {
      if (!cancelled && url) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.blob_ref, doc.file_data_url, doc.external_url, src]);

  if (src && isImageDocument(doc)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={className} />
    );
  }

  return <FileGlyph className="shrink-0 text-text-secondary" />;
}
