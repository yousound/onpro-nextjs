import { resolveContactDisplayAvatar } from "@/lib/contact-display-avatar";
import { normalizeStoredAvatarUrl } from "@/lib/supabase/resolve-profile-avatar";
import type { Contact } from "@/lib/types/contact";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Prefer linked member profile avatars over operator-assigned contact avatars. */
export async function enrichContactsWithLinkedAvatars(
  supabase: SupabaseClient,
  contacts: Contact[],
): Promise<Contact[]> {
  const linkedIds = [
    ...new Set(
      contacts
        .map((c) => c.linked_auth_user_id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (linkedIds.length === 0) {
    return contacts.map((c) => ({
      ...c,
      avatar_url: resolveContactDisplayAvatar(c, null),
    }));
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, avatar_url")
    .in("id", linkedIds);

  const avatarByUserId = new Map<string, string | null>(
    (profiles ?? []).map((p) => [
      p.id as string,
      normalizeStoredAvatarUrl(p.avatar_url as string | null),
    ]),
  );

  return contacts.map((c) => ({
    ...c,
    avatar_url: resolveContactDisplayAvatar(
      c,
      c.linked_auth_user_id ? avatarByUserId.get(c.linked_auth_user_id) ?? null : null,
    ),
  }));
}
