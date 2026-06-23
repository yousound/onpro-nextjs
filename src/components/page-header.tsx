"use client";

import type { ReactNode } from "react";
import {
  AssistantQuickOpenButton,
  PAGE_HEADER_ASSISTANT_CLASS,
} from "@/components/assistant-quick-open-button";
import { NotificationsPopover } from "@/components/notifications-popover";

export const PAGE_HEADER_NOTIFICATIONS_CLASS =
  "relative flex h-10 w-10 items-center justify-center rounded-xl border border-border-light bg-white text-text-secondary shadow-sm transition hover:bg-surface-body";

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "bad" | "accent";
};

const toneClassDark: Record<NonNullable<Kpi["tone"]>, string> = {
  default: "text-text-on-chrome",
  ok: "text-health-ok",
  warn: "text-health-warn",
  bad: "text-health-bad",
  accent: "text-accent",
};

const toneClassLight: Record<NonNullable<Kpi["tone"]>, string> = {
  default: "text-text-primary",
  ok: "text-health-ok",
  warn: "text-health-warn",
  bad: "text-health-bad",
  accent: "text-accent",
};

export function PageHeader(props: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  kpis?: Kpi[];
  variant?: "dark" | "light";
  showNotifications?: boolean;
  /** When set, the page title toggles views (e.g. Mailroom cover ↔ inbox). */
  onTitleClick?: () => void;
  titleClickLabel?: string;
  /** Info control beside the title — opens section overview / cover. */
  onInfoClick?: () => void;
  infoLabel?: string;
  /** Grey canvas below title — KPI tiles sit on surface-body so white cards pop. */
  contentCanvas?: boolean;
}) {
  const {
    title,
    subtitle,
    action,
    kpis,
    variant = "light",
    showNotifications = true,
    onTitleClick,
    titleClickLabel,
    onInfoClick,
    infoLabel,
    contentCanvas = false,
  } = props;
  const light = variant === "light";
  const toneClass = light ? toneClassLight : toneClassDark;

  const titleBlock = (
    <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {onTitleClick ? (
                <button
                  type="button"
                  onClick={onTitleClick}
                  aria-label={titleClickLabel ?? title}
                  className="text-left text-2xl font-bold tracking-tight transition hover:text-accent md:text-3xl"
                >
                  {title}
                </button>
              ) : (
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
              )}
              {onInfoClick ? (
                <button
                  type="button"
                  onClick={onInfoClick}
                  aria-label={infoLabel ?? `About ${title}`}
                  title={infoLabel ?? `About ${title}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-light bg-white text-slate-500 shadow-sm transition hover:bg-surface-body hover:text-accent"
                >
                  <HeaderInfoIcon />
                </button>
              ) : null}
            </div>
            {subtitle ? (
              <p className={`mt-1 max-w-2xl text-sm ${light ? "text-text-secondary" : "text-text-muted-chrome"}`}>
                {subtitle}
              </p>
            ) : null}
          </div>
          {action || showNotifications ? (
            <div className="flex shrink-0 items-center gap-2">
              {action}
              {showNotifications ? (
                <>
                  <AssistantQuickOpenButton buttonClassName={PAGE_HEADER_ASSISTANT_CLASS} />
                  <NotificationsPopover buttonClassName={PAGE_HEADER_NOTIFICATIONS_CLASS} />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
  );

  const kpiBlock =
    kpis && kpis.length > 0 ? (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => {
          const tone = k.tone ?? "default";
          return (
            <div
              key={k.label}
              title={k.hint}
              className={
                light
                  ? "rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm"
                  : "rounded-xl border border-border-subtle bg-chrome-elevated/60 px-4 py-3"
              }
            >
              <div
                className={`text-xs font-medium uppercase tracking-wide ${
                  light ? "text-text-secondary" : "text-text-muted-chrome"
                }`}
              >
                {k.label}
              </div>
              <div
                className={`mt-0.5 text-2xl font-bold tabular-nums ${toneClass[tone]}`}
                suppressHydrationWarning
              >
                {k.value}
              </div>
            </div>
          );
        })}
      </div>
    ) : null;

  if (contentCanvas && light) {
    return (
      <div className="shrink-0 bg-surface-body px-6 pb-2 pt-6 text-text-primary">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
          {titleBlock}
          {kpiBlock}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        light
          ? "border-b border-border-light bg-white px-6 py-6 text-text-primary shadow-sm"
          : "border-b border-border-subtle bg-chrome-dark px-6 py-6 text-text-on-chrome"
      }
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        {titleBlock}
        {kpiBlock}
      </div>
    </div>
  );
}

function HeaderInfoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6M12 7h.01" strokeLinecap="round" />
    </svg>
  );
}
