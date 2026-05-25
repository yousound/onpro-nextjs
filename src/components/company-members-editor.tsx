"use client";

import { useMemo, useState } from "react";
import type { Contact } from "@/lib/types/contact";
import { contactDisplayName, contactSearchBlob } from "@/lib/contacts-store";
import type { CompanyMemberDraft } from "@/lib/company-members";
import { emptyMemberDraft } from "@/lib/company-members";
import { fieldClass, labelClass } from "@/components/contact-form-fields";

export function CompanyMembersEditor({
  contacts,
  companyId,
  members,
  onChange,
}: {
  contacts: Contact[];
  companyId?: string;
  members: CompanyMemberDraft[];
  onChange: (members: CompanyMemberDraft[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);

  const pickPool = useMemo(() => {
    const memberEmails = new Set(members.map((m) => m.email.toLowerCase()).filter(Boolean));
    return contacts.filter((c) => {
      if (c.id === companyId) return false;
      if (memberEmails.has(c.email.toLowerCase())) return false;
      if (c.kind === "company" && c.segment === "client") return false;
      return true;
    });
  }, [contacts, companyId, members]);

  const searchHits = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return [];
    return pickPool.filter((c) => contactSearchBlob(contacts, c).includes(needle)).slice(0, 8);
  }, [contacts, pickPool, search]);

  function updateMember(id: string, patch: Partial<CompanyMemberDraft>) {
    onChange(members.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function removeMember(id: string) {
    onChange(members.filter((m) => m.id !== id));
  }

  function addFromContact(c: Contact) {
    if (members.some((m) => m.email.toLowerCase() === c.email.toLowerCase())) return;
    onChange([
      ...members,
      {
        id: c.id,
        name: c.contact_name ?? c.name,
        email: c.email,
        phone: c.phone ?? "",
        isNew: false,
      },
    ]);
    setSearch("");
  }

  function addBlankMember() {
    onChange([...members, emptyMemberDraft()]);
    setShowAddRow(true);
  }

  return (
    <div className="rounded-xl border border-border-light bg-surface-body/30 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Company members</p>
        <button
          type="button"
          onClick={addBlankMember}
          className="text-xs font-semibold text-accent hover:underline"
        >
          + Add person
        </button>
      </div>
      <p className="mt-1 text-[11px] text-text-secondary">
        Members are saved as client contacts and appear in People search and pickers.
      </p>

      {members.length === 0 && !showAddRow ? (
        <p className="mt-3 text-sm text-text-secondary">No members yet — add people or search existing contacts.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {members.map((m) => (
            <li key={m.id} className="rounded-lg border border-border-light bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className={labelClass}>
                  Name
                  <input
                    className={fieldClass}
                    value={m.name}
                    onChange={(e) => updateMember(m.id, { name: e.target.value })}
                    placeholder="Contact name"
                  />
                </label>
                <label className={labelClass}>
                  Email
                  <input
                    type="email"
                    className={fieldClass}
                    value={m.email}
                    onChange={(e) => updateMember(m.id, { email: e.target.value })}
                    placeholder="email@company.com"
                  />
                </label>
                <label className={labelClass}>
                  Phone
                  <input
                    className={fieldClass}
                    value={m.phone}
                    onChange={(e) => updateMember(m.id, { phone: e.target.value })}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeMember(m.id)}
                className="mt-2 text-xs font-semibold text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-border-light pt-3">
        <label className={labelClass}>
          Search to add existing contact
          <input
            className={fieldClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, or company…"
          />
        </label>
        {searchHits.length > 0 ? (
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border-light bg-white">
            {searchHits.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addFromContact(c)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-violet-50"
                >
                  <span className="font-medium text-text-primary">{contactDisplayName(c)}</span>
                  <span className="text-xs text-text-secondary">{c.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : search.trim() ? (
          <p className="mt-2 text-xs text-text-secondary">No matches — use + Add person to create someone new.</p>
        ) : null}
      </div>
    </div>
  );
}
