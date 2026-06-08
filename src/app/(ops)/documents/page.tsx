import { DocumentsPageContent } from "@/components/documents-page-content";
import { isLiveBackendEnabled } from "@/lib/config/backend";
import { getDocuments } from "@/lib/mock/documents";

export default async function DocumentsPage() {
  const documents = (await isLiveBackendEnabled()) ? [] : getDocuments();

  return <DocumentsPageContent initialDocuments={documents} />;
}
