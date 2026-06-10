import type { Contact } from "@/lib/types/contact";

export type ContactInviteStatus = "uninvited" | "invited" | "joined";

/** Session-only contact row (not yet persisted to Supabase). */
export function isOptimisticContactId(id: string): boolean {
  return id.startsWith("c-");
}

/** Team roster row awaiting a linked app account (excludes the signed-in operator's own contact). */
export function isTeamMemberPending(
  contact: Contact,
  selfContactId?: string | null,
): boolean {
  if (contact.segment !== "team") return false;
  if (selfContactId && contact.id === selfContactId) return false;
  if (contact.linked_auth_user_id) return false;
  if (contact.invite_status === "joined") return false;
  return true;
}
