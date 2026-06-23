"use client";

import { useState } from "react";
import type { Colorway, Sample, SampleStatus, SampleType } from "@/lib/types/project";
import { CollapsibleLineCard } from "@/components/collapsible-line-card";
import { dateInputToIso, isoToDateInput } from "@/lib/format";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

const SAMPLE_TYPE_OPTIONS: SampleType[] = [
  "1ST SAMPLE",
  "2ND SAMPLE",
  "3RD SAMPLE",
  "PP SAMPLE",
  "2ND PP SAMPLE",
];

const SAMPLE_STATUS_OPTIONS: SampleStatus[] = [
  "PENDING",
  "RECEIVED",
  "APPROVED",
  "REJECTED",
  "IN REVIEW",
];

function nextSampleType(samples: Sample[]): SampleType {
  const used = new Set(samples.map((s) => s.type));
  return SAMPLE_TYPE_OPTIONS.find((t) => !used.has(t)) ?? "1ST SAMPLE";
}

function colorwaySummary(cw: Colorway): string {
  if (cw.samples.length === 0) return "No samples yet";
  const n = cw.samples.length;
  return `${n} sample${n === 1 ? "" : "s"}`;
}

function sampleSummary(sample: Sample): string {
  const parts: string[] = [sample.type];
  if (sample.status) parts.push(sample.status);
  return parts.join(" · ");
}

export function JobCutSewSamplesSection({
  colorways,
  fieldClass,
  textareaClass,
  onChange,
}: {
  colorways: Colorway[];
  fieldClass: string;
  textareaClass: string;
  onChange: (colorways: Colorway[]) => void;
}) {
  const [openColorwayIds, setOpenColorwayIds] = useState<Set<number>>(() => new Set());
  const [openSampleKeys, setOpenSampleKeys] = useState<Set<string>>(() => new Set());

  function toggleColorway(id: number) {
    setOpenColorwayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSample(colorwayId: number, sampleId: number) {
    const key = `${colorwayId}:${sampleId}`;
    setOpenSampleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function patchColorway(colorwayId: number, partial: Partial<Colorway>) {
    onChange(colorways.map((cw) => (cw.id === colorwayId ? { ...cw, ...partial } : cw)));
  }

  function patchSample(colorwayId: number, sampleId: number, partial: Partial<Sample>) {
    onChange(
      colorways.map((cw) =>
        cw.id !== colorwayId
          ? cw
          : {
              ...cw,
              samples: cw.samples.map((s) => (s.id === sampleId ? { ...s, ...partial } : s)),
            },
      ),
    );
  }

  function addColorway() {
    const maxId = colorways.reduce((m, c) => Math.max(m, c.id), 0);
    const id = maxId + 1;
    onChange([...colorways, { id, name: `Colorway ${colorways.length + 1}`, samples: [] }]);
    setOpenColorwayIds((prev) => new Set(prev).add(id));
  }

  function addSample(colorwayId: number) {
    const cw = colorways.find((c) => c.id === colorwayId);
    if (!cw) return;
    const maxId = colorways.flatMap((c) => c.samples).reduce((m, s) => Math.max(m, s.id), 0);
    const sampleId = maxId + 1;
    patchColorway(colorwayId, {
      samples: [
        ...cw.samples,
        {
          id: sampleId,
          type: nextSampleType(cw.samples),
          status: "PENDING",
          requested_date: null,
          due_date: null,
          received_date: null,
          comments_sent_date: null,
          comments: null,
        },
      ],
    });
    setOpenSampleKeys((prev) => new Set(prev).add(`${colorwayId}:${sampleId}`));
  }

  return (
    <div className="space-y-3">
      {colorways.length === 0 ? (
        <p className="text-sm text-slate-500">No colorways yet.</p>
      ) : (
        colorways.map((cw, i) => (
          <CollapsibleLineCard
            key={cw.id}
            title={cw.name.trim() || `Colorway ${i + 1}`}
            subtitle={colorwaySummary(cw)}
            open={openColorwayIds.has(cw.id)}
            onToggle={() => toggleColorway(cw.id)}
            onRemove={() => onChange(colorways.filter((c) => c.id !== cw.id))}
          >
            <div className="space-y-3">
              <label className={labelClass}>
                Colorway name
                <input
                  className={fieldClass}
                  value={cw.name}
                  onChange={(e) => patchColorway(cw.id, { name: e.target.value })}
                />
              </label>

              {cw.samples.length === 0 ? (
                <p className="text-sm text-slate-500">No samples yet.</p>
              ) : (
                <div className="space-y-2">
                  {cw.samples.map((s) => {
                    const sampleKey = `${cw.id}:${s.id}`;
                    return (
                      <CollapsibleLineCard
                        key={s.id}
                        title={s.type}
                        subtitle={sampleSummary(s)}
                        open={openSampleKeys.has(sampleKey)}
                        onToggle={() => toggleSample(cw.id, s.id)}
                        onRemove={() =>
                          patchColorway(cw.id, { samples: cw.samples.filter((x) => x.id !== s.id) })
                        }
                        removeLabel="Remove sample"
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className={labelClass}>
                            Sample stage
                            <select
                              className={fieldClass}
                              value={s.type}
                              onChange={(e) =>
                                patchSample(cw.id, s.id, { type: e.target.value as SampleType })
                              }
                            >
                              {SAMPLE_TYPE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={labelClass}>
                            Status
                            <select
                              className={fieldClass}
                              value={s.status}
                              onChange={(e) =>
                                patchSample(cw.id, s.id, { status: e.target.value as SampleStatus })
                              }
                            >
                              {SAMPLE_STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={labelClass}>
                            Requested
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(s.requested_date)}
                              onChange={(e) =>
                                patchSample(cw.id, s.id, {
                                  requested_date: dateInputToIso(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className={labelClass}>
                            Due
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(s.due_date)}
                              onChange={(e) =>
                                patchSample(cw.id, s.id, { due_date: dateInputToIso(e.target.value) })
                              }
                            />
                          </label>
                          <label className={labelClass}>
                            Received
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(s.received_date)}
                              onChange={(e) =>
                                patchSample(cw.id, s.id, {
                                  received_date: dateInputToIso(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className={labelClass}>
                            Comments sent
                            <input
                              type="date"
                              className={fieldClass}
                              value={isoToDateInput(s.comments_sent_date)}
                              onChange={(e) =>
                                patchSample(cw.id, s.id, {
                                  comments_sent_date: dateInputToIso(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className={`${labelClass} sm:col-span-2`}>
                            Comments
                            <textarea
                              className={textareaClass}
                              rows={2}
                              value={s.comments ?? ""}
                              onChange={(e) =>
                                patchSample(cw.id, s.id, {
                                  comments: e.target.value.trim() || null,
                                })
                              }
                            />
                          </label>
                        </div>
                      </CollapsibleLineCard>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => addSample(cw.id)}
                className="text-xs font-semibold text-[#7c3aed] hover:underline"
              >
                + Add sample
              </button>
            </div>
          </CollapsibleLineCard>
        ))
      )}
      <button
        type="button"
        onClick={addColorway}
        className="w-full rounded-xl border border-dashed border-[#7c3aed]/45 py-2.5 text-sm font-semibold text-[#7c3aed] hover:bg-violet-50/90"
      >
        + Add colorway
      </button>
    </div>
  );
}
