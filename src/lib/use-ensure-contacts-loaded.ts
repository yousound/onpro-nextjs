"use client";

import { useEffect, useState } from "react";
import { isClientLiveBackend } from "@/lib/config/backend-mode";
import { loadContacts } from "@/lib/contacts-store";
import { mergeSeedLiveContacts } from "@/lib/data/live-cache";
import type { Contact } from "@/lib/types/contact";

let loadPromise: Promise<Contact[]> | null = null;

/** Fetches People directory into the live cache when Mailroom (etc.) opens without SSR contacts. */
export function useEnsureContactsLoaded(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("onpro-contacts-changed", bump);
    window.addEventListener("onpro-live-cache-seeded", bump);

    if (!isClientLiveBackend()) {
      return () => {
        window.removeEventListener("onpro-contacts-changed", bump);
        window.removeEventListener("onpro-live-cache-seeded", bump);
      };
    }

    if (loadContacts().length > 0) {
      return () => {
        window.removeEventListener("onpro-contacts-changed", bump);
        window.removeEventListener("onpro-live-cache-seeded", bump);
      };
    }

    let cancelled = false;

    if (!loadPromise) {
      loadPromise = fetch("/api/contacts", { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? "Could not load contacts");
          }
          const data = (await res.json()) as { contacts?: Contact[] };
          return data.contacts ?? [];
        })
        .finally(() => {
          loadPromise = null;
        });
    }

    void loadPromise
      .then((list) => {
        if (cancelled || list.length === 0) return;
        mergeSeedLiveContacts(list);
        window.dispatchEvent(new CustomEvent("onpro-contacts-changed"));
      })
      .catch(() => {
        /* keep mock/local fallback */
      });

    return () => {
      cancelled = true;
      window.removeEventListener("onpro-contacts-changed", bump);
      window.removeEventListener("onpro-live-cache-seeded", bump);
    };
  }, []);

  return tick;
}
