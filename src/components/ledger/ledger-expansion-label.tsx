"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  EXPANSION_TOOLTIPS,
  type ExpansionTooltipContent,
} from "@/lib/ledger/expansion-tooltips";

function tooltipWidth(wide: boolean): number {
  return wide ? Math.min(typeof window !== "undefined" ? window.innerWidth - 16 : 352, 352) : 320;
}

function ExpansionTooltipPanel({
  tip,
  wide,
  top,
  left,
}: {
  tip: ExpansionTooltipContent;
  wide: boolean;
  top: number;
  left: number;
}) {
  const w = tooltipWidth(wide);

  return (
    <div
      role="tooltip"
      className="fixed z-[200] rounded-lg border border-border-light bg-white p-3 text-left text-sm font-normal normal-case leading-snug tracking-normal text-text-secondary shadow-lg"
      style={{ top, left, width: w }}
    >
      <span className="block text-sm font-semibold text-text-primary">{tip.title}</span>
      <span className="mt-1 block">{tip.summary}</span>
      {tip.sections ? (
        <div className="mt-2 space-y-2">
          {tip.sections.map((sec) => (
            <div key={sec.heading}>
              <span className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
                {sec.heading}
              </span>
              <ul className="mt-0.5 list-inside list-disc space-y-0.5">
                {sec.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : tip.examples ? (
        <>
          <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Examples
          </span>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {tip.examples.map((ex) => (
              <li key={ex}>{ex}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function LedgerExpansionLabel({ id, label }: { id: string; label: string }) {
  const tip = EXPANSION_TOOLTIPS[id];
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wide = (tip?.sections?.length ?? 0) > 2;

  const updatePosition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = tooltipWidth(wide);
    let left = rect.left;
    const top = rect.bottom + 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (left < 8) left = 8;
    setCoords({ top, left });
  }, [wide]);

  const show = () => {
    updatePosition();
    setOpen(true);
  };

  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, updatePosition]);

  if (!tip) return <>{label}</>;

  return (
    <>
      <span
        className="inline-flex items-center gap-1.5"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <span>{label}</span>
        <button
          ref={btnRef}
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-light bg-surface-body text-[10px] font-bold leading-none text-text-secondary hover:border-accent hover:text-accent"
          aria-label={`About ${tip.title}`}
          onFocus={show}
          onBlur={hide}
        >
          i
        </button>
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <ExpansionTooltipPanel tip={tip} wide={wide} top={coords.top} left={coords.left} />,
            document.body,
          )
        : null}
    </>
  );
}
