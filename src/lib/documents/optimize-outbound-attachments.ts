import sharp from "sharp";
import type { ResolvedOutboundAttachment } from "@/lib/documents/resolve-outbound-attachment-bytes";

export type OutboundAttachmentSource = ResolvedOutboundAttachment & {
  documentId?: number;
  publicUrl?: string | null;
};

export type LinkedAttachment = {
  filename: string;
  url: string;
  documentId?: number;
  reason: "size_limit" | "non_compressible";
};

export type PackOutboundAttachmentsResult = {
  attachments: ResolvedOutboundAttachment[];
  linked: LinkedAttachment[];
  htmlAppendix: string;
};

export const GMAIL_ATTACHMENT_BUDGET_BYTES = 22 * 1024 * 1024;
const IMAGE_REENCODE_THRESHOLD_BYTES = 1_500_000;
const MAX_IMAGE_DIMENSION = 2048;
const AGGRESSIVE_MAX_DIMENSION = 1280;

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/") && !mimeType.includes("svg");
}

async function reencodeImage(
  att: ResolvedOutboundAttachment,
  opts: { maxDim: number; quality: number },
): Promise<ResolvedOutboundAttachment | null> {
  if (!isImageMime(att.mimeType)) return null;

  try {
    let pipeline = sharp(Buffer.from(att.bytes)).rotate();
    const meta = await pipeline.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w > opts.maxDim || h > opts.maxDim) {
      pipeline = pipeline.resize(opts.maxDim, opts.maxDim, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    const out = await pipeline.jpeg({ quality: opts.quality, mozjpeg: true }).toBuffer();
    const base = att.filename.replace(/\.[^.]+$/, "") || "image";
    return {
      filename: `${base}.jpg`,
      mimeType: "image/jpeg",
      bytes: new Uint8Array(out),
    };
  } catch {
    return null;
  }
}

async function optimizeAttachment(att: OutboundAttachmentSource): Promise<OutboundAttachmentSource> {
  if (!isImageMime(att.mimeType)) return att;
  if (att.bytes.length < IMAGE_REENCODE_THRESHOLD_BYTES) return att;
  const reencoded = await reencodeImage(att, { maxDim: MAX_IMAGE_DIMENSION, quality: 82 });
  return reencoded ? { ...att, ...reencoded } : att;
}

function buildHtmlAppendix(linked: LinkedAttachment[]): string {
  if (linked.length === 0) return "";
  const items = linked
    .map(
      (l) =>
        `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.filename)}</a> <span style="color:#64748b">(${l.reason === "size_limit" ? "download link — file too large to attach" : "download link"})</span></li>`,
    )
    .join("");
  return `<div style="margin-top:1.25em;padding-top:1em;border-top:1px solid #e2e8f0"><p style="font-weight:600;margin:0 0 0.5em">Additional files</p><ul style="margin:0;padding-left:1.25em">${items}</ul></div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fit attachments under Gmail budget: resize images, link PDFs/overflow in HTML body.
 */
export async function packOutboundAttachments(
  sources: OutboundAttachmentSource[],
  budgetBytes: number = GMAIL_ATTACHMENT_BUDGET_BYTES,
): Promise<PackOutboundAttachmentsResult> {
  const optimized = await Promise.all(sources.map((s) => optimizeAttachment(s)));
  const sorted = [...optimized].sort((a, b) => a.bytes.length - b.bytes.length);

  const attachments: ResolvedOutboundAttachment[] = [];
  const linked: LinkedAttachment[] = [];
  let total = 0;

  for (const att of sorted) {
    if (total + att.bytes.length <= budgetBytes) {
      attachments.push(att);
      total += att.bytes.length;
      continue;
    }

    if (isImageMime(att.mimeType)) {
      const smaller = await reencodeImage(att, {
        maxDim: AGGRESSIVE_MAX_DIMENSION,
        quality: 72,
      });
      if (smaller && total + smaller.bytes.length <= budgetBytes) {
        attachments.push(smaller);
        total += smaller.bytes.length;
        continue;
      }
    }

    if (att.publicUrl) {
      linked.push({
        filename: att.filename,
        url: att.publicUrl,
        documentId: att.documentId,
        reason: isImageMime(att.mimeType) ? "size_limit" : "non_compressible",
      });
      continue;
    }

    throw new Error(
      `"${att.filename}" is too large to attach (~${Math.round(att.bytes.length / (1024 * 1024))} MB) and has no download link. Remove it or upload a smaller version.`,
    );
  }

  return {
    attachments,
    linked,
    htmlAppendix: buildHtmlAppendix(linked),
  };
}
