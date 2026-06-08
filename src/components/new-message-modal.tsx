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
import { useCurrentUser } from "@/components/profile-provider";
import { conversationListAvatar } from "@/lib/message-participants";

export type NewMessageStartPayload = {
  contact: Contact | null;
  name: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onStart: (payload: NewMessageStartPayload) => void;
  onOpenExisting: (conversationId: number) => void;
  existingConversations: Conversation[];
  /** Pre-select a directory contact when opening (e.g. job share → Messages). */
  initialContactId?: string | null;
};

export function NewMessageModal({
  open,
  onClose,
  onStart,
  onOpenExisting,
  existingConversations,
  initialContactId = null,
}: Props) {
  const { user } = useCurrentUser();
  const [contactsTick, setContactsTick] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    if (!open) {
      setQuery("");
      setSelectedId(null);
      return;
    }
    if (initialContactId) setSelectedId(initialContactId);
  }, [open, initialContactId]);

  const directory = useMemo(() => contactsForPicker(contacts, "all"), [contacts]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle
      ? directory.filter((c) => contactSearchBlob(contacts, c).includes(needle))
      : directory;
    return pool.slice(0, 40);
  }, [contacts, directory, query]);

  const selectedContact = useMemo(
    () => (selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null),
    [contacts, selectedId],
  );

  const canStart = Boolean(selectedContact || query.trim());

  function handleStart() {
    if (selectedContact) {
      onStart({
        contact: selectedContact,
        name: contactPickerLabel(selectedContact, contacts),
      });
      return;
    }
    const name = query.trim();
    if (!name) return;
    onStart({ contact: null, name });
  }

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
        aria-labelledby="new-message-title"
        className="flex max-h-[min(640px,92vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id="new-message-title" className="text-base font-semibold text-slate-900">
            New message
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
          <label className="block text-xs font-medium text-slate-500" htmlFor="new-message-to">
            To
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="new-message-to"
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (results.length === 1 && !selectedContact) {
                    setSelectedId(results[0].id);
                    onStart({
                      contact: results[0],
                      name: contactPickerLabel(results[0], contacts),
                    });
                    return;
                  }
                  handleStart();
                }
              }}
              placeholder="Search team, clients, or vendors…"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              disabled={!canStart}
              onClick={handleStart}
              className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:pointer-events-none disabled:opacity-40"
            >
              Start
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Pick someone from People, or type a name to start a new thread.
          </p>
        </div>

        <div className="min-h-[14rem] flex-1 overflow-y-auto">
          <p className="sticky top-0 z-[1] border-b border-slate-100 bg-slate-50/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {query.trim() ? "Matching contacts" : "From your directory"}
          </p>
          {loadingContacts ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Loading contacts…</p>
          ) : contactsError ? (
            <p className="px-4 py-8 text-center text-sm text-red-600">{contactsError}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              {query.trim()
                ? `No contacts match “${query.trim()}”. You can still start with that name.`
                : "Add people under People to message them here."}
            </p>
          ) : (
            <ul className="py-1">
              {results.map((c) => {
                const label = contactPickerLabel(c, contacts);
                const company = companyLabelForContact(contacts, c);
                const isSelected = selectedId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(c.id);
                        onStart({ contact: c, name: label });
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        isSelected ? "bg-violet-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <DirectoryAvatar name={label} avatarUrl={c.avatar_url} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-slate-900">{label}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${segmentBadgeSoftClass(c.segment)}`}
                          >
                            {segmentLabel(c.segment)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">
                          {[c.email, company && company !== label ? company : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {existingConversations.length > 0 ? (
          <>
            <div className="shrink-0 border-t border-slate-100 px-4 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Existing chats
              </p>
            </div>
            <ul className="max-h-40 shrink-0 overflow-y-auto py-1">
              {existingConversations.map((c) => {
                const listAvatar = conversationListAvatar(c, user);
                return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onOpenExisting(c.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                  >
                    <DirectoryAvatar
                      name={listAvatar.name}
                      avatarUrl={listAvatar.avatarUrl}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {c.is_group ? "Group" : "Direct"} · {c.last_message_preview ?? "No messages yet"}
                      </span>
                    </span>
                  </button>
                </li>
              );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function participantFromContact(
  contact: Contact,
  contacts: Contact[],
  participantId: number,
): Conversation["participants"][number] {
  const name = contactPickerLabel(contact, contacts);
  const company =
    contact.kind === "company"
      ? name
      : companyLabelForContact(contacts, contact) ?? contact.company_name ?? null;
  return {
    id: participantId,
    name,
    avatar_url: contact.avatar_url ?? null,
    company_name:
      contact.kind === "company" ? undefined : company && company !== name ? company : contact.company_name,
    is_company: contact.kind === "company",
  };
}
