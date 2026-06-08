"use client";

import type { EmailSummaryItem } from "@/lib/assistant-email-summary";
import { formatEmailSummaryDate } from "@/lib/assistant-email-summary";

type Props = {
  items: EmailSummaryItem[];
  intro?: string | null;
};

export function AssistantEmailSummaryCards({ items, intro }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {intro ? (
        <p className="text-sm leading-relaxed text-slate-700">{intro}</p>
      ) : null}
      <ol className="space-y-2.5">
        {items.map((item) => (
          <li
            key={`${item.index}-${item.subject.slice(0, 24)}`}
            className="rounded-xl border border-violet-100/90 bg-gradient-to-br from-white to-violet-50/40 px-3.5 py-3 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-sm"
                aria-hidden
              >
                {item.index}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug text-slate-900">{item.subject}</p>
                <p className="mt-1.5 inline-flex items-center rounded-md bg-slate-100/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {formatEmailSummaryDate(item.date)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summary}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
