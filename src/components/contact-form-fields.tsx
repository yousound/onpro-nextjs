"use client";

import { useState } from "react";
import type { Address, ContactKind, FileRef } from "@/lib/types/contact";

export const fieldClass =
  "mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export const labelClass = "block text-xs font-medium text-text-secondary";

export function AddressFields({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Address;
  onChange: (a: Address) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-border-light bg-surface-body/30 px-3 py-3">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{title}</legend>
      <div className="mt-2 space-y-2">
        <input
          className={fieldClass}
          placeholder="Line 1"
          value={value.line1 ?? ""}
          onChange={(e) => onChange({ ...value, line1: e.target.value })}
        />
        <input
          className={fieldClass}
          placeholder="Line 2"
          value={value.line2 ?? ""}
          onChange={(e) => onChange({ ...value, line2: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={fieldClass}
            placeholder="City"
            value={value.city ?? ""}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
          />
          <input
            className={fieldClass}
            placeholder="State"
            value={value.state ?? ""}
            onChange={(e) => onChange({ ...value, state: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className={fieldClass}
            placeholder="Postal code"
            value={value.postal_code ?? ""}
            onChange={(e) => onChange({ ...value, postal_code: e.target.value })}
          />
          <input
            className={fieldClass}
            placeholder="Country"
            value={value.country ?? ""}
            onChange={(e) => onChange({ ...value, country: e.target.value })}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function KindToggle({ kind, onChange }: { kind: ContactKind; onChange: (k: ContactKind) => void }) {
  return (
    <div className="flex gap-2">
      {(["company", "individual"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
            kind === k
              ? "bg-accent text-white shadow-sm"
              : "bg-surface-card text-text-secondary ring-1 ring-border-light hover:text-text-primary"
          }`}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

export function AvatarUpload({
  avatarUrl,
  onChange,
  fallbackInitials,
}: {
  avatarUrl: string | null;
  onChange: (url: string | null) => void;
  fallbackInitials: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-border-light" />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-bold text-slate-700">
          {fallbackInitials}
        </span>
      )}
      <label className="cursor-pointer text-sm font-semibold text-accent hover:underline">
        Upload avatar
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(URL.createObjectURL(f));
          }}
        />
      </label>
      {avatarUrl ? (
        <button type="button" className="text-xs text-text-secondary hover:text-red-600" onClick={() => onChange(null)}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

export function FileUploadList({
  label,
  files,
  onChange,
}: {
  label: string;
  files: FileRef[];
  onChange: (files: FileRef[]) => void;
}) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <ul className="mt-2 space-y-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between rounded-lg bg-surface-body/50 px-2 py-1 text-xs">
            <span className="truncate">{f.name}</span>
            <button
              type="button"
              className="text-red-600 hover:underline"
              onClick={() => onChange(files.filter((x) => x.id !== f.id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <label className="mt-2 inline-flex cursor-pointer text-sm font-semibold text-accent hover:underline">
        + Upload file
        <input
          type="file"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onChange([
              ...files,
              {
                id: `f-${Date.now()}`,
                name: f.name,
                url: URL.createObjectURL(f),
                uploaded_at: new Date().toISOString(),
              },
            ]);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

export function OtherEmailsInput({
  emails,
  onChange,
}: {
  emails: string[];
  onChange: (emails: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <span className={labelClass}>Other emails</span>
      <div className="mt-1 flex flex-wrap gap-1">
        {emails.map((em) => (
          <span key={em} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
            {em}
            <button type="button" onClick={() => onChange(emails.filter((x) => x !== em))} aria-label={`Remove ${em}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className={fieldClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add email"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = draft.trim();
              if (v && !emails.includes(v)) onChange([...emails, v]);
              setDraft("");
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded-lg border border-border-light px-3 text-sm font-semibold text-accent"
          onClick={() => {
            const v = draft.trim();
            if (v && !emails.includes(v)) onChange([...emails, v]);
            setDraft("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
