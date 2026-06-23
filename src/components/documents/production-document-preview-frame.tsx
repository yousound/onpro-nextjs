"use client";

import { useMemo, useState } from "react";
import { buildProductionDocumentPreviewDocument } from "@/lib/documents/production-document-print";
import type { ProductionDocument } from "@/lib/documents/production-document-types";

/** US Letter at 96dpi — matches print CSS in production-document-print. */
export const LETTER_WIDTH_PX = 816;
export const LETTER_HEIGHT_PX = 1056;

export function ProductionDocumentPreviewFrame({
  draft,
  title,
}: {
  draft: ProductionDocument;
  title?: string;
}) {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const previewDoc = useMemo(() => buildProductionDocumentPreviewDocument(draft), [draft]);
  const scale = zoom / 100;

  const frame = (
    <div className="flex flex-col items-center">
      <div
        className="origin-top transition-transform duration-150"
        style={{
          transform: `scale(${scale})`,
          width: LETTER_WIDTH_PX,
          minHeight: LETTER_HEIGHT_PX,
        }}
      >
        <div
          className="overflow-hidden bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80"
          style={{ width: LETTER_WIDTH_PX, minHeight: LETTER_HEIGHT_PX }}
        >
          <iframe
            title={title ?? `Document ${draft.documentNumber}`}
            srcDoc={previewDoc}
            className="block border-0 bg-white"
            style={{ width: LETTER_WIDTH_PX, minHeight: LETTER_HEIGHT_PX }}
          />
        </div>
      </div>
      <div
        className="shrink-0"
        style={{ height: Math.max(0, LETTER_HEIGHT_PX * scale - LETTER_HEIGHT_PX) + 24 }}
        aria-hidden
      />
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[130] flex flex-col bg-slate-200/95">
        <div className="flex items-center justify-between border-b border-slate-300/80 bg-white px-4 py-2">
          <p className="text-sm font-semibold text-slate-800">Document preview</p>
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Exit full screen
          </button>
        </div>
        <div className="flex-1 overflow-auto p-8">{frame}</div>
        <PreviewZoomBar zoom={zoom} onZoom={setZoom} onFullscreen={() => setFullscreen(false)} fullscreen />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200/90 bg-[#e8eaed]">
      <div className="flex-1 overflow-auto px-4 py-8 sm:px-8">{frame}</div>
      <PreviewZoomBar
        zoom={zoom}
        onZoom={setZoom}
        onFullscreen={() => setFullscreen(true)}
        fullscreen={false}
      />
    </div>
  );
}

function PreviewZoomBar({
  zoom,
  onZoom,
  onFullscreen,
  fullscreen,
}: {
  zoom: number;
  onZoom: (z: number) => void;
  onFullscreen: () => void;
  fullscreen: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-3 border-t border-slate-300/60 bg-white/90 px-4 py-2.5 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => onZoom(Math.max(50, zoom - 10))}
        className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        aria-label="Zoom out"
      >
        −
      </button>
      <span className="min-w-[3rem] text-center text-sm font-semibold tabular-nums text-slate-700">
        {zoom}%
      </span>
      <button
        type="button"
        onClick={() => onZoom(Math.min(150, zoom + 10))}
        className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        aria-label="Zoom in"
      >
        +
      </button>
      <span className="text-slate-300">|</span>
      <span className="text-xs font-medium text-slate-500">1 / 1</span>
      {!fullscreen ? (
        <button
          type="button"
          onClick={onFullscreen}
          className="ml-2 flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Full screen preview"
        >
          ⛶
        </button>
      ) : null}
    </div>
  );
}
