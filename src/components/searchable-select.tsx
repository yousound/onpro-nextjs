"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  sublabel?: string;
  /** Extra text included when filtering (email, code, etc.). */
  keywords?: string;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function optionMatches(opt: SearchableSelectOption, query: string): boolean {
  if (!query) return true;
  const hay = normalize(`${opt.label} ${opt.sublabel ?? ""} ${opt.keywords ?? ""}`);
  return hay.includes(query);
}

const variantInputClass: Record<"field" | "document", string> = {
  field:
    "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-9 text-base text-slate-900 outline-none focus:ring-2 focus:ring-violet-500/25",
  document:
    "mt-2 w-full rounded-none border-0 border-b border-dotted border-slate-300 bg-transparent py-1 pr-8 text-sm font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0",
};

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  onClear,
  placeholder = "Search or select…",
  emptyMessage = "No matches",
  savedLabel,
  variant = "field",
  labelClassName = "block text-sm font-medium text-slate-600",
  disabled = false,
  listClassName,
}: {
  label: string;
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  emptyMessage?: string;
  /** Shown when `value` is set but not found in `options` (legacy saved text). */
  savedLabel?: string | null;
  variant?: "field" | "document";
  labelClassName?: string;
  disabled?: boolean;
  listClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    return options.filter((o) => optionMatches(o, q));
  }, [options, query]);

  const closedLabel = selected?.label ?? savedLabel?.trim() ?? "";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function pick(opt: SearchableSelectOption) {
    onChange(opt.value);
    setQuery("");
    setOpen(false);
  }

  function handleClear() {
    onClear?.();
    setQuery("");
    setOpen(false);
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter" && open) {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  const showList = open && !disabled;
  const inputValue = open ? query : closedLabel;

  return (
    <div ref={rootRef} className="relative">
      <label className={labelClassName}>
        {label}
        <div className="relative">
          <input
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={label}
            disabled={disabled}
            placeholder={placeholder}
            value={inputValue}
            className={variantInputClass[variant]}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (!disabled) {
                setOpen(true);
                setQuery("");
              }
            }}
            onKeyDown={onInputKeyDown}
          />
          {(value || savedLabel) && onClear && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={`Clear ${label}`}
            >
              ×
            </button>
          ) : (
            <span
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              ▾
            </span>
          )}
        </div>
      </label>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className={
            listClassName ??
            "absolute z-[250] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          }
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">{emptyMessage}</li>
          ) : (
            filtered.map((opt, i) => {
              const active = i === highlight;
              const isSelected = opt.value === value;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    active ? "bg-violet-50 text-violet-900" : "text-slate-800 hover:bg-slate-50"
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(opt);
                  }}
                >
                  <span className="font-medium">{opt.label}</span>
                  {opt.sublabel ? (
                    <span className="mt-0.5 block text-xs text-slate-500">{opt.sublabel}</span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
