import { resolveWorkflowProjectId } from "@/lib/mailroom/workflow-utils";
import {
  MAX_MAILROOM_IMAGE_BYTES,
  loadExtraDocuments,
  persistExtraDocuments,
  readExtraDocumentsSync,
} from "@/lib/documents/document-storage";
import { putDocumentBlob } from "@/lib/documents/document-blob-store";
import { dispatchDocumentsChanged } from "@/lib/onpro-events";
import type {
  EmailInlineImage,
  EmailMessage,
  EmailThread,
  GeneratedItem,
  MailroomWorkflow,
} from "@/lib/types/agent";
import type { DocumentRow } from "@/lib/types/documents";

const MAX_IMPORTS_PER_RUN = 40;

function projectIdFromDeepLink(deepLink?: string): number | undefined {
  if (!deepLink) return undefined;
  const m = /^\/projects\/(\d+)/.exec(deepLink);
  if (!m) return undefined;
  const id = Number(m[1]);
  return Number.isFinite(id) ? id : undefined;
}

function projectIdFromPayload(payload: Record<string, unknown>): number | undefined {
  const raw = payload.project_id ?? payload.projectId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return Number(raw);
  return undefined;
}

function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : dataUrl;
  return Math.floor((base64.length * 3) / 4);
}

/** All project ids a mailroom thread is tied to (explicit links + workflow). */
export function resolveThreadProjectIds(
  thread: EmailThread,
  workflow: MailroomWorkflow | undefined,
  threadGeneratedItems: GeneratedItem[],
): number[] {
  const ids = new Set<number>();
  if (thread.related?.project_id != null) ids.add(thread.related.project_id);

  if (workflow) {
    const primary = resolveWorkflowProjectId(workflow);
    if (primary != null) ids.add(primary);
    if (workflow.link_existing_project_id != null) ids.add(workflow.link_existing_project_id);
    if (workflow.project_match.project_id != null) ids.add(workflow.project_match.project_id);
    for (const step of workflow.steps) {
      if (step.applied_project_id != null) ids.add(step.applied_project_id);
    }
  }

  for (const item of threadGeneratedItems) {
    const fromLink = projectIdFromDeepLink(item.deepLink);
    if (fromLink != null) ids.add(fromLink);
    const fromPayload = projectIdFromPayload(item.payload);
    if (fromPayload != null) ids.add(fromPayload);
  }

  return [...ids];
}

/** Stable identity for an inline image (survives Gmail id changes like att-0 vs cid-…). */
export function imageContentKey(image: EmailInlineImage): string {
  if (image.src.startsWith("http://") || image.src.startsWith("https://")) {
    return `url:${image.src}`;
  }
  if (image.src.startsWith("data:")) {
    const comma = image.src.indexOf(",");
    const payload = comma >= 0 ? image.src.slice(comma + 1) : image.src;
    const head = payload.slice(0, 512);
    const tail = payload.length > 1024 ? payload.slice(-512) : "";
    return `data:${payload.length}:${head}:${tail}`;
  }
  return `raw:${image.id}:${image.src.slice(0, 128)}`;
}

function mailroomImageSourceRef(
  threadId: string,
  messageId: string,
  contentKey: string,
  projectId: number,
): string {
  return `mailroom:${threadId}:${messageId}:${contentKey}:p${projectId}`;
}

function sharedMailroomBlobRef(threadId: string, messageId: string, contentKey: string): string {
  return `mailroom-blob:${threadId}:${messageId}:${contentKey}`;
}

function legacyMessageProjectKey(threadId: string, messageId: string, projectId: number): string {
  return `${threadId}|${messageId}|${projectId}`;
}

function parseMailroomSourceRef(
  sourceRef: string,
): { threadId: string; messageId: string; projectId: number } | null {
  if (!sourceRef.startsWith("mailroom:")) return null;
  const parts = sourceRef.split(":");
  if (parts.length < 5) return null;
  const projectPart = parts[parts.length - 1] ?? "";
  const projectMatch = /^p(\d+)$/.exec(projectPart);
  if (!projectMatch) return null;
  return {
    threadId: parts[1]!,
    messageId: parts[2]!,
    projectId: Number(projectMatch[1]),
  };
}

export type MailroomImageDedupeIndex = {
  sourceRefs: Set<string>;
  blobRefs: Set<string>;
  contentByProject: Map<number, Set<string>>;
  urlByProject: Map<number, Set<string>>;
  legacyByMessageProject: Map<string, Array<{ sizeBytes: number; fileName: string }>>;
};

export function buildMailroomImageDedupeIndex(all: DocumentRow[]): MailroomImageDedupeIndex {
  const index: MailroomImageDedupeIndex = {
    sourceRefs: new Set(),
    blobRefs: new Set(),
    contentByProject: new Map(),
    urlByProject: new Map(),
    legacyByMessageProject: new Map(),
  };

  for (const row of all) {
    if (row.kind !== "image") continue;

    if (row.source_ref) index.sourceRefs.add(row.source_ref);

    if (row.blob_ref) index.blobRefs.add(row.blob_ref);

    if (row.project_id == null) continue;

    if (row.external_url) {
      const urls = index.urlByProject.get(row.project_id) ?? new Set<string>();
      urls.add(row.external_url);
      index.urlByProject.set(row.project_id, urls);
    }

    if (row.source_ref?.startsWith("mailroom:")) {
      const parsed = parseMailroomSourceRef(row.source_ref);
      if (parsed) {
        const parts = row.source_ref.split(":");
        const contentKey = parts.slice(3, -1).join(":");
        if (contentKey) {
          const keys = index.contentByProject.get(parsed.projectId) ?? new Set<string>();
          keys.add(contentKey);
          index.contentByProject.set(parsed.projectId, keys);
        }

        const legacyKey = legacyMessageProjectKey(
          parsed.threadId,
          parsed.messageId,
          parsed.projectId,
        );
        const fingerprints = index.legacyByMessageProject.get(legacyKey) ?? [];
        fingerprints.push({
          sizeBytes: row.size_bytes ?? 0,
          fileName: row.file_name ?? "",
        });
        index.legacyByMessageProject.set(legacyKey, fingerprints);
      }
    }
  }

  return index;
}

export function isMailroomImageDuplicate(
  index: MailroomImageDedupeIndex,
  thread: EmailThread,
  message: EmailMessage,
  image: EmailInlineImage,
  projectId: number,
): boolean {
  const contentKey = imageContentKey(image);
  const sourceRef = mailroomImageSourceRef(thread.id, message.id, contentKey, projectId);
  if (index.sourceRefs.has(sourceRef)) return true;

  const blobRef = image.src.startsWith("data:")
    ? sharedMailroomBlobRef(thread.id, message.id, contentKey)
    : null;
  if (blobRef && index.blobRefs.has(blobRef)) return true;

  const projectContent = index.contentByProject.get(projectId);
  if (projectContent?.has(contentKey)) return true;

  if (image.src.startsWith("http")) {
    const urls = index.urlByProject.get(projectId);
    if (urls?.has(image.src)) return true;
  }

  const legacyKey = legacyMessageProjectKey(thread.id, message.id, projectId);
  const fingerprints = index.legacyByMessageProject.get(legacyKey);
  if (fingerprints?.length) {
    const fileName = mailroomImageFileName(image);
    const sizeBytes = image.src.startsWith("data:") ? dataUrlByteSize(image.src) : 0;
    if (fingerprints.some((f) => f.sizeBytes === sizeBytes && f.fileName === fileName)) {
      return true;
    }
  }

  return false;
}

function registerImportedMailroomImage(
  index: MailroomImageDedupeIndex,
  thread: EmailThread,
  message: EmailMessage,
  image: EmailInlineImage,
  projectId: number,
  row: DocumentRow,
): void {
  const contentKey = imageContentKey(image);
  const sourceRef = mailroomImageSourceRef(thread.id, message.id, contentKey, projectId);
  index.sourceRefs.add(sourceRef);
  if (row.blob_ref) index.blobRefs.add(row.blob_ref);

  const keys = index.contentByProject.get(projectId) ?? new Set<string>();
  keys.add(contentKey);
  index.contentByProject.set(projectId, keys);

  if (row.external_url) {
    const urls = index.urlByProject.get(projectId) ?? new Set<string>();
    urls.add(row.external_url);
    index.urlByProject.set(projectId, urls);
  }

  const legacyKey = legacyMessageProjectKey(thread.id, message.id, projectId);
  const fingerprints = index.legacyByMessageProject.get(legacyKey) ?? [];
  fingerprints.push({
    sizeBytes: row.size_bytes ?? 0,
    fileName: row.file_name ?? "",
  });
  index.legacyByMessageProject.set(legacyKey, fingerprints);
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|img)$/i;

function extensionFromMime(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  if (m.includes("webp")) return "webp";
  if (m.includes("svg")) return "svg";
  return "png";
}

function mailroomImageFileName(image: EmailInlineImage): string {
  const name = image.filename?.trim();
  if (name && IMAGE_EXT.test(name)) return name;
  if (name && !name.includes(".")) return `${name}.${extensionFromMime(image.mimeType)}`;
  const ext = extensionFromMime(image.mimeType);
  return `${image.id}.${ext}`;
}

function imageDisplayName(
  thread: EmailThread,
  message: EmailMessage,
  image: EmailInlineImage,
): string {
  const base = image.filename?.trim() || "Email image";
  const subject = thread.subject.trim() || "Mailroom";
  const from = message.from.name?.trim() || message.from.email || "Sender";
  return `${base} — ${subject} (${from})`;
}

export function buildMailroomImageRowsForMessage(
  thread: EmailThread,
  message: EmailMessage,
  projectIds: number[],
  projectNameById: Map<number, string>,
  dedupeIndex: MailroomImageDedupeIndex,
  pendingBlobs: Map<string, string>,
  nextIdStart: number,
  importBudget: { remaining: number },
): { rows: DocumentRow[]; nextId: number } {
  const images = message.inlineImages ?? [];
  if (images.length === 0 || projectIds.length === 0 || importBudget.remaining <= 0) {
    return { rows: [], nextId: nextIdStart };
  }

  const rows: DocumentRow[] = [];
  let nextId = nextIdStart;
  const seenContentInMessage = new Set<string>();

  for (const image of images) {
    if (!image.src.startsWith("data:") && !image.src.startsWith("http")) continue;

    const contentKey = imageContentKey(image);
    if (seenContentInMessage.has(contentKey)) continue;
    seenContentInMessage.add(contentKey);

    const blobRef = image.src.startsWith("data:")
      ? sharedMailroomBlobRef(thread.id, message.id, contentKey)
      : null;

    if (image.src.startsWith("data:")) {
      const bytes = dataUrlByteSize(image.src);
      if (bytes > MAX_MAILROOM_IMAGE_BYTES) continue;
    }

    const projectsToImport = projectIds.filter(
      (projectId) => !isMailroomImageDuplicate(dedupeIndex, thread, message, image, projectId),
    );
    if (projectsToImport.length === 0) continue;

    if (image.src.startsWith("data:") && blobRef && !pendingBlobs.has(blobRef)) {
      pendingBlobs.set(blobRef, image.src);
    }

    for (const projectId of projectsToImport) {
      if (importBudget.remaining <= 0) return { rows, nextId };

      const sourceRef = mailroomImageSourceRef(thread.id, message.id, contentKey, projectId);
      const projectName = projectNameById.get(projectId) ?? `Project ${projectId}`;
      const row: DocumentRow = {
        id: nextId++,
        name: imageDisplayName(thread, message, image),
        project_id: projectId,
        project_name: projectName,
        kind: "image",
        size_bytes: image.src.startsWith("data:") ? dataUrlByteSize(image.src) : 0,
        uploaded_by: "Mailroom",
        updated_at: message.at ?? new Date().toISOString(),
        file_name: mailroomImageFileName(image),
        file_data_url: null,
        blob_ref: blobRef,
        external_url: image.src.startsWith("http") ? image.src : null,
        source_ref: sourceRef,
      };
      rows.push(row);
      registerImportedMailroomImage(dedupeIndex, thread, message, image, projectId, row);
      importBudget.remaining -= 1;
    }
  }

  return { rows, nextId };
}

export type ImportMailroomImagesInput = {
  threads: EmailThread[];
  workflows: Record<string, MailroomWorkflow>;
  generatedItems: GeneratedItem[];
  projectNames: Array<{ id: number; name: string }>;
  /** Seed rows (mock library) — used for id allocation and existing source_ref scan. */
  seedDocuments?: DocumentRow[];
};

export type ImportMailroomImagesResult = {
  imported: number;
  quotaExceeded: boolean;
};

/** Import Gmail inline images into document storage for linked projects (metadata in LS, blobs in IDB). */
export async function importMailroomImagesToDocuments(
  input: ImportMailroomImagesInput,
): Promise<ImportMailroomImagesResult> {
  if (typeof window === "undefined") return { imported: 0, quotaExceeded: false };

  await loadExtraDocuments();

  const projectNameById = new Map(input.projectNames.map((p) => [p.id, p.name]));
  const extras = readExtraDocumentsSync();
  const seed = input.seedDocuments ?? [];
  const all = [...seed, ...extras];

  const dedupeIndex = buildMailroomImageDedupeIndex(all);
  let nextId = Math.max(0, ...all.map((d) => d.id)) + 1;

  const newRows: DocumentRow[] = [];
  const pendingBlobs = new Map<string, string>();
  const importBudget = { remaining: MAX_IMPORTS_PER_RUN };

  for (const thread of input.threads) {
    const workflow = input.workflows[thread.id];
    const threadItems = input.generatedItems.filter((i) => i.thread_id === thread.id);
    const projectIds = resolveThreadProjectIds(thread, workflow, threadItems).filter((id) =>
      projectNameById.has(id),
    );
    if (projectIds.length === 0) continue;

    for (const message of thread.messages) {
      const { rows, nextId: bumped } = buildMailroomImageRowsForMessage(
        thread,
        message,
        projectIds,
        projectNameById,
        dedupeIndex,
        pendingBlobs,
        nextId,
        importBudget,
      );
      newRows.push(...rows);
      nextId = bumped;
    }
  }

  if (newRows.length === 0) return { imported: 0, quotaExceeded: false };

  try {
    for (const [ref, dataUrl] of pendingBlobs) {
      await putDocumentBlob(ref, dataUrl);
    }
  } catch (e) {
    console.warn("[mailroom] document blob store failed", e);
    return { imported: 0, quotaExceeded: false };
  }

  const mergedExtras = [...extras, ...newRows];
  const ok = await persistExtraDocuments(mergedExtras);
  if (!ok) return { imported: 0, quotaExceeded: true };

  dispatchDocumentsChanged();
  return { imported: newRows.length, quotaExceeded: false };
}
