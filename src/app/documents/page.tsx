import { PageHeader } from "@/components/page-header";
import { DocumentsView } from "@/components/documents-view";
import { getDocuments } from "@/lib/mock/documents";

export default function DocumentsPage() {
  const documents = getDocuments();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="shrink-0">
        <PageHeader
          title="Documents"
          subtitle="Project-linked library: pick a project from the menu, filter by document type (iOS-style pills), then browse recent files and the grouped index."
        />
      </div>
      <DocumentsView documents={documents} />
    </div>
  );
}
