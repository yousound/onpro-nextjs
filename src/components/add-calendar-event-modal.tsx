"use client";

import type { FormEvent } from "react";
import { useEffect } from "react";
import type { CalendarEvent } from "@/lib/types/calendar";
import { CALENDAR_COLUMN_ORDER } from "@/lib/calendar-utils";
import { MOCK_LS } from "@/lib/mock-local";
import {
  CalendarIcon,
  HashIcon,
  NotesIcon,
  ProjectModalAside,
  ProjectModalBadge,
  ProjectModalField,
  ProjectModalOverlay,
  ProjectModalPanelFooter,
  ProjectModalPanelHeader,
  projectModalFieldClass,
  projectModalTextareaClass,
} from "@/components/project-modal-ui";

export type CalendarEventDraft = {
  title: string;
  type: NonNullable<CalendarEvent["event_type"]>;
  dept: string;
  date: string;
  start: string;
  end: string;
  desc: string;
  po: string;
  block: boolean;
};

function CalendarBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14v10zM7 12h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
    </svg>
  );
}

type Props = {
  draft: CalendarEventDraft;
  onChange: (patch: Partial<CalendarEventDraft>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  overlayClassName?: string;
};

export function AddCalendarEventModal({
  draft,
  onChange,
  onSubmit,
  onClose,
  overlayClassName = "z-[150]",
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = Boolean(draft.title.trim());

  return (
    <ProjectModalOverlay
      titleId="add-calendar-event-title"
      onClose={onClose}
      overlayClassName={overlayClassName}
      aside={
        <ProjectModalAside
          badge={
            <ProjectModalBadge>
              <CalendarBadgeIcon />
            </ProjectModalBadge>
          }
          title={
            <>
              Block time on
              <br />
              the floor.
            </>
          }
          body={`Place meetings, shipments, and lane blocks on the ops calendar. Saved in this browser (${MOCK_LS.calendarEvents}).`}
        />
      }
    >
      <ProjectModalPanelHeader
        title="Add event"
        subtitle="Click the schedule grid to prefill lane and time."
        onClose={onClose}
      />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <ProjectModalField label="Title" icon={<NotesIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="e.g. TOP review — Void Star"
              required
              autoComplete="off"
              autoFocus
            />
          </ProjectModalField>

          <div className="grid gap-4 sm:grid-cols-2">
            <ProjectModalField label="Type">
              <select
                className={projectModalFieldClass}
                value={draft.type}
                disabled={draft.block}
                onChange={(e) =>
                  onChange({ type: e.target.value as NonNullable<CalendarEvent["event_type"]> })
                }
              >
                <option value="shipping">Shipping</option>
                <option value="meeting">Meeting</option>
                <option value="deadline">Deadline</option>
                <option value="sample_review">Sample review</option>
                <option value="production">Production</option>
                <option value="other">Other</option>
              </select>
            </ProjectModalField>

            <ProjectModalField label="Lane">
              <select
                className={projectModalFieldClass}
                value={draft.dept}
                onChange={(e) => onChange({ dept: e.target.value })}
              >
                {CALENDAR_COLUMN_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </ProjectModalField>
          </div>

          <ProjectModalField label="Day" icon={<CalendarIcon />}>
            <input
              type="date"
              required
              className={projectModalFieldClass}
              value={draft.date}
              onChange={(e) => onChange({ date: e.target.value })}
            />
          </ProjectModalField>

          <div className="grid gap-4 sm:grid-cols-2">
            <ProjectModalField label="Start">
              <input
                type="time"
                required
                className={projectModalFieldClass}
                value={draft.start}
                onChange={(e) => onChange({ start: e.target.value })}
              />
            </ProjectModalField>
            <ProjectModalField label="End">
              <input
                type="time"
                required
                className={projectModalFieldClass}
                value={draft.end}
                onChange={(e) => onChange({ end: e.target.value })}
              />
            </ProjectModalField>
          </div>

          <ProjectModalField label="PO (optional)" icon={<HashIcon />}>
            <input
              className={projectModalFieldClass}
              value={draft.po}
              onChange={(e) => onChange({ po: e.target.value })}
              placeholder="PO-…"
              autoComplete="off"
            />
          </ProjectModalField>

          <ProjectModalField label="Description">
            <textarea
              rows={2}
              className={projectModalTextareaClass}
              value={draft.desc}
              onChange={(e) => onChange({ desc: e.target.value })}
            />
          </ProjectModalField>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={draft.block}
              onChange={(e) => onChange({ block: e.target.checked })}
              className="size-4 rounded border-slate-300 text-[#7c3aed] focus:ring-[#7c3aed]/30"
            />
            Blocked lane (striped on grid)
          </label>
        </div>

        <ProjectModalPanelFooter
          secondaryLabel="Cancel"
          onSecondary={onClose}
          primaryLabel="Save to calendar"
          primaryDisabled={!canSave}
        />
      </form>
    </ProjectModalOverlay>
  );
}
