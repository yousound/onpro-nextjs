import { isClientLiveBackend } from "@/lib/config/backend-mode";
import type { Contact } from "@/lib/types/contact";
import type { ProjectPermissionFlags } from "@/lib/project-permissions";

/** Persist a contact to Supabase in Live mode; no-op in Mock (caller uses saveContacts). */
export async function persistContactToDb(contact: Contact): Promise<Contact | null> {
  if (!isClientLiveBackend()) return null;

  const res = await fetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "upsert", contact }),
  });
  const data = (await res.json()) as { error?: string; contact?: Contact };
  if (!res.ok) throw new Error(data.error ?? "Could not save contact");
  return data.contact ?? null;
}

export async function persistContactPermissionsToDb(
  contactId: string,
  permissions: ProjectPermissionFlags,
): Promise<void> {
  if (!isClientLiveBackend()) return;

  const res = await fetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "permissions", contactId, permissions }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Could not save permissions");
}
