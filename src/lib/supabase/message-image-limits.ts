/** Must match Supabase Storage bucket `message-images` settings. */
export const MESSAGE_IMAGES_BUCKET = "message-images";

export const MESSAGE_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

export const MESSAGE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type MessageImageMime = (typeof MESSAGE_IMAGE_MIME_TYPES)[number];

export function isAllowedMessageImageMime(mime: string): mime is MessageImageMime {
  return (MESSAGE_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}

export const MESSAGE_IMAGE_MAX_MB = 3;
