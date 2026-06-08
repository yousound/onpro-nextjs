"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conversation } from "@/lib/types/messages";
import type { Contact } from "@/lib/types/contact";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import {
  contactSearchBlob,
  companyLabelForContact,
  loadContacts,
} from "@/lib/contacts-store";
import {
  contactPickerLabel,
  contactsForPicker,
} from "@/lib/attachment-contact-options";
import { mergeSeedLiveContacts } from "@/lib/data/live-cache";
import { segmentBadgeSoftClass, segmentLabel } from "@/lib/mock/people";
import { DirectoryAvatar } from "@/components/directory-avatar";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (contact: Contact) => void;
  existingParticipants: Conversation["participants"];
};

function participantMatchesContact(
  participant: Conversation["participants"][number],
  contact: Contact,
  contacts: Contact[],
): boolean {
  const label = contactPickerLabel(contact, contacts);
  return participant.name.trim().toLowerCase() === label.trim().toLowerCase();
}

export function AddConversationMemberModal({
  open,
  onClose,
  onAdd,
  existingParticipants,
}: Props) {
  const [contactsTick, setContactsTick] = useState(0);
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadDirectory() {
      if (isClientLiveBackend()) {
        setLoadingContacts(true);
        setContactsError(null);
        try {
          const res = await fetch("/api/contacts", { cache: "no-store" });
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? "Could not load contacts");
          }
          const data = (await res.json()) as { contacts?: Contact[] };
          const list = data.contacts ?? [];
          if (cancelled) return;
          mergeSeedLiveContacts(list);
          setContacts(list);
        } catch (e) {
          if (cancelled) return;
          const cached = loadContacts();
          setContacts(cached);
          setContactsError(
            cached.length > 0
              ? null
              : e instanceof Error
                ? e.message
                : "Could not load contacts",
          );
        } finally {
          if (!cancelled) setLoadingContacts(false);
        }
        return;
      }

      setContacts(loadContacts());
      setContactsError(null);
      setLoadingContacts(false);
    }

    void loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [open, contactsTick]);

  useEffect(() => {
    if (!open) return;
    const onContactsChanged = () => setContactsTick((t) => t + 1);
    window.addEventListener("onpro-contacts-changed", onContactsChanged);
    return () => window.removeEventListener("onpro-contacts-changed", onContactsChanged);
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const directory = useMemo(() => contactsForPicker(contacts, "all"), [contacts]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = directory.filter(
      (c) => !existingParticipants.some((p) => participantMatchesContact(p, c, contacts)),
    );
    const filtered = needle
      ? pool.filter((c) => contactSearchBlob(contacts, c).includes(needle))
      : pool;
    return filtered.slice(0, 40);
  }, [contacts, directory, existingParticipants, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        className="flex max-h-[min(640px,92vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="add-member-title" className="text-base font-semibold text-slate-900">
            Add member
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <label className="block text-xs font-medium text-slate-500" htmlFor="add-member-search">
            Search People
          </label>
          <input
            id="add-member-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, company, or email…"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
            autoComplete="off"
            autoFocus
          />
          <p className="mt-2 text-[11px] text-slate-400">
            Pick someone from your directory. People already in this chat are hidden.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loadingContacts ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">Loading contacts…</p>
          ) : contactsError ? (
            <p className="px-2 py-6 text-center text-sm text-red-600">{contactsError}</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              {query.trim() ? "No matches." : "Everyone in People is already in this chat."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {results.map((c) => {
                const label = contactPickerLabel(c, contacts);
                const company =
                  c.kind === "company"
                    ? null
                    : (companyLabelForContact(contacts, c) ?? c.company_name ?? null);
                const subtitle =
                  c.kind === "company" ? null : company && company !== label ? company : null;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onAdd(c)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-slate-50"
                    >
                      <DirectoryAvatar name={label} avatarUrl={c.avatar_url} size="list" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{label}</p>
                        {subtitle ? (
                          <p className="truncate text-xs text-slate-500">{subtitle}</p>
                        ) : null}
                      </div>
                      {c.segment ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${segmentBadgeSoftClass(c.segment)}`}
                        >
                          {segmentLabel(c.segment)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
