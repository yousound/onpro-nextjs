import { isLiveBackendEnabled } from "@/lib/config/backend";
import { loadContacts } from "@/lib/contacts-store";
import { fetchContactsFromSupabase } from "@/lib/supabase/contacts";
import type { Contact } from "@/lib/types/contact";

/** Contacts for People: Supabase in Live mode, local CRM mocks in Mock mode only. */
export async function fetchContacts(): Promise<Contact[]> {
  if (!(await isLiveBackendEnabled())) {
    return loadContacts();
  }
  return fetchContactsFromSupabase();
}
