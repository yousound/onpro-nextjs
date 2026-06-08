"use client";

import { CoverPreviewShell, OpsSectionCover } from "@/components/ops-section-cover";

type Props = {
  onNewDocument: () => void;
  onDismiss?: () => void;
};

export function DocumentsConnectHero({ onNewDocument, onDismiss }: Props) {
  return (
    <OpsSectionCover
      headline={
        <>
          Every file for production, in <span className="text-[#7c3aed]">one library</span>
        </>
      }
      subhead="Upload invoices, quotes, and tech packs — or link files from Dropbox and elsewhere. Filter by project and type, then share anything in Messages."
      dismissAction={onDismiss ? { label: "View documents →", onClick: onDismiss } : undefined}
      cards={[
        {
          title: "Upload or link",
          description: "Add files from your computer or paste an external URL. OnPro keeps the source so you know what came from where.",
          preview: (
            <CoverPreviewShell>
              <div className="flex gap-2">
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Upload</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">Link</span>
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Filter by project and kind",
          description: "Browse by client project, then narrow to invoices, quotes, tech packs, or other — with sorting inside each type.",
          preview: (
            <CoverPreviewShell>
              <div className="flex flex-wrap gap-1">
                {["Invoice", "Quote", "Tech pack"].map((k) => (
                  <span key={k} className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-medium text-slate-600">
                    {k}
                  </span>
                ))}
              </div>
            </CoverPreviewShell>
          ),
        },
        {
          title: "Send in Messages",
          description: "Open any document to preview or attach it as a smart card in a thread — editable, not a dead PDF screenshot.",
          preview: (
            <CoverPreviewShell>
              <div className="space-y-1">
                <div className="h-2 w-full rounded bg-slate-100" />
                <div className="h-2 w-2/3 rounded bg-slate-100" />
                <p className="pt-1 text-[9px] font-semibold text-violet-600">Attach to thread</p>
              </div>
            </CoverPreviewShell>
          ),
        },
      ]}
      primaryAction={{ label: "Add your first document", onClick: onNewDocument }}
    />
  );
}
