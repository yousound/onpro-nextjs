import { createClient } from "@/lib/supabase/server";
import { contactFromRow } from "@/lib/supabase/mappers/contact";
import type { ContactRowDb } from "@/lib/supabase/types-db";
import type { Contact } from "@/lib/types/contact";

export async function fetchContactsFromSupabase(): Promise<Contact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("[supabase] fetchContacts", error.message);
    throw error;
  }

  return (data as ContactRowDb[]).map(contactFromRow);
}
