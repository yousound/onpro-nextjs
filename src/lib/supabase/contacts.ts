import { createClient } from "@/lib/supabase/server";
import { contactFromRow } from "@/lib/supabase/mappers/contact";
import { enrichContactsWithLinkedAvatars } from "@/lib/supabase/enrich-contact-avatars";
import type { ContactRowDb } from "@/lib/supabase/types-db";
import type { Contact } from "@/lib/types/contact";

export async function fetchContactsFromSupabase(workspaceOwnerId?: string): Promise<Contact[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let ownerId = workspaceOwnerId;
  if (!ownerId && user) {
    const { resolveWorkspaceOwnerId } = await import("@/lib/server/resolve-workspace-context");
    ownerId = await resolveWorkspaceOwnerId(supabase, user.id);
  }

  let query = supabase.from("contacts").select("*");
  if (ownerId) {
    query = query.eq("user_id", ownerId);
  }
  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("[supabase] fetchContacts", error.message);
    throw error;
  }

  const contacts = (data as ContactRowDb[]).map(contactFromRow);
  return enrichContactsWithLinkedAvatars(supabase, contacts);
}
