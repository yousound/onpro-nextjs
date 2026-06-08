/**
 * Verifies mailroom image import skips duplicates (same bytes, changed Gmail ids, re-import).
 *
 * Run: npx tsx scripts/test-mailroom-image-dedupe.ts
 */
import {
  buildMailroomImageDedupeIndex,
  buildMailroomImageRowsForMessage,
  imageContentKey,
  isMailroomImageDuplicate,
} from "../src/lib/documents/import-mailroom-images";
import type { EmailInlineImage, EmailMessage, EmailThread } from "../src/lib/types/agent";
import type { DocumentRow } from "../src/lib/types/documents";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const DATA_A =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const DATA_B =
  "data:image/png;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function mockThread(): EmailThread {
  return {
    id: "gmail-thread-1",
    subject: "Artwork proof",
    participants: [{ name: "Client", email: "client@example.com" }],
    messages: [],
    status: "read",
    channel: "email",
    category: "other",
    related: { project_id: 20 },
  };
}

function mockMessage(images: EmailInlineImage[]): EmailMessage {
  return {
    id: "msg-1",
    from: { name: "Client", email: "client@example.com" },
    at: "2026-06-01T12:00:00.000Z",
    body: "See attached",
    inlineImages: images,
  };
}

function dataUrlByteSize(dataUrl: string): number {
  const base64 = dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : dataUrl;
  return Math.floor((base64.length * 3) / 4);
}

function legacyRow(projectId: number): DocumentRow {
  return {
    id: 1,
    name: "logo.png — Artwork proof (Client)",
    project_id: projectId,
    project_name: "ZOE",
    kind: "image",
    size_bytes: dataUrlByteSize(DATA_A),
    uploaded_by: "Mailroom",
    updated_at: "2026-06-01T12:00:00.000Z",
    file_name: "logo.png",
    file_data_url: null,
    blob_ref: "mailroom-blob:gmail-thread-1:msg-1:att-0",
    external_url: null,
    source_ref: "mailroom:gmail-thread-1:msg-1:att-0:p20",
  };
}

function run(): void {
  const imgAtt0: EmailInlineImage = {
    id: "att-0",
    mimeType: "image/png",
    src: DATA_A,
    filename: "logo.png",
  };
  const imgCid: EmailInlineImage = {
    id: "cid-logo@mail",
    mimeType: "image/png",
    src: DATA_A,
    filename: "logo.png",
  };
  const imgOther: EmailInlineImage = {
    id: "att-1",
    mimeType: "image/gif",
    src: DATA_B,
    filename: "spacer.gif",
  };

  assert(
    imageContentKey(imgAtt0) === imageContentKey(imgCid),
    "same bytes should share content key",
  );
  assert(
    imageContentKey(imgAtt0) !== imageContentKey(imgOther),
    "different bytes should differ content key",
  );

  const thread = mockThread();
  const message = mockMessage([imgAtt0, imgCid, imgOther]);
  const projectNames = new Map<number, string>([[20, "ZOE"]]);
  const budget = { remaining: 40 };

  const index = buildMailroomImageDedupeIndex([legacyRow(20)]);
  assert(
    isMailroomImageDuplicate(index, thread, message, imgCid, 20),
    "legacy att-0 row should block same image with cid id",
  );

  const first = buildMailroomImageRowsForMessage(
    thread,
    message,
    [20],
    projectNames,
    buildMailroomImageDedupeIndex([]),
    new Map(),
    10,
    budget,
  );
  assert(first.rows.length === 2, "first import should add two distinct images, not three");
  assert(
    first.rows.every((r) => r.source_ref?.includes("data:")),
    "source_ref should use content key",
  );

  const second = buildMailroomImageRowsForMessage(
    thread,
    message,
    [20],
    projectNames,
    buildMailroomImageDedupeIndex([...first.rows]),
    new Map(),
    20,
    { remaining: 40 },
  );
  assert(second.rows.length === 0, "re-import should skip all duplicates");

  const multiProject = buildMailroomImageRowsForMessage(
    thread,
    mockMessage([imgAtt0]),
    [20, 21],
    new Map([
      [20, "ZOE"],
      [21, "BAU"],
    ]),
    buildMailroomImageDedupeIndex([]),
    new Map(),
    30,
    { remaining: 40 },
  );
  assert(multiProject.rows.length === 2, "same image may link to multiple projects once each");

  console.log("test-mailroom-image-dedupe: PASS");
}

run();
