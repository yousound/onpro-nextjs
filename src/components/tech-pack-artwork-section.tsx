"use client";

import { useRef, useState } from "react";
import type { TechPackDropboxLink, TechPackFile } from "@/lib/types/wip";

const labelClass = "block text-xs font-medium text-text-secondary";

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

export function TechPackArtworkSection({
  files,
  links,
  onChangeFiles,
  onChangeLinks,
}: {
  files: TechPackFile[];
  links: TechPackDropboxLink[];
  onChangeFiles: (next: TechPackFile[]) => void;
  onChangeLinks: (next: TechPackDropboxLink[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    setError(null);
    const additions: TechPackFile[] = [];
    for (const file of Array.from(picked)) {
      try {
        // ~5 MB cap per file to keep localStorage healthy in this mock.
        const data_url =
          file.size <= 5 * 1024 * 1024 ? await readFileAsDataUrl(file) : undefined;
        additions.push({
          id: `tpfile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size_bytes: file.size,
          data_url,
          uploaded_at: new Date().toISOString(),
        });
      } catch {
        setError("Could not read one of the selected files.");
      }
    }
    if (additions.length > 0) onChangeFiles([...files, ...additions]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(id: string) {
    onChangeFiles(files.filter((f) => f.id !== id));
  }

  function addLink() {
    const url = draftUrl.trim();
    if (!url) return;
    onChangeLinks([
      ...links,
      {
        id: `tplink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: draftLabel.trim() || url,
        url,
      },
    ]);
    setDraftLabel("");
    setDraftUrl("");
  }

  function removeLink(id: string) {
    onChangeLinks(links.filter((l) => l.id !== id));
  }

  return (
    <div className="rounded-xl border border-violet-100/90 bg-surface-body/35 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text-primary">Artwork / tech-pack files</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
        >
          Upload files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {error ? <p className="mt-2 text-[11px] font-semibold text-red-600">{error}</p> : null}

      {files.length === 0 ? (
        <p className="mt-2 text-[11px] text-text-secondary">
          PDFs, AI/PSD, or images — anything the team needs to send to the printer.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border-light bg-white px-3 py-2 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">{f.name}</p>
                <p className="text-[10px] text-text-secondary">{formatBytes(f.size_bytes)}</p>
              </div>
              <div className="flex items-center gap-2">
                {f.data_url ? (
                  <a
                    href={f.data_url}
                    download={f.name}
                    className="rounded-md border border-border-light px-2 py-1 text-[10px] font-semibold text-text-secondary hover:text-text-primary"
                  >
                    Download
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="rounded-md px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-border-light/70 pt-3">
        <p className="text-xs font-semibold text-text-primary">Dropbox / URL links</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr,1.5fr,auto]">
          <input
            className="rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Label (e.g. Front art)"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
          />
          <input
            className="rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="https://www.dropbox.com/…"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLink();
              }
            }}
          />
          <button
            type="button"
            onClick={addLink}
            disabled={!draftUrl.trim()}
            className="rounded-lg border border-accent/40 px-3 py-2 text-xs font-semibold text-accent hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add link
          </button>
        </div>
        {links.length === 0 ? (
          <p className={`${labelClass} mt-2`}>No links yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {links.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border-light bg-white px-3 py-2 text-xs"
              >
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-w-0 truncate font-semibold text-accent hover:underline"
                >
                  {l.label}
                </a>
                <button
                  type="button"
                  onClick={() => removeLink(l.id)}
                  className="rounded-md px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
