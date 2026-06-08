"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

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

const listboxClass =
  "max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg";

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
  portaled = false,
  commitOnBlur = false,
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
  /** Render menu in a portal (avoids clipping inside modals / overflow scroll areas). */
  portaled?: boolean;
  /** Commit the typed query to `onChange` when the field blurs (free-text names). */
  commitOnBlur?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [portalMounted, setPortalMounted] = useState(false);
  const [listStyle, setListStyle] = useState<CSSProperties>({});

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    return options.filter((o) => optionMatches(o, q));
  }, [options, query]);

  const closedLabel = selected?.label ?? savedLabel?.trim() ?? "";

  const syncListPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setListStyle({
      position: "fixed",
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
      zIndex: 10000,
    });
  }, []);

  useEffect(() => {
    setPortalMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      const listEl = document.getElementById(listId);
      if (listEl?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, listId]);

  useEffect(() => {
    if (!open || !portaled) return;
    syncListPosition();
    const onReposition = () => syncListPosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, portaled, syncListPosition]);

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
      openList();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      openList();
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
      closeList();
    }
  }

  const showList = open && !disabled;
  const inputValue = open ? query : closedLabel;

  function openList(seed?: string) {
    if (disabled) return;
    setOpen(true);
    setQuery(seed ?? closedLabel);
    if (portaled) syncListPosition();
  }

  function closeList() {
    setOpen(false);
    setQuery("");
  }

  function scheduleCloseUnlessFocusedInMenu() {
    const pendingQuery = query;
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      const listEl = document.getElementById(listId);
      if (rootRef.current?.contains(active)) return;
      if (listEl?.contains(active)) return;
      if (commitOnBlur) {
        const text = pendingQuery.trim();
        if (text) onChange(text);
        else if (onClear && !value && !savedLabel?.trim()) onClear();
      }
      closeList();
    });
  }

  const listbox = (
    <ul
      id={listId}
      role="listbox"
      className={listClassName ?? (portaled ? listboxClass : `absolute z-[250] mt-1 w-full ${listboxClass}`)}
      style={portaled ? listStyle : undefined}
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
  );

  return (
    <div ref={rootRef} className="relative">
      <label className={labelClassName}>
        {label}
        <div className="relative">
          <input
            ref={inputRef}
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
              const next = e.target.value;
              setQuery(next);
              if (!open) {
                setOpen(true);
                if (portaled) syncListPosition();
              }
            }}
            onFocus={() => {
              openList(closedLabel);
            }}
            onBlur={scheduleCloseUnlessFocusedInMenu}
            onKeyDown={onInputKeyDown}
          />
          {(value || savedLabel) && onClear && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={`Clear ${label}`}
            >
              ×
            </button>
          ) : (
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onMouseDown={(e) => {
                e.preventDefault();
                if (open) closeList();
                else openList(closedLabel);
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
              aria-label={`Open ${label}`}
            >
              ▾
            </button>
          )}
        </div>
      </label>
      {showList && portaled && portalMounted
        ? createPortal(listbox, document.body)
        : showList
          ? listbox
          : null}
    </div>
  );
}
