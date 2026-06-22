"use client";

import { useMemo, useState } from "react";
import { AddVendorModal } from "@/components/add-contact-modals";
import { VendorFieldSelect } from "@/components/vendor-select";
import { addJobVendorName, removeJobVendorName } from "@/lib/job-vendors";
import { vendorDisplayName } from "@/lib/contacts-store";
import type { Contact } from "@/lib/types/contact";

export function JobVendorsSection({
  assignedNames,
  allVendors,
  leadVendor,
  onChange,
  onLeadVendorChange,
}: {
  assignedNames: string[];
  allVendors: Contact[];
  leadVendor?: string;
  onChange: (names: string[]) => void;
  onLeadVendorChange?: (name: string) => void;
}) {
  const [pickDraft, setPickDraft] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const availableToAdd = useMemo(() => {
    const assigned = new Set(assignedNames.map((n) => n.trim().toLowerCase()));
    return allVendors.filter((v) => !assigned.has(vendorDisplayName(v).trim().toLowerCase()));
  }, [allVendors, assignedNames]);

  function handlePick(name: string | null) {
    if (!name?.trim()) return;
    const next = addJobVendorName(assignedNames, name);
    onChange(next);
    if (!leadVendor?.trim() && onLeadVendorChange) {
      onLeadVendorChange(name.trim());
    }
    setPickDraft(null);
  }

  function handleRemove(name: string) {
    const next = removeJobVendorName(assignedNames, name);
    onChange(next);
    if (leadVendor?.trim() && leadVendor.trim().toLowerCase() === name.trim().toLowerCase()) {
      onLeadVendorChange?.(next[0] ?? "");
    }
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">
          Assign vendors from <strong>People</strong> to this job. They appear in quote requests,
          costing lines, and PO send. Add new vendors here or under People → Vendors.
        </p>

        {assignedNames.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {assignedNames.map((name) => {
              const isLead =
                leadVendor?.trim().toLowerCase() === name.trim().toLowerCase();
              return (
                <li
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1.5 pl-3 pr-1.5 text-sm font-semibold text-text-primary"
                >
                  <span>{name}</span>
                  {isLead ? (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      Supplier
                    </span>
                  ) : onLeadVendorChange ? (
                    <button
                      type="button"
                      onClick={() => onLeadVendorChange(name)}
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-text-secondary hover:bg-white"
                      title="Set as primary supplier on job details"
                    >
                      Set supplier
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleRemove(name)}
                    className="rounded-full px-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                    aria-label={`Remove ${name}`}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border-light bg-slate-50/80 px-4 py-4 text-sm text-text-secondary">
            No vendors on this job yet. Add from your contacts below.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <VendorFieldSelect
              label="Add from contacts"
              vendors={availableToAdd}
              value={pickDraft}
              onChange={handlePick}
              emptyLabel="Pick a vendor…"
            />
          </div>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="shrink-0 rounded-lg border border-accent/40 px-3 py-2 text-sm font-semibold text-accent hover:bg-violet-50"
          >
            + New vendor
          </button>
        </div>
      </div>

      {addModalOpen ? (
        <AddVendorModal
          onClose={() => setAddModalOpen(false)}
          onSaved={(saved) => {
            setAddModalOpen(false);
            if (!saved) return;
            const name = vendorDisplayName(saved);
            const next = addJobVendorName(assignedNames, name);
            onChange(next);
            if (!leadVendor?.trim() && onLeadVendorChange) {
              onLeadVendorChange(name);
            }
          }}
        />
      ) : null}
    </>
  );
}
