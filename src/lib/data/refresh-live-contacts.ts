"use client";

import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { mergeSeedLiveContacts } from "@/lib/data/live-cache";
import type { Contact } from "@/lib/types/contact";

/** Pull latest People directory from the API into the live cache and notify listeners. */
export async function refreshLiveContactsFromApi(): Promise<void> {
  if (typeof window === "undefined" || !isClientLiveBackend()) return;
  try {
    const res = await fetch("/api/contacts", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { contacts?: Contact[] };
    if (!Array.isArray(data.contacts)) return;
    mergeSeedLiveContacts(data.contacts);
    window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
  } catch {
    /* keep cached list */
  }
}

export function dispatchProfileChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("onpro-profile-changed"));
}
