import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  deleteContactForUser,
  upsertContactForUser,
  updateContactPermissions,
} from "@/lib/supabase/contacts-write";
import { resolveWorkspaceOwnerId } from "@/lib/server/resolve-workspace-context";
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
    const workspaceOwnerId = await resolveWorkspaceOwnerId(supabase, user.id);
    if (workspaceOwnerId !== user.id) {
      return NextResponse.json(
        {
          error:
            "You're viewing someone else's team workspace. Switch to My workspace in the sidebar before adding or editing your contacts.",
        },
        { status: 403 },
      );
    }

    if (body.action === "permissions") {
      await updateContactPermissions(supabase, user.id, body.contactId, body.permissions);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "upsert" && body.contact) {
      const saved = await upsertContactForUser(supabase, user.id, body.contact);
      return NextResponse.json({ ok: true, contact: saved });
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
