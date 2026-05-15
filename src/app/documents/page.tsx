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
          subtitle="Choose a project to see its files. Filter by type, skim what changed lately, or browse the full list—all in one place."
        />
      </div>
      <DocumentsView documents={documents} />
    </div>
  );
}
