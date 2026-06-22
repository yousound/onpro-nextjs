import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  deleteContactForUser,
  upsertContactForUser,
  updateContactPermissions,
} from "@/lib/supabase/contacts-write";
import { enrichContactsWithLinkedAvatars } from "@/lib/supabase/enrich-contact-avatars";
import { assertCanManageWorkspacePermissions } from "@/lib/server/workspace-write-access";
import { contactFromRow } from "@/lib/supabase/mappers/contact";
import type { ContactRowDb } from "@/lib/supabase/types-db";
import { fetchContactsFromSupabase } from "@/lib/supabase/contacts";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types/contact";
import type { ProjectPermissionFlags } from "@/lib/project-permissions";

type Body =
  | { action: "upsert"; contact: Contact }
  | { action: "permissions"; contactId: string; permissions: ProjectPermissionFlags };

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contacts = await fetchContactsFromSupabase();
    return NextResponse.json({ contacts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Body;

  try {
    if (body.action === "permissions") {
      const workspaceOwnerId = await assertCanManageWorkspacePermissions(supabase, user.id);
      await updateContactPermissions(supabase, workspaceOwnerId, body.contactId, body.permissions);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "upsert" && body.contact) {
      const { resolveWorkspaceOwnerId } = await import("@/lib/server/resolve-workspace-context");
      const workspaceOwnerId = await resolveWorkspaceOwnerId(supabase, user.id);
      let contact = body.contact;
      if (user.id !== workspaceOwnerId) {
        const numericId = Number(contact.id);
        if (Number.isFinite(numericId) && numericId > 0) {
          const { data: existing, error: fetchErr } = await supabase
            .from("contacts")
            .select("*")
            .eq("id", numericId)
            .eq("user_id", workspaceOwnerId)
            .maybeSingle();
          if (fetchErr) throw fetchErr;
          if (existing) {
            contact = { ...contact, permissions: contactFromRow(existing as ContactRowDb).permissions };
          } else {
            const { permissions: _ignored, ...rest } = contact;
            contact = rest as Contact;
          }
        } else {
          const { permissions: _ignored, ...rest } = contact;
          contact = rest as Contact;
        }
      }
      const saved = await upsertContactForUser(supabase, workspaceOwnerId, contact);
      const [enriched] = await enrichContactsWithLinkedAvatars(supabase, [saved]);
      return NextResponse.json({ ok: true, contact: enriched ?? saved });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "Missing contact id" }, { status: 400 });

  try {
    await deleteContactForUser(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
