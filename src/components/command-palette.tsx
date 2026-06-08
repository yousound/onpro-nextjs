"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { getLiveCachedProjects } from "@/lib/data/live-cache";
import { readSessionProjects } from "@/lib/mock/project-session";
import { contactDisplayName, loadContacts, searchContacts, clientListContacts } from "@/lib/contacts-store";
import { contactToDirectoryRow } from "@/components/add-contact-modals";

type Item = { id: string; label: string; href: string; group: string; subtitle?: string };

const NAV_ITEMS: Item[] = [
  { id: "nav-overview", label: "OnPro AI", href: "/", group: "Go to" },
  { id: "nav-messages", label: "Messages", href: "/messages", group: "Go to" },
  { id: "nav-projects", label: "Projects", href: "/projects", group: "Go to" },
  { id: "nav-calendar", label: "Calendar", href: "/calendar", group: "Go to" },
  { id: "nav-documents", label: "Documents", href: "/documents", group: "Go to" },
  { id: "nav-settings", label: "Settings", href: "/settings", group: "Go to" },
  { id: "nav-people", label: "Contacts", href: "/people", group: "Go to" },
  { id: "nav-production", label: "Production board (desktop)", href: "/production", group: "Go to" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const projectItems: Item[] = useMemo(() => {
    const list = isClientLiveBackend() ? getLiveCachedProjects() : readSessionProjects();
    return list.map((p) => ({
      id: `project-${p.id}`,
      label: `${p.name} — ${p.client.name}`,
      href: `/projects/${p.id}`,
      group: "Projects",
    }));
  }, [open]);

  const all = useMemo(() => [...NAV_ITEMS, ...projectItems], [projectItems]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    const contacts = loadContacts();
    const navAndProjects = all.filter((i) => i.label.toLowerCase().includes(s));
    const peopleClients = clientListContacts(contacts, q).map((c) => {
      const row = contactToDirectoryRow(c, contacts);
      return {
        id: `person-${c.id}`,
        label: row.clientCompanyName ?? row.clientPeople[0] ?? contactDisplayName(c, contacts),
        subtitle:
          row.clientPeople.length > 0
            ? `People: ${row.clientPeople.join(", ")}`
            : c.email,
        href: `/people?segment=client&q=${encodeURIComponent(row.clientCompanyName ?? c.name)}`,
        group: "People" as const,
      };
    });
    const peopleOthers = searchContacts(contacts, q)
      .filter((c) => c.segment !== "client")
      .map((c) => ({
        id: `person-${c.id}`,
        label: contactDisplayName(c, contacts),
        subtitle: c.email,
        href: `/people?segment=${c.segment}&q=${encodeURIComponent(c.email)}`,
        group: "People" as const,
      }));
    return [...navAndProjects, ...peopleClients, ...peopleOthers].slice(0, 20);
  }, [all, q]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Quick find"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={() => setOpen(false)}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border-light bg-surface-card shadow-2xl">
        <div className="border-b border-border-light px-3 py-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Quick find… (people, projects & pages)"
            className="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm text-text-primary outline-none focus:border-accent/40"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-2 text-sm">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-text-secondary">No matches</li>
          ) : (
            filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(item.href)}
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left hover:bg-surface-body"
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                    {item.group}
                  </span>
                  <span className="font-medium text-text-primary">{item.label}</span>
                  {item.subtitle ? (
                    <span className="text-xs text-text-secondary">{item.subtitle}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="border-t border-border-light px-4 py-2 text-[11px] text-text-secondary">
          <kbd className="rounded border border-border-light bg-surface-body px-1.5 py-0.5 font-mono">
            Esc
          </kbd>{" "}
          close ·{" "}
          <kbd className="rounded border border-border-light bg-surface-body px-1.5 py-0.5 font-mono">
            ⌘K
          </kbd>{" "}
          toggle
        </div>
      </div>
    </div>
  );
}
