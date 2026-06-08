"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DocumentsView } from "@/components/documents-view";
import { DocumentsConnectHero } from "@/components/documents-connect-hero";
import { readExtraDocumentsSync } from "@/lib/documents/document-storage";
import { DOCUMENTS_CHANGED_EVENT } from "@/lib/onpro-events";
import { sectionCoverHref, shouldShowSectionCover } from "@/lib/section-cover";
import { useStripSectionCoverWhenPopulated } from "@/lib/section-cover-hooks";
import type { DocumentRow } from "@/lib/types/documents";

function DocumentsPageInner({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showCoverPage = searchParams.get("cover") === "1";
  const [forceLibrary, setForceLibrary] = useState(false);
  const [newOpenSignal, setNewOpenSignal] = useState(0);
  /** Start at 0 so SSR matches first client paint (localStorage is read after mount). */
  const [extraDocCount, setExtraDocCount] = useState(0);
  const [clientReady, setClientReady] = useState(false);

  const syncExtraDocCount = useCallback(() => {
    setExtraDocCount(readExtraDocumentsSync().length);
  }, []);

  useEffect(() => {
    syncExtraDocCount();
    setClientReady(true);
    window.addEventListener(DOCUMENTS_CHANGED_EVENT, syncExtraDocCount);
    return () => window.removeEventListener(DOCUMENTS_CHANGED_EVENT, syncExtraDocCount);
  }, [syncExtraDocCount]);

  const documentCount = initialDocuments.length + extraDocCount;
  const effectiveCount = forceLibrary ? Math.max(documentCount, 1) : documentCount;
  const countForCover = clientReady ? effectiveCount : initialDocuments.length;
  const showHero = shouldShowSectionCover(showCoverPage, countForCover);
  useStripSectionCoverWhenPopulated("/documents", searchParams, clientReady ? documentCount : 0);

  const documentsHref = (cover: boolean) => sectionCoverHref("/documents", searchParams, cover);
  const openCoverPage = () => router.push(documentsHref(true));
  const openLibrary = () => router.push(documentsHref(false));

  function openNewDocument() {
    setForceLibrary(true);
    openLibrary();
    setNewOpenSignal((n) => n + 1);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Documents"
          onInfoClick={openCoverPage}
          infoLabel="About Documents"
          action={
            <button
              type="button"
              onClick={openNewDocument}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:opacity-90"
            >
              + New document
            </button>
          }
        />
      </div>
      {showHero ? (
        <DocumentsConnectHero
          onNewDocument={openNewDocument}
          onDismiss={documentCount > 0 && showCoverPage ? openLibrary : undefined}
        />
      ) : (
        <DocumentsView
          documents={initialDocuments}
          openNewSignal={newOpenSignal}
          onDocumentsChange={() => syncExtraDocCount()}
        />
      )}
    </div>
  );
}

export function DocumentsPageContent({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-text-secondary">Loading documents…</div>}>
      <DocumentsPageInner initialDocuments={initialDocuments} />
    </Suspense>
  );
}
