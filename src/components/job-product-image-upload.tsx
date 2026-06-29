"use client";

import { useRef } from "react";
import type { FileRef } from "@/lib/types/contact";

function newFileRef(name: string, url: string): FileRef {
  return {
    id: `img-${Date.now()}`,
    name,
    url,
    uploaded_at: new Date().toISOString(),
  };
}

export function JobProductImageUpload({
  image,
  onChange,
}: {
  image?: FileRef | null;
  onChange: (image: FileRef | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(newFileRef(file.name, reader.result));
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative flex size-24 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-light bg-slate-50 hover:border-accent/50"
        title="Upload product image"
      >
        {image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" className="size-full object-cover" />
        ) : (
          <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-text-secondary group-hover:text-accent">
            Upload image
          </span>
        )}
      </button>
      {image?.url ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white"
          aria-label="Remove image"
        >
          ×
        </button>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
