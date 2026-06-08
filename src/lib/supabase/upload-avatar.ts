import { createClient } from "@/lib/supabase/client";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024;

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * Upload profile avatar to Supabase Storage.
 * Path: avatars/{userId}/avatar.{ext}
 * Requires migration 005_storage_avatars.sql and a signed-in user.
 */
export async function uploadAvatarForUser(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a JPG, PNG, GIF, or WebP image.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload an avatar.");

  const ext = extFromMime(file.type);
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  if (!url) throw new Error("Could not get avatar URL");
  return url;
}

/** http(s) Supabase/public URLs, data URLs (mock preview), or app-static paths. */
export function isRemoteAvatarUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("/")
  );
}
