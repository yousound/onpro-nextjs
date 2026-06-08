import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import { buildInviteLoginUrl, createPendingInvite } from "@/lib/supabase/pending-invites";
import type { PeopleSegment } from "@/lib/types/contact";
import type { ProjectPermissionFlags } from "@/lib/project-permissions";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    contact_id?: number;
    email?: string;
    segment?: PeopleSegment;
    invited_label?: string;
    permissions?: ProjectPermissionFlags;
    redirect_after?: string;
  };

  const contactId = body.contact_id;
  const email = body.email?.trim();
  if (contactId == null || !Number.isFinite(contactId) || !email) {
    return NextResponse.json({ error: "contact_id and email required" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    const { invite } = await createPendingInvite(supabase, {
      operatorUserId: user.id,
      contactId,
      email,
      segment: body.segment ?? "client",
      invitedLabel: body.invited_label,
      permissions: body.permissions,
      redirectAfter: body.redirect_after,
    });

    const loginUrl = buildInviteLoginUrl(
      origin,
      invite.token,
      body.segment ?? "client",
      body.redirect_after,
    );

    return NextResponse.json({
      invite: {
        id: invite.id,
        email: invite.email,
        segment: invite.segment,
        invitedLabel: invite.invitedLabel,
        createdAt: invite.createdAt,
      },
      loginUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create invite";
    if (msg.includes("pending_invites")) {
      return NextResponse.json({ error: "Run migration 008_workspace_memberships.sql" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
