import { getSupabaseUrl } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

function isAbsoluteAvatarUrl(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("/")
  );
}

const BUCKET = "avatars";
const AVATAR_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

/** Public URL for `avatars/{userId}/avatar.{ext}` (no network). */
export function avatarStoragePublicUrl(userId: string, ext: string): string {
  const base = getSupabaseUrl().replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${userId}/avatar.${ext}`;
}

/** Turn storage paths or bare keys into a public object URL. */
export function normalizeStoredAvatarUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (isAbsoluteAvatarUrl(raw)) return raw;

  const base = getSupabaseUrl().replace(/\/$/, "");
  if (raw.startsWith("avatars/")) {
    return `${base}/storage/v1/object/public/${raw}`;
  }
  if (/^[0-9a-f-]{36}\/avatar\./i.test(raw)) {
    return `${base}/storage/v1/object/public/${BUCKET}/${raw}`;
  }
  return null;
}

/** `f5efdc1c-…/avatar.png` from a public storage URL. */
export function storageObjectPathFromPublicUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return url.slice(i + marker.length).split("?")[0] || null;
}

/** Copy legacy upload (wrong auth folder) into `{userId}/avatar.*` and return new URL. */
export async function copyAvatarIntoUserFolder(
  supabase: SupabaseClient,
  userId: string,
  sourcePublicUrl: string,
): Promise<string | null> {
  const normalized = normalizeStoredAvatarUrl(sourcePublicUrl);
  if (!normalized) return null;

  const sourcePath = storageObjectPathFromPublicUrl(normalized);
  if (!sourcePath) return normalized;

  const extMatch = sourcePath.match(/\.(\w+)$/i);
  const ext = extMatch?.[1]?.toLowerCase() || "png";
  const destPath = `${userId}/avatar.${ext}`;

  if (sourcePath === destPath) return normalized;

  const { error } = await supabase.storage.from(BUCKET).copy(sourcePath, destPath);
  if (error) return normalized;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(destPath);
  return data.publicUrl?.trim() || null;
}

/** Probe public storage paths when list() is blocked or empty. */
export async function avatarPublicUrlFromStorageProbe(userId: string): Promise<string | null> {
  for (const ext of AVATAR_EXTENSIONS) {
    const url = avatarStoragePublicUrl(userId, ext);
    try {
      const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, cache: "no-store" });
      if (res.ok || res.status === 206) return url;
    } catch {
      /* try next extension */
    }
  }
  return null;
}

/** File in Storage under `{userId}/avatar.*`. */
export async function avatarPublicUrlFromStorage(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: files, error } = await supabase.storage.from(BUCKET).list(userId, { limit: 20 });
  if (!error && files?.length) {
    const avatarFile = files.find((f) => f.name && /^avatar\./i.test(f.name));
    if (avatarFile?.name) {
      const path = `${userId}/${avatarFile.name}`;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = data.publicUrl?.trim();
      if (url) return url;
    }
  }

  return avatarPublicUrlFromStorageProbe(userId);
}

/** Any CRM avatar URL for this workspace (incl. legacy folder under another uuid). */
export async function avatarUrlFromContacts(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
): Promise<string | null> {
  const { data: rows, error } = await supabase
    .from("contacts")
    .select("avatar_url, email, role")
    .eq("user_id", userId)
    .not("avatar_url", "is", null)
    .limit(50);

  if (error) return null;
  if (!rows?.length) return null;

  const emailNorm = userEmail.trim().toLowerCase();
  const candidates: string[] = [];

  for (const row of rows) {
    const url = normalizeStoredAvatarUrl(row.avatar_url);
    if (!url) continue;
    const score =
      (row.email?.trim().toLowerCase() === emailNorm ? 4 : 0) +
      (row.role?.trim().toLowerCase() === "team" ? 2 : 0) +
      (url.includes(userId) ? 1 : 0) +
      (url.includes("/avatars/") ? 1 : 0);
    candidates.push(`${score}:${url}`);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const sa = Number(a.split(":")[0]);
    const sb = Number(b.split(":")[0]);
    return sb - sa;
  });

  return candidates[0].slice(candidates[0].indexOf(":") + 1);
}

/** When upload landed under a previous login uuid, find that folder in Storage. */
async function findSiblingStorageAvatar(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: folders, error } = await supabase.storage.from(BUCKET).list("", { limit: 200 });
  if (error || !folders?.length) return null;

  for (const entry of folders) {
    const folder = entry.name?.trim();
    if (!folder || folder === userId) continue;
    if (!/^[0-9a-f-]{36}$/i.test(folder)) continue;

    const { data: files } = await supabase.storage.from(BUCKET).list(folder, { limit: 10 });
    const avatarFile = files?.find((f) => f.name && /^avatar\./i.test(f.name));
    if (!avatarFile?.name) continue;

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${avatarFile.name}`);
    const url = data.publicUrl?.trim();
    if (url) return url;
  }
  return null;
}

/** Resolve avatar: profile → oauth → storage → contacts → migrate copy → probe. */
export async function resolveAvatarUrlForUser(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string,
  profileAvatarUrl: string | null | undefined,
  oauthAvatar: string | null,
): Promise<string | null> {
  const profileNormalized = normalizeStoredAvatarUrl(profileAvatarUrl);
  const oauthNormalized = normalizeStoredAvatarUrl(oauthAvatar);
  let avatar = profileNormalized ?? oauthNormalized ?? null;
  let fromStorage: string | null = null;
  let fromContacts: string | null = null;
  let migratedTo: string | null = null;

  const inUserFolder = (url: string | null) =>
    Boolean(url && storageObjectPathFromPublicUrl(url)?.startsWith(`${userId}/`));

  // Profile/contact may still point at an old auth uuid folder — copy into this user.
  if (avatar && !inUserFolder(avatar)) {
    migratedTo = await copyAvatarIntoUserFolder(supabase, userId, avatar);
    avatar = migratedTo ?? avatar;
  }

  if (!inUserFolder(avatar)) {
    fromStorage = await avatarPublicUrlFromStorage(supabase, userId);
    if (fromStorage) avatar = fromStorage;
  }

  if (!inUserFolder(avatar)) {
    fromContacts = await avatarUrlFromContacts(supabase, userId, userEmail);
    if (fromContacts && !inUserFolder(fromContacts)) {
      migratedTo = await copyAvatarIntoUserFolder(supabase, userId, fromContacts);
      avatar = migratedTo ?? fromContacts;
    } else if (fromContacts) {
      avatar = fromContacts;
    }
  }

  if (!inUserFolder(avatar)) {
    const orphan = await findSiblingStorageAvatar(supabase, userId);
    if (orphan) {
      migratedTo = await copyAvatarIntoUserFolder(supabase, userId, orphan);
      avatar = migratedTo ?? orphan;
    }
  }

  if (!avatar) {
    avatar = await avatarPublicUrlFromStorageProbe(userId);
  }

  return avatar;
}
