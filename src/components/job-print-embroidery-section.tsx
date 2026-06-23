"use client";

import { useState } from "react";
import type { ApprovalStatus } from "@/lib/types/project";
import type { PrintEmbroideryCostingTrack } from "@/lib/types/project";
import type { Contact } from "@/lib/types/contact";
import { CollapsibleLineCard } from "@/components/collapsible-line-card";
import { VendorFieldSelect } from "@/components/vendor-select";
import { defaultPrintEmbroideryTrack, updatePrintEmbTrack } from "@/lib/project-repeatable-tracks";
import { dateInputToIso, isoToDateInput } from "@/lib/format";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

function printLineSummary(track: PrintEmbroideryCostingTrack): string {
  const parts: string[] = [];
  if (track.print_embroidery_vendor?.trim()) parts.push(track.print_embroidery_vendor.trim());
  if (track.strike_off_approval_status) parts.push(track.strike_off_approval_status);
  return parts.length > 0 ? parts.join(" · ") : "No vendor or dates yet";
}

export function JobPrintEmbroiderySection({
  tracks,
  vendors,
  fieldClass,
  onChange,
}: {
  tracks: PrintEmbroideryCostingTrack[];
  vendors: Contact[];
  fieldClass: string;
  onChange: (tracks: PrintEmbroideryCostingTrack[]) => void;
}) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addLine() {
    const track = defaultPrintEmbroideryTrack();
    onChange([...tracks, track]);
    setOpenIds((prev) => new Set(prev).add(track.id));
  }

  return (
    <div className="space-y-3">
      {tracks.length === 0 ? (
        <p className="text-sm text-slate-500">No print or embroidery lines yet.</p>
      ) : (
        tracks.map((t, i) => (
          <CollapsibleLineCard
            key={t.id}
            title={tracks.length > 1 ? `Print line ${i + 1}` : "Print line"}
            subtitle={printLineSummary(t)}
            open={openIds.has(t.id)}
            onToggle={() => toggle(t.id)}
            onRemove={() => onChange(tracks.filter((x) => x.id !== t.id))}
          >
            <div className="space-y-3">
              <VendorFieldSelect
                label="Vendor"
                vendors={vendors}
                value={t.print_embroidery_vendor}
                onChange={(name) =>
                  onChange(updatePrintEmbTrack(tracks, t.id, { print_embroidery_vendor: name }))
                }
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className={labelClass}>
                  Strike off requested
                  <input
                    type="date"
                    className={fieldClass}
                    value={isoToDateInput(t.strike_off_request_date)}
                    onChange={(e) =>
                      onChange(
                        updatePrintEmbTrack(tracks, t.id, {
                          strike_off_request_date: dateInputToIso(e.target.value),
                        }),
                      )
                    }
                  />
                </label>
                <label className={labelClass}>
                  Strike off due
                  <input
                    type="date"
                    className={fieldClass}
                    value={isoToDateInput(t.strike_off_due_date)}
                    onChange={(e) =>
                      onChange(
                        updatePrintEmbTrack(tracks, t.id, {
                          strike_off_due_date: dateInputToIso(e.target.value),
                        }),
                      )
                    }
                  />
                </label>
                <label className={labelClass}>
                  Strike off received
                  <input
                    type="date"
                    className={fieldClass}
                    value={isoToDateInput(t.strike_off_received_date)}
                    onChange={(e) =>
                      onChange(
                        updatePrintEmbTrack(tracks, t.id, {
                          strike_off_received_date: dateInputToIso(e.target.value),
                        }),
                      )
                    }
                  />
                </label>
              </div>
              <label className={labelClass}>
                Strike off status
                <select
                  className={fieldClass}
                  value={t.strike_off_approval_status ?? "PENDING"}
                  onChange={(e) =>
                    onChange(
                      updatePrintEmbTrack(tracks, t.id, {
                        strike_off_approval_status: e.target.value as ApprovalStatus,
                      }),
                    )
                  }
                >
                  {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </CollapsibleLineCard>
        ))
      )}
      <button
        type="button"
        onClick={addLine}
        className="w-full rounded-xl border border-dashed border-[#7c3aed]/45 py-2.5 text-sm font-semibold text-[#7c3aed] hover:bg-violet-50/90"
      >
        + Add print / embroidery line
      </button>
    </div>
  );
}
