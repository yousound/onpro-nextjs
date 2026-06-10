import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config/backend";
import {
  ACTIVE_WORKSPACE_COOKIE,
  activeWorkspaceCookieValue,
} from "@/lib/workspace-context";
import { ensureSelfTeamContact, syncMemberProfileToLinkedContacts } from "@/lib/supabase/onboarding";
import { fetchProfile } from "@/lib/supabase/profile";
import { joinWorkspace } from "@/lib/supabase/workspace-memberships";
import { acceptPendingInvite } from "@/lib/supabase/pending-invites";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    operator_user_id?: string;
    contact_id?: number;
    invite_token?: string;
  };

  const memberUserId = user.id;

  async function syncMemberContacts() {
    const profile = await fetchProfile(supabase, memberUserId);
    if (!profile) return;
    const fullName = profile.full_name?.trim();
    if (fullName) {
      await syncMemberProfileToLinkedContacts(supabase, memberUserId, {
        full_name: fullName,
        phone: profile.phone ?? undefined,
        avatar_url: profile.avatar_url,
        company_name: profile.company_name ?? undefined,
      });
    }
    await ensureSelfTeamContact(supabase, memberUserId, profile);
  }

  function withTeamWorkspaceCookie(operatorUserId: string) {
    const res = NextResponse.json({ ok: true, operatorUserId });
    res.cookies.set(
      ACTIVE_WORKSPACE_COOKIE,
      activeWorkspaceCookieValue(operatorUserId),
      { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false },
    );
    return res;
  }

  try {
    if (body.invite_token?.trim()) {
      const resolved = await import("@/lib/supabase/pending-invites").then((m) =>
        m.resolveInviteToken(supabase, body.invite_token!.trim()),
      );
      await acceptPendingInvite(
        supabase,
        body.invite_token.trim(),
        user.id,
        user.email,
        user.user_metadata?.full_name as string | undefined,
      );
      await syncMemberContacts();
      if (resolved.operatorUserId) {
        return withTeamWorkspaceCookie(resolved.operatorUserId);
      }
      return NextResponse.json({ ok: true, source: "invite" });
    }

    const operatorUserId = body.operator_user_id?.trim();
    const contactId = body.contact_id;
    if (!operatorUserId || contactId == null || !Number.isFinite(contactId)) {
      return NextResponse.json({ error: "operator_user_id and contact_id required" }, { status: 400 });
    }

    const membership = await joinWorkspace(supabase, {
      operatorUserId,
      contactId,
      memberUserId: user.id,
      source: "email_claim",
      memberEmail: user.email,
      memberName: (user.user_metadata?.full_name as string | undefined) ?? undefined,
    });

    await syncMemberContacts();

    const res = NextResponse.json({ ok: true, membership, operatorUserId });
    res.cookies.set(
      ACTIVE_WORKSPACE_COOKIE,
      activeWorkspaceCookieValue(operatorUserId),
      { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: false },
    );
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Join failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
