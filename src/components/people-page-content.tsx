"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ImportClientsModal } from "@/components/import-clients-modal";
import { PeopleView, type PeopleAddSignal } from "@/components/people-view";
import { PeopleConnectHero } from "@/components/people-connect-hero";
import { loadContacts } from "@/lib/contacts-store";
import { sectionCoverHref, shouldShowSectionCover } from "@/lib/section-cover";
import { useStripSectionCoverWhenPopulated } from "@/lib/section-cover-hooks";
import type { Contact } from "@/lib/types/contact";
import type { Project } from "@/lib/types/project";

function PeoplePageInner({
  initialContacts,
  initialProjects,
}: {
  initialContacts: Contact[];
  initialProjects?: Project[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCoverPage = searchParams.get("cover") === "1";
  const [forceDirectory, setForceDirectory] = useState(false);
  const [addSignal, setAddSignal] = useState<PeopleAddSignal | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [contactCount, setContactCount] = useState(() =>
    Math.max(initialContacts.length, loadContacts().length),
  );

  useEffect(() => {
    setContactCount(Math.max(initialContacts.length, loadContacts().length));
  }, [initialContacts.length]);

  const effectiveCount = forceDirectory ? Math.max(contactCount, 1) : contactCount;
  const showHero = shouldShowSectionCover(showCoverPage, effectiveCount);
  useStripSectionCoverWhenPopulated("/people", searchParams, contactCount);

  const peopleHref = (cover: boolean) => sectionCoverHref("/people", searchParams, cover);
  const openCoverPage = () => router.push(peopleHref(true));
  const openDirectory = () => router.push(peopleHref(false));

  function openAddClient() {
    setForceDirectory(true);
    openDirectory();
    setAddSignal({ kind: "client", tick: Date.now() });
  }

  function openImportClients() {
    setForceDirectory(true);
    openDirectory();
    setImportOpen(true);
  }

  function handleImported() {
    setContactCount(loadContacts().length);
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Contacts"
          onInfoClick={openCoverPage}
          infoLabel="About Contacts"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openImportClients}
                className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#6d28d9] shadow-sm hover:bg-violet-50 active:opacity-90"
              >
                Import
              </button>
              <button
                type="button"
                onClick={openAddClient}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90"
              >
                + Add client
              </button>
            </div>
          }
        />
      </div>
      <ImportClientsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
      {showHero ? (
        <PeopleConnectHero onAddClient={openAddClient} hasContacts={contactCount > 0} />
      ) : (
        <PeopleView
          initialContacts={initialContacts}
          initialProjects={initialProjects}
          addSignal={addSignal}
          onContactsChange={setContactCount}
        />
      )}
    </div>
  );
}

export function PeoplePageContent({
  initialContacts,
  initialProjects,
}: {
  initialContacts: Contact[];
  initialProjects?: Project[];
}) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading people…</div>}>
      <PeoplePageInner initialContacts={initialContacts} initialProjects={initialProjects} />
    </Suspense>
  );
}
