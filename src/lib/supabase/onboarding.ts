import { defaultPermissionsForSegment } from "@/lib/project-permissions";
import { upsertContactForUser } from "@/lib/supabase/contacts-write";
import { buildInviteLoginUrl, createPendingInvite } from "@/lib/supabase/pending-invites";
import { fetchProfile, updateProfileFields, upsertProfile } from "@/lib/supabase/profile";
import type { OnboardingStatus, TeamInviteDraft } from "@/lib/types/onboarding";
import type { Contact, TeamRole } from "@/lib/types/contact";
import type { UserProfile } from "@/lib/types/profile";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingInviteLink = {
  name: string;
  email: string;
  loginUrl: string;
};

/** Signup trigger may set full_name to email — don't pre-fill the onboarding form with that. */
export function fullNameForOnboardingForm(
  fullName: string | null | undefined,
  email: string,
): string | null {
  const name = fullName?.trim();
  if (!name) return null;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return name;
  if (name.toLowerCase() === normalizedEmail) return null;
  const localPart = normalizedEmail.split("@")[0];
  if (localPart && name.toLowerCase() === localPart) return null;
  return name;
}

export function onboardingStatusFromProfile(profile: UserProfile | null, email: string): OnboardingStatus {
  const accountEmail = profile?.email ?? email;
  return {
    completed: Boolean(profile?.onboarding_completed_at),
    accountKind: profile?.account_kind ?? "operator",
    step: profile?.onboarding_step ?? 0,
    redirectAfter: profile?.redirect_after_onboarding ?? null,
    profile: {
      displayName: profile?.username ?? null,
      fullName: fullNameForOnboardingForm(profile?.full_name, accountEmail),
      email: profile?.email ?? email,
      companyName: profile?.company_name ?? null,
      workspaceName: profile?.workspace_name ?? null,
      phone: profile?.phone ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      operatorRole: profile?.operator_role ?? null,
      businessType: profile?.business_type ?? null,
    },
  };
}

function teamRoleFromLabel(label: string): TeamRole {
  const l = label.trim().toLowerCase();
  if (l.includes("admin")) return "admin";
  if (l.includes("manager")) return "manager";
  if (l.includes("temp")) return "temp";
  return "staff";
}

/** CRM row for the signed-in operator on their own team list. */
export async function ensureSelfTeamContact(
  supabase: SupabaseClient,
  userId: string,
  profile: UserProfile,
): Promise<number | null> {
  const email = profile.email?.trim();
  const name =
    profile.full_name?.trim() ||
    profile.username?.trim() ||
    email?.split("@")[0] ||
    "You";
  if (!email) return null;

  const perms = defaultPermissionsForSegment("team");
  const teamContact: Contact = {
    id: profile.self_contact_id ? String(profile.self_contact_id) : `pending-${userId}`,
    segment: "team",
    kind: "individual",
    company_code: "",
    name,
    contact_name: name,
    email,
    phone: profile.phone ?? undefined,
    company_name: profile.company_name?.trim() || profile.workspace_name?.trim() || undefined,
    team_role: teamRoleFromLabel(profile.operator_role ?? "staff"),
    permissions: perms,
    avatar_url: profile.avatar_url,
    member_contact_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let saved = await upsertContactForUser(supabase, userId, teamContact);
  const contactId = Number(saved.id);

  await updateProfileFields(supabase, userId, email, { self_contact_id: contactId });

  const profileAvatar = profile.avatar_url?.trim();
  if (profileAvatar && saved.avatar_url !== profileAvatar) {
    saved = await upsertContactForUser(supabase, userId, { ...saved, avatar_url: profileAvatar });
  }

  return contactId;
}

function teamInviteContactDraft(
  inv: TeamInviteDraft,
  operatorCompany?: string | null,
): Contact | null {
  const email = inv.email.trim();
  const name = inv.name.trim();
  if (!email || !name) return null;

  const roleLabel = inv.role.trim() || "Staff";
  const perms = defaultPermissionsForSegment("team");
  const now = new Date().toISOString();

  return {
    id: `invite-${email}`,
    segment: "team",
    kind: "individual",
    company_code: "",
    name,
    contact_name: name,
    email,
    company_name: operatorCompany ?? undefined,
    team_role: teamRoleFromLabel(roleLabel),
    team_role_custom: undefined,
    permissions: perms,
    avatar_url: null,
    member_contact_ids: [],
    created_at: now,
    updated_at: now,
  };
}

export async function insertTeamInviteContacts(
  supabase: SupabaseClient,
  userId: string,
  invites: TeamInviteDraft[],
  operatorCompany?: string | null,
): Promise<void> {
  for (const inv of invites) {
    const contact = teamInviteContactDraft(inv, operatorCompany);
    if (!contact) continue;
    await upsertContactForUser(supabase, userId, contact);
  }
}

/** Save team contacts and optional pending_invites with shareable login URLs (operator onboarding step 3). */
export async function provisionOnboardingTeamInvites(
  supabase: SupabaseClient,
  userId: string,
  invites: TeamInviteDraft[],
  operatorCompany: string | null | undefined,
  origin: string,
  createInviteLinks: boolean,
): Promise<OnboardingInviteLink[]> {
  const links: OnboardingInviteLink[] = [];

  for (const inv of invites) {
    const contact = teamInviteContactDraft(inv, operatorCompany);
    if (!contact) continue;

    const saved = await upsertContactForUser(supabase, userId, contact);
    const contactId = Number(saved.id);
    if (!Number.isFinite(contactId)) continue;

    if (!createInviteLinks) continue;

    const { invite } = await createPendingInvite(supabase, {
      operatorUserId: userId,
      contactId,
      email: contact.email,
      segment: "team",
      invitedLabel: inv.role.trim() ? `${inv.role.trim()} invite` : "Team invite",
      permissions: contact.permissions,
      redirectAfter: "/",
    });

    links.push({
      name: contact.name,
      email: contact.email,
      loginUrl: buildInviteLoginUrl(origin, invite.token, "team", "/"),
    });
  }

  return links;
}

export async function completeOperatorOnboarding(
  supabase: SupabaseClient,
  userId: string,
  email: string,
): Promise<{ profile: UserProfile; redirect: string }> {
  let profile = await fetchProfile(supabase, userId);
  if (!profile) {
    await updateProfileFields(supabase, userId, email, { email });
    profile = await fetchProfile(supabase, userId);
  }
  if (!profile) throw new Error("Profile not found");

  const now = new Date().toISOString();
  await updateProfileFields(supabase, userId, email, {
    onboarding_completed_at: now,
    onboarding_step: 4,
  });

  const updated = (await fetchProfile(supabase, userId)) ?? profile;
  await ensureSelfTeamContact(supabase, userId, updated);

  return { profile: updated, redirect: "/" };
}

export async function saveClientProfileFields(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  patch: {
    full_name: string;
    username?: string;
    company_name?: string;
    phone?: string;
    avatar_url?: string | null;
    redirect_after?: string;
  },
): Promise<void> {
  await upsertProfile(supabase, userId, email, {
    full_name: patch.full_name,
    username: patch.username,
    company_name: patch.company_name,
    phone: patch.phone,
    avatar_url: patch.avatar_url,
  });

  const fields: Record<string, unknown> = { account_kind: "client", onboarding_step: 1 };
  if (patch.redirect_after?.trim()) {
    fields.redirect_after_onboarding = patch.redirect_after.trim();
  }
  await updateProfileFields(supabase, userId, email, fields);
}

export async function completeClientOnboarding(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  patch: {
    full_name: string;
    username?: string;
    company_name?: string;
    phone?: string;
    avatar_url?: string | null;
  },
): Promise<{ redirect: string }> {
  await upsertProfile(supabase, userId, email, {
    full_name: patch.full_name,
    username: patch.username,
    company_name: patch.company_name,
    phone: patch.phone,
    avatar_url: patch.avatar_url,
  });

  const profile = await fetchProfile(supabase, userId);
  const redirect = profile?.redirect_after_onboarding?.trim() || "/messages";

  const now = new Date().toISOString();
  await updateProfileFields(supabase, userId, email, {
    onboarding_completed_at: now,
    onboarding_step: 3,
    account_kind: "client",
  });

  return { redirect };
}

export async function saveMemberProfileFields(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  patch: {
    full_name: string;
    username?: string;
    company_name?: string;
    phone?: string;
    avatar_url?: string | null;
    redirect_after?: string;
  },
): Promise<void> {
  await upsertProfile(supabase, userId, email, {
    full_name: patch.full_name,
    username: patch.username,
    company_name: patch.company_name,
    phone: patch.phone,
    avatar_url: patch.avatar_url,
  });

  const fields: Record<string, unknown> = { account_kind: "member", onboarding_step: 1 };
  if (patch.redirect_after?.trim()) {
    fields.redirect_after_onboarding = patch.redirect_after.trim();
  }
  await updateProfileFields(supabase, userId, email, fields);
}

export async function completeMemberOnboarding(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  patch: {
    full_name: string;
    username?: string;
    company_name?: string;
    phone?: string;
    avatar_url?: string | null;
  },
): Promise<{ redirect: string }> {
  await upsertProfile(supabase, userId, email, {
    full_name: patch.full_name,
    username: patch.username,
    company_name: patch.company_name,
    phone: patch.phone,
    avatar_url: patch.avatar_url,
  });

  const profile = await fetchProfile(supabase, userId);
  const redirect = profile?.redirect_after_onboarding?.trim() || "/";

  const now = new Date().toISOString();
  await updateProfileFields(supabase, userId, email, {
    onboarding_completed_at: now,
    onboarding_step: 3,
    account_kind: "member",
  });

  return { redirect };
}
