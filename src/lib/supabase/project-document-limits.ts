export const PROJECT_DOCUMENTS_BUCKET = "project-documents";

/** Max file size per project document (12 MB). */
export const PROJECT_DOCUMENT_MAX_BYTES = 12_000_000;

export const PROJECT_DOCUMENT_MAX_MB = Math.round(PROJECT_DOCUMENT_MAX_BYTES / (1024 * 1024));
