"use client";

import type { ReactNode } from "react";
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
}) {
  const { title, subtitle, action, kpis, variant = "light", showNotifications = true } = props;
  const light = variant === "light";
  const toneClass = light ? toneClassLight : toneClassDark;

  return (
    <div
      className={
        light
          ? "border-b border-border-light bg-white px-6 py-6 text-text-primary shadow-sm"
          : "border-b border-border-subtle bg-chrome-dark px-6 py-6 text-text-on-chrome"
      }
    >
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
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
                <NotificationsPopover buttonClassName={PAGE_HEADER_NOTIFICATIONS_CLASS} />
              ) : null}
            </div>
          ) : null}
        </div>
        {kpis && kpis.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((k) => (
              <div
                key={k.label}
                title={k.hint}
                className={
                  light
                    ? "rounded-xl border border-slate-300 bg-white px-4 py-3"
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
                <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass[k.tone ?? "default"]}`}>
                  {k.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
