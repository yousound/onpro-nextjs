import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/types/profile";
import { normalizeStoredAvatarUrl } from "@/lib/supabase/resolve-profile-avatar";
import { isRemoteAvatarUrl } from "@/lib/supabase/upload-avatar";

export type CurrentUserDisplay = {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  companyName: string;
  phone: string;
  businessAddress: string;
  businessPhone: string;
  avatarUrl: string | null;
  initials: string;
  /** Team contact row for the signed-in operator (`profiles.self_contact_id`). */
  selfContactId: string | null;
  operatorCompanyCode: string | null;
};

/** OAuth / provider photo from Supabase Auth `user_metadata`. */
export function avatarFromAuthMetadata(authUser: User): string | null {
  const meta = authUser.user_metadata;
  if (!meta || typeof meta !== "object") return null;
  const candidates = [
    meta.picture,
    meta.avatar_url,
    meta.avatar,
    meta.photo_url,
    meta.image,
  ];
  for (const raw of candidates) {
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

/** URL safe for `<img>` / `DirectoryAvatar` (http(s), Supabase public URL, or `/public/…`). */
export function displayAvatarUrl(
  avatarUrl: string | null | undefined,
  options?: { useMockPlaceholder?: boolean },
): string | null {
  if (isRemoteAvatarUrl(avatarUrl)) return avatarUrl;
  if (options?.useMockPlaceholder) return "/user-avatar-demo.png";
  return null;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function buildCurrentUserDisplay(
  authUser: User,
  profile: UserProfile | null,
): CurrentUserDisplay {
  const email = authUser.email ?? profile?.email ?? "";
  const metaName =
    typeof authUser.user_metadata?.full_name === "string"
      ? authUser.user_metadata.full_name.trim()
      : "";
  const fullName =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    metaName ||
    email.split("@")[0] ||
    "User";
  const firstName = fullName.split(/\s+/)[0] || fullName;

  const avatarUrl =
    normalizeStoredAvatarUrl(profile?.avatar_url) ||
    normalizeStoredAvatarUrl(avatarFromAuthMetadata(authUser)) ||
    null;

  return {
    id: authUser.id,
    email,
    fullName,
    firstName,
    companyName:
      profile?.company_name?.trim() || profile?.workspace_name?.trim() || "",
    phone: profile?.phone?.trim() ?? "",
    businessAddress: profile?.business_address?.trim() ?? "",
    businessPhone: profile?.business_phone?.trim() ?? "",
    avatarUrl,
    initials: initialsFrom(fullName),
    selfContactId:
      profile?.self_contact_id != null ? String(profile.self_contact_id) : null,
    operatorCompanyCode: profile?.operator_company_code?.trim() ?? null,
  };
};
