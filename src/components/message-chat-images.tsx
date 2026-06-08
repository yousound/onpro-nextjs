"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { downloadChatImage } from "@/lib/download-chat-image";

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "size-3.5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 3v12M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "size-3.5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" strokeLinecap="round" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

export function MessageImageStrip({
  urls,
  alignEnd,
  removable,
  onRemoveAt,
  onOpenAt,
}: {
  urls: string[];
  alignEnd?: boolean;
  removable?: boolean;
  onRemoveAt?: (index: number) => void;
  onOpenAt?: (index: number) => void;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${alignEnd ? "justify-end" : ""}`}>
      {urls.map((url, i) => (
        <div key={`${url}-${i}`} className="group/img relative">
          <button
            type="button"
            onClick={() => onOpenAt?.(i)}
            className="block cursor-zoom-in overflow-hidden rounded-xl ring-1 ring-slate-200/90 transition hover:ring-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
            aria-label="View full size"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="max-h-52 max-w-[min(100%,15rem)] object-cover shadow-sm"
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void downloadChatImage(url, i);
            }}
            className="absolute bottom-1.5 left-1.5 flex size-7 items-center justify-center rounded-full bg-slate-900/75 text-white shadow-sm transition hover:bg-violet-600"
            aria-label="Download image"
            title="Download"
          >
            <DownloadIcon />
          </button>
          {removable && onRemoveAt ? (
            <button
              type="button"
              onClick={() => onRemoveAt(i)}
              className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-slate-900/75 text-white opacity-0 shadow-sm transition group-hover/img:opacity-100 hover:bg-red-600 focus:opacity-100"
              aria-label="Remove image"
              title="Remove image"
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function MessageImageViewerModal({
  open,
  urls,
  index,
  onClose,
  onIndexChange,
}: {
  open: boolean;
  urls: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hasMany = urls.length > 1;
  const safeIndex = urls.length === 0 ? 0 : Math.min(Math.max(index, 0), urls.length - 1);
  const current = urls[safeIndex];

  const goPrev = useCallback(() => {
    if (!hasMany) return;
    onIndexChange(safeIndex === 0 ? urls.length - 1 : safeIndex - 1);
  }, [hasMany, onIndexChange, safeIndex, urls.length]);

  const goNext = useCallback(() => {
    if (!hasMany) return;
    onIndexChange(safeIndex === urls.length - 1 ? 0 : safeIndex + 1);
  }, [hasMany, onIndexChange, safeIndex, urls.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted || !current) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[250] isolate flex flex-col bg-neutral-950"
      style={{ backgroundColor: "#0a0a0a" }}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black" aria-hidden />
      <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <p className="text-sm font-medium text-white/90">
          {hasMany ? `Image ${safeIndex + 1} of ${urls.length}` : "Image preview"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void downloadChatImage(current, safeIndex)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
          >
            <DownloadIcon className="size-4" />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
            aria-label="Close"
          >
            Close
          </button>
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center bg-black px-4 pb-6">
        {hasMany ? (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 md:left-6"
            aria-label="Previous image"
          >
            ‹
          </button>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt=""
          className="max-h-[calc(100vh-7rem)] max-w-full object-contain"
        />
        {hasMany ? (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 md:right-6"
            aria-label="Next image"
          >
            ›
          </button>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
