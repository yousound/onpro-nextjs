import { isLikelyHtml, normalizeEmailBody } from "@/lib/email-body";
import { attachmentDataToDataUrl, fetchGmailAttachmentData } from "@/lib/gmail/fetch-attachment";
import type { EmailInlineImage, EmailMessage, EmailThread } from "@/lib/types/agent";

type GmailHeader = { name: string; value: string };

function header(headers: GmailHeader[] | undefined, name: string): string {
  const h = headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value?.trim() ?? "";
}

function parseFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() };
  if (raw.includes("@")) return { name: raw.split("@")[0], email: raw.trim() };
  return { name: raw || "Unknown", email: "" };
}

function decodeBody(data?: string): string {
  if (!data) return "";
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

type GmailPayload = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayload[];
};

type PendingImagePart = {
  mimeType: string;
  filename?: string;
  contentId?: string;
  attachmentId?: string;
  inlineData?: string;
};

const MAX_INLINE_IMAGES_PER_MESSAGE = 12;
const MAX_INLINE_IMAGE_BYTES = 2_500_000;

function base64UrlToDataUrl(mimeType: string, data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return `data:${mimeType};base64,${normalized}`;
}

function parseContentId(raw: string): string {
  return raw.trim().replace(/^<|>$/g, "");
}

function listImageParts(part: GmailPayload, out: PendingImagePart[]): void {
  if (out.length >= MAX_INLINE_IMAGES_PER_MESSAGE) return;
  const mime = part.mimeType ?? "";
  if (mime.startsWith("image/")) {
    const cid = header(part.headers, "Content-ID");
    if (part.body?.data) {
      const approxBytes = Math.floor((part.body.data.length * 3) / 4);
      if (approxBytes <= MAX_INLINE_IMAGE_BYTES) {
        out.push({
          mimeType: mime,
          filename: part.filename,
          contentId: cid ? parseContentId(cid) : undefined,
          inlineData: part.body.data,
        });
      }
    } else if (part.body?.attachmentId) {
      const size = part.body.size ?? 0;
      if (size === 0 || size <= MAX_INLINE_IMAGE_BYTES) {
        out.push({
          mimeType: mime,
          filename: part.filename,
          contentId: cid ? parseContentId(cid) : undefined,
          attachmentId: part.body.attachmentId,
        });
      }
    }
  }
  for (const child of part.parts ?? []) listImageParts(child, out);
}

function extractHtmlImageUrls(html: string): EmailInlineImage[] {
  const out: EmailInlineImage[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) != null && out.length < MAX_INLINE_IMAGES_PER_MESSAGE) {
    const src = match[1].trim();
    if (!/^https?:\/\//i.test(src)) continue;
    out.push({
      id: `html-url-${out.length}`,
      mimeType: "image/*",
      src,
      filename: undefined,
    });
  }
  return out;
}

async function resolveMessageImages(
  accessToken: string,
  messageId: string,
  payload: GmailPayload,
): Promise<EmailInlineImage[]> {
  const pending: PendingImagePart[] = [];
  listImageParts(payload, pending);

  const htmlRaw = extractMimeRaw(payload, "text/html");
  const fromHtml = htmlRaw && isLikelyHtml(htmlRaw) ? extractHtmlImageUrls(htmlRaw) : [];

  const seen = new Set<string>();
  const images: EmailInlineImage[] = [];

  function push(img: EmailInlineImage) {
    if (images.length >= MAX_INLINE_IMAGES_PER_MESSAGE) return;
    if (seen.has(img.src)) return;
    seen.add(img.src);
    images.push(img);
  }

  for (const urlImg of fromHtml) push(urlImg);

  const resolved = await Promise.all(
    pending.map(async (part, index): Promise<EmailInlineImage | null> => {
      let dataUrl: string | null = null;
      if (part.inlineData) {
        dataUrl = base64UrlToDataUrl(part.mimeType, part.inlineData);
      } else if (part.attachmentId) {
        const data = await fetchGmailAttachmentData(accessToken, messageId, part.attachmentId);
        if (data) dataUrl = attachmentDataToDataUrl(part.mimeType, data);
      }
      if (!dataUrl) return null;
      return {
        id: part.contentId ? `cid-${part.contentId}` : `att-${index}`,
        mimeType: part.mimeType,
        src: dataUrl,
        filename: part.filename,
      };
    }),
  );

  for (const img of resolved) {
    if (img) push(img);
  }

  return images;
}

function extractMimeRaw(payload: GmailPayload, mimeType: string): string {
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractMimeRaw(part, mimeType);
    if (text) return text;
  }
  return "";
}

function extractMime(payload: GmailPayload, mimeType: string): string {
  if (payload.mimeType === mimeType && payload.body?.data) {
    return decodeBody(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractMime(part, mimeType);
    if (text) return text;
  }
  return "";
}

function extractBodyFromPayload(payload: GmailPayload): string {
  const plain = extractMime(payload, "text/plain");
  if (plain.trim()) return normalizeEmailBody(plain);

  const html = extractMime(payload, "text/html");
  if (html.trim()) return normalizeEmailBody(html);

  if (payload.body?.data) {
    return normalizeEmailBody(decodeBody(payload.body.data));
  }
  return "";
}

export function gmailApiThreadIdFromEmailThreadId(threadId: string): string | null {
  if (!threadId.startsWith("gmail-")) return null;
  return threadId.slice("gmail-".length);
}

export type GmailThreadFormat = "full" | "metadata";

type GmailThreadRaw = {
  id: string;
  messages?: Array<{
    id: string;
    internalDate?: string;
    labelIds?: string[];
    snippet?: string;
    payload?: GmailPayload & { headers?: GmailHeader[] };
  }>;
};

function mapGmailThreadMetadata(raw: GmailThreadRaw): EmailThread | null {
  const messages = raw.messages ?? [];
  if (messages.length === 0) return null;

  const sorted = [...messages].sort(
    (a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0),
  );
  const first = sorted[0];
  const subject = header(first.payload?.headers, "Subject") || "(No subject)";
  const isUnread = messages.some((m) => m.labelIds?.includes("UNREAD"));

  const mappedMessages: EmailMessage[] = sorted.map((m) => {
    const fromRaw = header(m.payload?.headers, "From");
    const at = m.internalDate
      ? new Date(Number(m.internalDate)).toISOString()
      : new Date().toISOString();
    const snippet = (m.snippet ?? header(m.payload?.headers, "Snippet")).trim();
    const body = snippet ? normalizeEmailBody(snippet) : "";
    return {
      id: m.id,
      from: parseFrom(fromRaw),
      at,
      body,
    };
  });

  const participants = new Map<string, { name: string; email: string }>();
  for (const msg of mappedMessages) {
    if (msg.from.email) participants.set(msg.from.email, msg.from);
  }

  return {
    id: `gmail-${raw.id}`,
    subject,
    participants: [...participants.values()],
    messages: mappedMessages,
    status: isUnread ? "unread" : "read",
    channel: "email",
    category: "other",
    related: {},
  };
}

async function mapGmailThread(
  accessToken: string,
  raw: GmailThreadRaw,
  opts?: { resolveInlineImages?: boolean },
): Promise<EmailThread | null> {
  const resolveInlineImages = opts?.resolveInlineImages !== false;
  const messages = raw.messages ?? [];
  if (messages.length === 0) return null;

  const sorted = [...messages].sort(
    (a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0),
  );
  const first = sorted[0];
  const subject = header(first.payload?.headers, "Subject") || "(No subject)";
  const isUnread = messages.some((m) => m.labelIds?.includes("UNREAD"));

  const mappedMessages: EmailMessage[] = await Promise.all(
    sorted.map(async (m) => {
      const payload = (m.payload ?? {}) as GmailPayload;
      const fromRaw = header(m.payload?.headers, "From");
      const at = m.internalDate
        ? new Date(Number(m.internalDate)).toISOString()
        : new Date().toISOString();
      const bodyRaw = extractBodyFromPayload(payload).trim();
      const snippet = header(m.payload?.headers, "Snippet");
      const body = bodyRaw || (snippet ? normalizeEmailBody(snippet) : "");
      const inlineImages = resolveInlineImages
        ? await resolveMessageImages(accessToken, m.id, payload)
        : [];
      return {
        id: m.id,
        from: parseFrom(fromRaw),
        at,
        body,
        ...(inlineImages.length > 0 ? { inlineImages } : {}),
      };
    }),
  );

  const participants = new Map<string, { name: string; email: string }>();
  for (const msg of mappedMessages) {
    if (msg.from.email) participants.set(msg.from.email, msg.from);
  }

  return {
    id: `gmail-${raw.id}`,
    subject,
    participants: [...participants.values()],
    messages: mappedMessages,
    status: isUnread ? "unread" : "read",
    channel: "email",
    category: "other",
    related: {},
  };
}

/** Map a Gmail threads.get JSON payload to EmailThread (metadata or full). */
export async function mapGmailThreadFromRaw(
  accessToken: string,
  raw: GmailThreadRaw,
  opts?: { format?: GmailThreadFormat; resolveInlineImages?: boolean },
): Promise<EmailThread | null> {
  if (opts?.format === "metadata") return mapGmailThreadMetadata(raw);
  return mapGmailThread(accessToken, raw, opts);
}

export const GMAIL_INBOX_PAGE_SIZE = 40;
/** Smaller first page for faster connect / first paint. */
export const GMAIL_INBOX_FIRST_PAGE_SIZE = 15;

export type GmailInboxPage = {
  threads: EmailThread[];
  nextPageToken: string | null;
  /** Gmail estimate for matching threads (inbox list). */
  resultSizeEstimate: number | null;
};

function sortThreadsByLatest(threads: EmailThread[]): EmailThread[] {
  return [...threads].sort((a, b) => {
    const atA = a.messages[a.messages.length - 1]?.at ?? "";
    const atB = b.messages[b.messages.length - 1]?.at ?? "";
    return atB.localeCompare(atA);
  });
}

export async function fetchGmailThreadById(
  accessToken: string,
  id: string,
  opts?: { resolveInlineImages?: boolean; format?: GmailThreadFormat },
): Promise<EmailThread | null> {
  const format: GmailThreadFormat = opts?.format ?? "full";
  const params = new URLSearchParams({ format });
  if (format === "metadata") {
    params.append("metadataHeaders", "Subject");
    params.append("metadataHeaders", "From");
    params.append("metadataHeaders", "To");
  }
  const threadRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!threadRes.ok) return null;
  const raw = (await threadRes.json()) as GmailThreadRaw;
  return mapGmailThreadFromRaw(accessToken, raw, { ...opts, format });
}

async function fetchGmailThreadsByIds(
  accessToken: string,
  ids: string[],
  opts?: { resolveInlineImages?: boolean; format?: GmailThreadFormat },
): Promise<EmailThread[]> {
  if (ids.length === 0) return [];
  const format: GmailThreadFormat = opts?.format ?? "metadata";
  const { batchFetchGmailThreads } = await import("@/lib/gmail/batch-gmail");
  const mapped = await batchFetchGmailThreads(accessToken, ids, {
    format,
    resolveInlineImages: opts?.resolveInlineImages,
  });
  const threads = mapped.filter((t): t is EmailThread => t != null);
  return sortThreadsByLatest(threads);
}

/** One page of INBOX threads (default 40) with optional Gmail `pageToken`. */
export async function fetchGmailInboxThreadPage(
  accessToken: string,
  opts?: {
    maxResults?: number;
    pageToken?: string;
    q?: string;
    /** When false, skips Gmail attachment fetches for inline images (faster list load). */
    resolveInlineImages?: boolean;
    /** List loads use metadata (fast); detail uses full. */
    format?: GmailThreadFormat;
  },
): Promise<GmailInboxPage> {
  const maxResults = Math.min(
    GMAIL_INBOX_PAGE_SIZE,
    Math.max(1, opts?.maxResults ?? GMAIL_INBOX_PAGE_SIZE),
  );
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    labelIds: "INBOX",
  });
  if (opts?.pageToken) params.set("pageToken", opts.pageToken);
  const q = opts?.q?.trim();
  if (q) params.set("q", q);

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Gmail list failed (${listRes.status}): ${text.slice(0, 200)}`);
  }

  const listJson = (await listRes.json()) as {
    threads?: Array<{ id: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
  };
  const ids = (listJson.threads ?? []).map((t) => t.id);
  const threads = await fetchGmailThreadsByIds(accessToken, ids, {
    resolveInlineImages: opts?.resolveInlineImages,
    format: opts?.format ?? "metadata",
  });

  return {
    threads,
    nextPageToken: listJson.nextPageToken ?? null,
    resultSizeEstimate:
      typeof listJson.resultSizeEstimate === "number"
        ? listJson.resultSizeEstimate
        : null,
  };
}

/** @deprecated Prefer fetchGmailInboxThreadPage for pagination. */
export async function fetchGmailInboxThreads(accessToken: string): Promise<EmailThread[]> {
  const page = await fetchGmailInboxThreadPage(accessToken);
  return page.threads;
}

export function enrichThreadsWithGoogleProfile(
  threads: EmailThread[],
  profile: GoogleUserProfile,
): EmailThread[] {
  const emailKey = profile.email.toLowerCase();
  return threads.map((thread) => ({
    ...thread,
    participants: thread.participants.map((p) =>
      p.email.toLowerCase() === emailKey ? { ...p, avatarUrl: profile.picture } : p,
    ),
  }));
}

export type GoogleUserProfile = {
  email: string;
  picture: string | null;
  name: string | null;
};

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to read Google profile");
  const json = (await res.json()) as { email?: string; picture?: string; name?: string };
  if (!json.email) throw new Error("Google profile missing email");
  return {
    email: json.email,
    picture: json.picture?.trim() || null,
    name: json.name?.trim() || null,
  };
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
  const profile = await fetchGoogleUserProfile(accessToken);
  return profile.email;
}
