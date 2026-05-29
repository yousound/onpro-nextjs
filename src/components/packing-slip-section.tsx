"use client";

import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/searchable-select";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";
import type { PackingSlipDocument, PackingSlipLine } from "@/lib/types/packing-slip";
import { loadContacts } from "@/lib/contacts-store";
import { loadProjectJobs } from "@/lib/project-wip-edits";
import {
  buildPackingSlipLinesFromJobs,
  createPackingSlipDraft,
  exportPackingSlipCsv,
  packingSlipCompanyName,
  totalPieces,
} from "@/lib/packing-slip";
import {
  applyCompanyContact,
  applyShipFromContact,
  applyShipToContact,
  findPackingContactById,
  packingContactLabel,
  packingContactSelectValue,
  packingSlipContactOptions,
} from "@/lib/packing-slip-contacts";
import { dateInputToIso, formatShortDate, isoToDateInput } from "@/lib/format";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border-light px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const labelClass = "block text-xs font-medium text-text-secondary";

function cloneSlip(slip: PackingSlipDocument): PackingSlipDocument {
  return {
    ...slip,
    lines: slip.lines.map((l) => ({ ...l })),
  };
}

const DEFAULT_FROM_ADDRESS = "456 Industrial Blvd, Los Angeles, CA 90001";

function PackingContactSelect({
  label,
  contacts,
  options,
  contactId,
  savedName,
  emptyLabel,
  onSelect,
}: {
  label: string;
  contacts: Contact[];
  options: Contact[];
  contactId: string | null | undefined;
  savedName: string;
  emptyLabel: string;
  onSelect: (contact: Contact | null) => void;
}) {
  const { selectValue, inList, current } = packingContactSelectValue(
    options,
    contacts,
    contactId,
    savedName,
  );

  const searchOptions = useMemo(
    () =>
      options.map((c) => ({
        value: c.id,
        label: packingContactLabel(c, contacts),
        keywords: [c.email, c.company_code, c.contact_name].filter(Boolean).join(" "),
      })),
    [options, contacts],
  );

  return (
    <SearchableSelect
      label={label}
      labelClassName={labelClass}
      options={searchOptions}
      value={inList ? selectValue : ""}
      savedLabel={!inList && current ? current : null}
      placeholder={emptyLabel}
      emptyMessage="No contacts match"
      onChange={(id) => onSelect(findPackingContactById(contacts, id) ?? null)}
      onClear={() => onSelect(null)}
    />
  );
}

function ContactAddressNote({ address }: { address: string }) {
  if (!address.trim()) {
    return (
      <p className="col-span-2 -mt-1 text-xs text-text-secondary">
        No address on file for this contact — add one in People.
      </p>
    );
  }
  return <p className="col-span-2 -mt-1 text-xs text-text-secondary">{address}</p>;
}

function PackingSlipPreview({ slip }: { slip: PackingSlipDocument }) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-4 text-sm print:p-8">
      <div className="border-b border-border-light bg-slate-50 px-4 py-6 text-center">
        <p className="text-lg font-bold tracking-wide text-text-primary">
          {packingSlipCompanyName(slip).toUpperCase()}
        </p>
        <p className="mt-1 text-2xl font-black uppercase text-text-primary">Packing list</p>
        <p className="mt-2 text-sm font-semibold text-text-secondary">{slip.document_number}</p>
        {slip.ship_date ? (
          <p className="mt-1 text-xs text-text-secondary">Ship date: {formatShortDate(slip.ship_date)}</p>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-text-secondary">From</p>
          <p className="font-semibold text-text-primary">{slip.ship_from_name}</p>
          <p className="text-text-secondary">{slip.ship_from_address || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-text-secondary">Ship to</p>
          <p className="font-semibold text-text-primary">{slip.ship_to_name}</p>
          <p className="text-text-secondary">{slip.ship_to_address || "—"}</p>
        </div>
      </div>
      {(slip.carrier || slip.tracking_number || slip.project_po_number) && (
        <div className="mt-4 flex flex-wrap gap-4 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          {slip.carrier ? (
            <span>
              <span className="text-text-secondary">Carrier: </span>
              <span className="font-medium">{slip.carrier}</span>
            </span>
          ) : null}
          {slip.tracking_number ? (
            <span>
              <span className="text-text-secondary">Tracking: </span>
              <span className="font-medium">{slip.tracking_number}</span>
            </span>
          ) : null}
          {slip.project_po_number ? (
            <span>
              <span className="text-text-secondary">PO: </span>
              <span className="font-medium">{slip.project_po_number}</span>
            </span>
          ) : null}
        </div>
      )}
      <table className="mt-4 w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border-light bg-slate-100">
            <th className="px-2 py-2 font-semibold">Style #</th>
            <th className="px-2 py-2 font-semibold">Description</th>
            <th className="px-2 py-2 font-semibold">Color</th>
            <th className="px-2 py-2 font-semibold">Size</th>
            <th className="px-2 py-2 text-right font-semibold">Qty</th>
            <th className="px-2 py-2 text-right font-semibold">Ctns</th>
            <th className="px-2 py-2 font-semibold">PO #</th>
          </tr>
        </thead>
        <tbody>
          {slip.lines.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-2 py-4 text-center text-text-secondary">
                No line items
              </td>
            </tr>
          ) : (
            slip.lines.map((line) => (
              <tr key={line.id} className="border-b border-border-light">
                <td className="px-2 py-2 font-medium">{line.style_number}</td>
                <td className="px-2 py-2">{line.description}</td>
                <td className="px-2 py-2">{line.colorway}</td>
                <td className="px-2 py-2">{line.size}</td>
                <td className="px-2 py-2 text-right tabular-nums">{line.quantity}</td>
                <td className="px-2 py-2 text-right tabular-nums">{line.cartons || "—"}</td>
                <td className="px-2 py-2">{line.po_number || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td colSpan={4} className="px-2 py-2 text-right">
              Total pieces
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{totalPieces(slip)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
      {slip.notes ? (
        <p className="mt-3 text-xs text-text-secondary">
          <span className="font-semibold">Notes: </span>
          {slip.notes}
        </p>
      ) : null}
    </div>
  );
}

function PackingSlipEditor({
  draft,
  contacts,
  partyOptions,
  onChange,
  onSave,
  onCancel,
  onReloadFromJobs,
}: {
  draft: PackingSlipDocument;
  contacts: Contact[];
  partyOptions: Contact[];
  onChange: (slip: PackingSlipDocument) => void;
  onSave: () => void;
  onCancel: () => void;
  onReloadFromJobs: () => void;
}) {
  function patchLine(id: string, partial: Partial<PackingSlipLine>) {
    onChange({
      ...draft,
      lines: draft.lines.map((l) => (l.id === id ? { ...l, ...partial } : l)),
    });
  }

  function addLine() {
    onChange({
      ...draft,
      lines: [
        ...draft.lines,
        {
          id: `line-new-${Date.now()}`,
          style_number: "",
          description: "",
          colorway: "",
          size: "M",
          quantity: 1,
          po_number: draft.project_po_number ?? "",
          cartons: 0,
        },
      ],
    });
  }

  function removeLine(id: string) {
    onChange({ ...draft, lines: draft.lines.filter((l) => l.id !== id) });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-accent/30 bg-violet-50/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-text-primary">Edit packing list</h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Save packing list
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PackingContactSelect
          label="Company (header)"
          contacts={contacts}
          options={partyOptions}
          contactId={draft.company_contact_id}
          savedName={draft.company_name}
          emptyLabel="Select company…"
          onSelect={(c) => onChange(applyCompanyContact(draft, c, contacts))}
        />
        <label className={labelClass}>
          Document #
          <input
            className={fieldClass}
            value={draft.document_number}
            onChange={(e) => onChange({ ...draft, document_number: e.target.value })}
          />
        </label>
        <label className={labelClass}>
          Ship date
          <input
            type="date"
            className={fieldClass}
            value={isoToDateInput(draft.ship_date)}
            onChange={(e) => onChange({ ...draft, ship_date: dateInputToIso(e.target.value) })}
          />
        </label>
        <PackingContactSelect
          label="Ship from"
          contacts={contacts}
          options={partyOptions}
          contactId={draft.ship_from_contact_id}
          savedName={draft.ship_from_name}
          emptyLabel="Select ship from…"
          onSelect={(c) =>
            onChange(applyShipFromContact(draft, c, contacts, DEFAULT_FROM_ADDRESS))
          }
        />
        <ContactAddressNote address={draft.ship_from_address} />
        <PackingContactSelect
          label="Ship to"
          contacts={contacts}
          options={partyOptions}
          contactId={draft.ship_to_contact_id}
          savedName={draft.ship_to_name}
          emptyLabel="Select ship to…"
          onSelect={(c) => onChange(applyShipToContact(draft, c, contacts))}
        />
        <ContactAddressNote address={draft.ship_to_address} />
        <label className={labelClass}>
          Carrier
          <input
            className={fieldClass}
            value={draft.carrier}
            onChange={(e) => onChange({ ...draft, carrier: e.target.value })}
          />
        </label>
        <label className={labelClass}>
          Tracking #
          <input
            className={fieldClass}
            value={draft.tracking_number}
            onChange={(e) => onChange({ ...draft, tracking_number: e.target.value })}
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border-light bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-text-secondary">
            <tr>
              <th className="px-2 py-2">Style #</th>
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2">Color</th>
              <th className="px-2 py-2">Size</th>
              <th className="px-2 py-2">Qty</th>
              <th className="px-2 py-2">Ctns</th>
              <th className="px-2 py-2">PO #</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((line) => (
              <tr key={line.id} className="border-t border-border-light">
                <td className="px-1 py-1">
                  <input
                    className="w-full min-w-[4rem] rounded border border-border-light px-1 py-1"
                    value={line.style_number}
                    onChange={(e) => patchLine(line.id, { style_number: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-full min-w-[6rem] rounded border border-border-light px-1 py-1"
                    value={line.description}
                    onChange={(e) => patchLine(line.id, { description: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-full min-w-[3rem] rounded border border-border-light px-1 py-1"
                    value={line.colorway}
                    onChange={(e) => patchLine(line.id, { colorway: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-full min-w-[2.5rem] rounded border border-border-light px-1 py-1"
                    value={line.size}
                    onChange={(e) => patchLine(line.id, { size: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    min={0}
                    className="w-14 rounded border border-border-light px-1 py-1 text-right"
                    value={line.quantity}
                    onChange={(e) =>
                      patchLine(line.id, { quantity: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    type="number"
                    min={0}
                    className="w-14 rounded border border-border-light px-1 py-1 text-right"
                    value={line.cartons}
                    onChange={(e) =>
                      patchLine(line.id, { cartons: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    className="w-full min-w-[5rem] rounded border border-border-light px-1 py-1"
                    value={line.po_number}
                    onChange={(e) => patchLine(line.id, { po_number: e.target.value })}
                  />
                </td>
                <td className="px-1 py-1">
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="text-[10px] font-semibold text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addLine}
          className="text-xs font-semibold text-accent hover:underline"
        >
          + Add line
        </button>
        <button
          type="button"
          onClick={onReloadFromJobs}
          className="text-xs font-semibold text-text-secondary hover:text-accent hover:underline"
        >
          Reload lines from jobs
        </button>
      </div>

      <PackingSlipPreview slip={draft} />
    </div>
  );
}

export function PackingSlipSection({
  project,
  onPatchProject,
}: {
  project: Project;
  onPatchProject: (patch: Partial<Project>) => void;
}) {
  const jobs = useMemo(() => loadProjectJobs(project.id, project), [project]);
  const contacts = useMemo(() => loadContacts(), []);
  const partyOptions = useMemo(() => packingSlipContactOptions(contacts), [contacts]);
  const slips = project.packaging_slips ?? [];

  const [editing, setEditing] = useState<PackingSlipDocument | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const viewed = slips.find((s) => s.id === viewId) ?? null;

  function persistSlips(next: PackingSlipDocument[]) {
    onPatchProject({ packaging_slips: next });
  }

  function startCreate() {
    setViewId(null);
    setEditing(cloneSlip(createPackingSlipDraft(project, jobs, contacts)));
  }

  function startEdit(slip: PackingSlipDocument) {
    setViewId(null);
    setEditing(cloneSlip(slip));
  }

  function saveEditing() {
    if (!editing) return;
    const now = new Date().toISOString();
    const saved = { ...editing, updated_at: now };
    const idx = slips.findIndex((s) => s.id === saved.id);
    if (idx >= 0) {
      const next = [...slips];
      next[idx] = saved;
      persistSlips(next);
    } else {
      persistSlips([...slips, saved]);
    }
    setEditing(null);
    setViewId(saved.id);
  }

  function deleteSlip(id: string) {
    persistSlips(slips.filter((s) => s.id !== id));
    if (viewId === id) setViewId(null);
  }

  function refreshLinesFromJobs() {
    if (!editing) return;
    setEditing({
      ...editing,
      lines: buildPackingSlipLinesFromJobs(jobs),
      updated_at: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-secondary">
          Create a packing list from jobs on this project (style, color, size, qty). Export opens in
          Excel.
        </p>
        {!editing ? (
          <button
            type="button"
            onClick={startCreate}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
          >
            + Create packing list
          </button>
        ) : null}
      </div>

      {editing ? (
        <PackingSlipEditor
          draft={editing}
          contacts={contacts}
          partyOptions={partyOptions}
          onChange={setEditing}
          onSave={saveEditing}
          onCancel={() => setEditing(null)}
          onReloadFromJobs={refreshLinesFromJobs}
        />
      ) : null}

      {!editing && slips.length > 0 ? (
        <ul className="space-y-2">
          {slips.map((slip) => (
            <li
              key={slip.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-light bg-white px-3 py-2 text-sm"
            >
              <div>
                <span className="font-semibold text-text-primary">{slip.document_number}</span>
                <span className="ml-2 text-xs text-text-secondary">
                  {slip.lines.length} lines · {totalPieces(slip)} pcs
                  {slip.ship_date ? ` · ${formatShortDate(slip.ship_date)}` : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViewId(slip.id)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(slip)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => exportPackingSlipCsv(slip)}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Export Excel (csv)
                </button>
                <button
                  type="button"
                  onClick={() => deleteSlip(slip.id)}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : !editing ? (
        <p className="text-sm text-text-secondary">No packing lists yet. Create one to get started.</p>
      ) : null}

      {viewed && !editing ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-border-light px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-slate-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => exportPackingSlipCsv(viewed)}
              className="rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-violet-50"
            >
              Export Excel (csv)
            </button>
          </div>
          <PackingSlipPreview slip={viewed} />
        </div>
      ) : null}
    </div>
  );
}
