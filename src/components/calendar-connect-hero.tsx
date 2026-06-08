"use client";

import { CoverPreviewShell, OpsSectionCover } from "@/components/ops-section-cover";

type Props = {
  onAddEvent: () => void;
  gmailConnected?: boolean;
  gmailEmail?: string | null;
};

export function CalendarConnectHero({ onAddEvent, gmailConnected, gmailEmail }: Props) {
  return (
    <OpsSectionCover
      headline={
        <>
          Plan the floor in <span className="text-[#7c3aed]">one view</span>
        </>
      }
      subhead={
        gmailConnected
          ? `Showing events from ${gmailEmail ?? "your Google account"} — same connection as Mailroom Gmail.`
          : "Lane-based day view for receiving, production meetings, ship dates, and blocks — connect Gmail in Mailroom to sync Google Calendar."
      }
      cards={[
        {
          title: "Department lanes",
          description: "Events sit in columns by department — Receiving, Production, Shipping, and more — for at-a-glance capacity.",
          preview: (
            <CoverPreviewShell>
              <div className="flex gap-1 text-[9px] font-semibold text-slate-500">
                {["Receiving", "Production", "Shipping"].map((d) => (
                  <div key={d} className="flex-1 truncate rounded bg-slate-50 px-1 py-0.5 text-center">
                    {d}
                  </div>
                ))}
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Time blocks and meetings",
          description: "Add events with start/end times, PO references, and notes. Block lanes when a resource is unavailable.",
          preview: (
            <CoverPreviewShell>
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 text-left">
                <p className="text-[10px] font-semibold text-violet-800">Production meeting</p>
                <p className="text-[9px] text-violet-600">10:00 – 11:00</p>
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Navigate by day",
          description: "Step through days to see what’s coming up. Today’s column highlights current events in real time.",
          preview: (
            <CoverPreviewShell>
              <div className="flex justify-between text-[10px] font-medium text-slate-500">
                <span>← Prev</span>
                <span className="font-bold text-slate-800">Wed, May 14</span>
                <span>Next →</span>
              </div>
            </CoverPreviewShell>
          ),
        },
      ]}
      primaryAction={{ label: "Add event", onClick: onAddEvent }}
    />
  );
}
