import type { Contact } from "@/lib/types/contact";
import { normalizeStoredAvatarUrl } from "@/lib/supabase/resolve-profile-avatar";
import { isRemoteAvatarUrl } from "@/lib/supabase/upload-avatar";

/** Normalize a stored contact/profile avatar to a browser-loadable URL. */
export function normalizeContactAvatarUrl(value: string | null | undefined): string | null {
  const normalized = normalizeStoredAvatarUrl(value);
  if (normalized && isRemoteAvatarUrl(normalized)) return normalized;
  if (value?.trim() && isRemoteAvatarUrl(value.trim())) return value.trim();
  return null;
}

/**
 * Display avatar for a CRM contact.
 * Linked member's own profile avatar wins over operator-assigned contact avatar.
 */
export function resolveContactDisplayAvatar(
  contact: Pick<Contact, "avatar_url" | "linked_auth_user_id">,
  linkedUserAvatarUrl?: string | null,
): string | null {
  if (contact.linked_auth_user_id) {
    const linked = normalizeContactAvatarUrl(linkedUserAvatarUrl);
    if (linked) return linked;
  }
  return normalizeContactAvatarUrl(contact.avatar_url);
}
