import { createClient } from "@/lib/supabase/client";
import {
  MESSAGE_IMAGES_BUCKET,
  MESSAGE_IMAGE_MAX_BYTES,
  MESSAGE_IMAGE_MAX_MB,
  isAllowedMessageImageMime,
} from "@/lib/supabase/message-image-limits";

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Upload a chat photo: message-images/{ownerUserId}/{conversationId}/{uuid}.ext */
export async function uploadMessageImageForConversation(
  ownerUserId: string,
  conversationId: number,
  file: File,
): Promise<string> {
  if (!isAllowedMessageImageMime(file.type)) {
    throw new Error("Use a JPG, PNG, GIF, or WebP image.");
  }
  if (file.size > MESSAGE_IMAGE_MAX_BYTES) {
    throw new Error(`Image must be ${MESSAGE_IMAGE_MAX_MB} MB or smaller.`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload images.");

  const ext = extFromMime(file.type);
  const path = `${ownerUserId}/${conversationId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(MESSAGE_IMAGES_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(MESSAGE_IMAGES_BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  if (!url) throw new Error("Could not get image URL");
  return url;
}
