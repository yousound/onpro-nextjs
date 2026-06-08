"use client";

import type { ReactNode, RefObject } from "react";

export type ModalSectionItem = { id: string; label: string };

type ModalSectionNavVariant = "default" | "polished";
type ModalSectionNavTone = "panel" | "aside";

function sidebarNavButtonClass(
  isActive: boolean,
  variant: ModalSectionNavVariant,
  tone: ModalSectionNavTone,
): string {
  if (tone === "aside") {
    return isActive
      ? "bg-white/95 text-[#5b21b6] shadow-sm ring-1 ring-violet-200/80"
      : "text-violet-900/80 hover:bg-white/55 hover:text-violet-950";
  }
  const polished = variant === "polished";
  return isActive
    ? polished
      ? "bg-violet-100 text-[#5b21b6] ring-1 ring-violet-200"
      : "bg-accent/10 text-accent ring-1 ring-accent/30"
    : polished
      ? "text-slate-600 hover:bg-violet-50 hover:text-violet-900"
      : "text-text-secondary hover:bg-slate-100 hover:text-text-primary";
}

export function ModalSectionNavList({
  sections,
  activeSection,
  onSectionChange,
  navLabel = "Form sections",
  variant = "default",
  tone = "panel",
}: {
  sections: ModalSectionItem[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  navLabel?: string;
  variant?: ModalSectionNavVariant;
  tone?: ModalSectionNavTone;
}) {
  return (
    <nav aria-label={navLabel} className="space-y-0.5">
      {sections.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSectionChange(id)}
          className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${sidebarNavButtonClass(activeSection === id, variant, tone)}`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function ModalSectionMobileNav({
  sections,
  activeSection,
  onSectionChange,
  navLabel,
  variant,
}: {
  sections: ModalSectionItem[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  navLabel: string;
  variant: ModalSectionNavVariant;
}) {
  const polished = variant === "polished";
  return (
    <nav
      aria-label={navLabel}
      className="-mx-1 mb-4 flex flex-wrap gap-1.5 overflow-x-auto pb-1 sm:hidden"
    >
      {sections.map(({ id, label }) => {
        const isActive = activeSection === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
              isActive
                ? polished
                  ? "bg-[#7c3aed] text-white ring-[#7c3aed]"
                  : "bg-accent text-white ring-accent"
                : polished
                  ? "bg-violet-50 text-slate-600 ring-violet-100 hover:text-violet-900"
                  : "bg-slate-100 text-text-secondary ring-border-light hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function ModalSectionLayout({
  sections,
  activeSection,
  onSectionChange,
  children,
  navLabel = "Form sections",
  variant = "default",
  contentRef,
  sidebar = "inline",
}: {
  sections: ModalSectionItem[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  children: ReactNode;
  navLabel?: string;
  variant?: ModalSectionNavVariant;
  contentRef?: RefObject<HTMLDivElement | null>;
  /** `none` — nav lives elsewhere (e.g. modal aside); content uses full panel width on desktop. */
  sidebar?: "inline" | "none";
}) {
  const polished = variant === "polished";
  const showInlineSidebar = sidebar === "inline";

  return (
    <div className="flex min-h-0 flex-1">
      {showInlineSidebar ? (
        <aside
          className={`hidden w-52 shrink-0 overflow-y-auto border-r py-3 sm:block ${
            polished ? "border-slate-100 bg-violet-50/40" : "border-border-light bg-surface-body/40"
          }`}
        >
          <div className="px-2">
            <ModalSectionNavList
              sections={sections}
              activeSection={activeSection}
              onSectionChange={onSectionChange}
              navLabel={navLabel}
              variant={variant}
              tone="panel"
            />
          </div>
        </aside>
      ) : null}

      <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        <ModalSectionMobileNav
          sections={sections}
          activeSection={activeSection}
          onSectionChange={onSectionChange}
          navLabel={navLabel}
          variant={variant}
        />
        {children}
      </div>
    </div>
  );
}

export function ModalSectionPanel({
  sectionId,
  activeSection,
  children,
}: {
  sectionId: string;
  activeSection: string;
  children: ReactNode;
}) {
  return (
    <div hidden={activeSection !== sectionId} className="space-y-4">
      {children}
    </div>
  );
}
