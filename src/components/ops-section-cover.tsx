"use client";

import type { ReactNode } from "react";

export type OpsSectionCoverCard = {
  title: string;
  description: string;
  preview: ReactNode;
};

type Props = {
  headline: ReactNode;
  subhead: string;
  cards: OpsSectionCoverCard[];
  primaryAction?: { label: string; onClick: () => void; icon?: ReactNode };
  secondaryAction?: { label: string; onClick: () => void; icon?: ReactNode };
  dismissAction?: { label: string; onClick: () => void };
};

const PREVIEW_SLOT_CLASS = "mt-auto flex h-[5.75rem] w-full pt-4";

export function OpsSectionCover({
  headline,
  subhead,
  cards,
  primaryAction,
  secondaryAction,
  dismissAction,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 py-10 text-center sm:px-10 sm:py-14">
        {dismissAction ? (
          <div className="mb-4 w-full max-w-5xl text-right">
            <button
              type="button"
              onClick={dismissAction.onClick}
              className="text-sm font-semibold text-[#7c3aed] hover:underline"
            >
              {dismissAction.label}
            </button>
          </div>
        ) : null}

        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {headline}
        </h2>

        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-[17px]">
          {subhead}
        </p>

        <div className="mt-12 grid w-full grid-cols-1 gap-5 lg:grid-cols-3 lg:items-stretch lg:gap-6">
          {cards.map((card) => (
            <article
              key={card.title}
              className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white px-5 pb-5 pt-5 text-left shadow-sm"
            >
              <h3 className="text-base font-bold leading-snug text-slate-900">{card.title}</h3>
              <p className="mt-2 h-[4.75rem] overflow-hidden text-sm leading-relaxed text-slate-500 line-clamp-4">
                {card.description}
              </p>
              <div className={PREVIEW_SLOT_CLASS}>{card.preview}</div>
            </article>
          ))}
        </div>

        {primaryAction || secondaryAction ? (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {primaryAction ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="inline-flex items-center gap-2.5 rounded-xl bg-[#7c3aed] px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:bg-[#6d28d9]"
              >
                {primaryAction.icon}
                {primaryAction.label}
              </button>
            ) : null}
            {secondaryAction ? (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CoverPreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {children}
    </div>
  );
}
