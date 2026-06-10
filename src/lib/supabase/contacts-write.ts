import { contactFromRow } from "@/lib/supabase/mappers/contact";
import { contactToDbRow } from "@/lib/supabase/contact-payload";
import type { ContactRowDb } from "@/lib/supabase/types-db";
import type { Contact } from "@/lib/types/contact";
import type { SupabaseClient } from "@supabase/supabase-js";

function parseContactId(id: string): number | null {
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function upsertContactForUser(
  supabase: SupabaseClient,
  userId: string,
  contact: Contact,
): Promise<Contact> {
  const row = contactToDbRow(contact, userId);
  const numericId = parseContactId(contact.id);

  if (numericId != null) {
    const { data, error } = await supabase
      .from("contacts")
      .update(row)
      .eq("id", numericId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error("Contact not found or you do not have permission to update it.");
    }
    return contactFromRow(data as ContactRowDb);
  }

  const { data: byEmail } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("email", row.email)
    .maybeSingle();

  if (byEmail?.id) {
    const { data, error } = await supabase
      .from("contacts")
      .update(row)
      .eq("id", byEmail.id)
      .select("*")
      .single();
    if (error) throw error;
    return contactFromRow(data as ContactRowDb);
  }

  const { data, error } = await supabase.from("contacts").insert(row).select("*").single();
  if (error) throw error;
  return contactFromRow(data as ContactRowDb);
}

export async function updateContactPermissions(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
  permissions: Contact["permissions"],
): Promise<void> {
  const numericId = parseContactId(contactId);
  if (numericId == null) throw new Error("Invalid contact id");

  const { data: existing, error: fetchErr } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", numericId)
    .eq("user_id", userId)
    .single();
  if (fetchErr) throw fetchErr;

  const contact = contactFromRow(existing as ContactRowDb);
  await upsertContactForUser(supabase, userId, { ...contact, permissions });
}

export async function countProjectsForClient(
  supabase: SupabaseClient,
  userId: string,
  clientId: number,
): Promise<number> {
  const { count, error } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("client_id", clientId);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteContactForUser(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
): Promise<void> {
  const numericId = parseContactId(contactId);
  if (numericId == null) throw new Error("Invalid contact id");

  const { data: row, error: fetchErr } = await supabase
    .from("contacts")
    .select("id, role, address")
    .eq("id", numericId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error("Contact not found");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("self_contact_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileRow?.self_contact_id === numericId) {
    throw new Error(
      "This is your operator profile in Contacts. Update it in Settings instead of deleting.",
    );
  }

  const segment =
    row.role?.trim().toLowerCase() === "vendor"
      ? "vendor"
      : row.role?.trim().toLowerCase() === "team"
        ? "team"
        : "client";

  if (segment === "client") {
    const n = await countProjectsForClient(supabase, userId, numericId);
    if (n > 0) {
      throw new Error(
        `This client is used on ${n} project${n === 1 ? "" : "s"}. Reassign or delete those projects first.`,
      );
    }
  }

  const idsToDelete = new Set<number>([numericId]);

  let isCompany = false;
  if (row.address) {
    try {
      const parsed = JSON.parse(row.address) as { kind?: string };
      isCompany = parsed.kind === "company";
    } catch {
      isCompany = false;
    }
  }

  if (segment === "client" && isCompany) {
    const { data: allClients, error: memErr } = await supabase
      .from("contacts")
      .select("id, address")
      .eq("user_id", userId)
      .eq("role", "client");
    if (memErr) throw memErr;
    for (const c of allClients ?? []) {
      if (c.id === numericId) continue;
      if (!c.address) continue;
      try {
        const parsed = JSON.parse(c.address) as { parent_company_id?: string };
        if (String(parsed.parent_company_id ?? "") === String(numericId)) {
          idsToDelete.add(c.id);
        }
      } catch {
        /* skip */
      }
    }
  }

  for (const id of idsToDelete) {
    const { error } = await supabase.from("contacts").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  }
}
